"""
Lakebase (Databricks PostgreSQL) Service for Vibe Coding Workshop

Dual-mode connection layer supporting both Lakebase Provisioned and Autoscaling.

Mode detection via ENDPOINT_NAME environment variable:
  - Set   -> Autoscaling: uses psycopg3 ConnectionPool with OAuth token rotation
             via generate_database_credential(). Supports scale-to-zero.
  - Unset -> Provisioned: uses PGPASSWORD from app resource link or SDK OAuth.

Environment Variables (both modes):
  PGHOST, PGDATABASE, PGUSER, PGPORT, PGSSLMODE  (auto-injected by Databricks)
  LAKEBASE_HOST, LAKEBASE_DATABASE, LAKEBASE_SCHEMA, LAKEBASE_PORT  (manual fallback)

Autoscaling-only:
  ENDPOINT_NAME  - format: projects/{id}/branches/{id}/endpoints/{id}
"""
import os
import logging
import sys
import time as _time
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("lakebase")
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Driver detection: prefer psycopg3, fall back to psycopg2
# ---------------------------------------------------------------------------
PSYCOPG3_AVAILABLE = False
PSYCOPG2_AVAILABLE = False
_DRIVER = None  # "psycopg3" | "psycopg2" | None

try:
    import psycopg
    from psycopg.rows import dict_row
    PSYCOPG3_AVAILABLE = True
    _DRIVER = "psycopg3"
    logger.info("Using psycopg3 (psycopg) driver")
except ImportError:
    pass

if not PSYCOPG3_AVAILABLE:
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        PSYCOPG2_AVAILABLE = True
        _DRIVER = "psycopg2"
        logger.info("psycopg3 not available, falling back to psycopg2 driver")
    except ImportError:
        logger.warning("No PostgreSQL driver available (psycopg3 or psycopg2). Using YAML fallback.")

# Optional: psycopg3 connection pool (for Autoscaling token rotation)
PSYCOPG3_POOL_AVAILABLE = False
try:
    from psycopg_pool import ConnectionPool
    PSYCOPG3_POOL_AVAILABLE = True
except ImportError:
    pass

try:
    from databricks.sdk import WorkspaceClient
    DATABRICKS_SDK_AVAILABLE = True
except ImportError:
    DATABRICKS_SDK_AVAILABLE = False
    logger.warning("databricks-sdk not available for OAuth.")

# ---------------------------------------------------------------------------
# Autoscaling mode: singleton pool with OAuth token rotation
# ---------------------------------------------------------------------------
_autoscaling_pool = None
_workspace_client = None

COLD_START_MAX_RETRIES = 5
COLD_START_RETRY_DELAY = 3  # seconds


def _is_autoscaling_mode() -> bool:
    return bool(os.getenv("ENDPOINT_NAME", ""))


def _get_workspace_client() -> "WorkspaceClient":
    global _workspace_client
    if _workspace_client is None:
        _workspace_client = WorkspaceClient()
    return _workspace_client


def _generate_autoscaling_credential() -> str:
    """Generate a fresh database credential for Lakebase Autoscaling."""
    endpoint_name = os.environ["ENDPOINT_NAME"]
    client = _get_workspace_client()
    credential = client.postgres.generate_database_credential(endpoint=endpoint_name)
    return credential.token


# =============================================================================
# Configuration
# =============================================================================


def _get_config() -> Dict[str, Any]:
    """
    Get Lakebase configuration from environment variables (read at runtime).

    Priority:
    1. Databricks-provided PG* variables (resource link or Autoscaling)
    2. Custom LAKEBASE_* variables (manual config via app.yaml)
    """
    pg_host = os.getenv("PGHOST", "")
    pg_database = os.getenv("PGDATABASE", "")
    pg_user = os.getenv("PGUSER", "")
    pg_port = os.getenv("PGPORT", "")
    pg_sslmode = os.getenv("PGSSLMODE", "")

    if pg_host and pg_database:
        logger.info("Using Databricks-provided PG* environment variables")
        return {
            "host": pg_host,
            "database": pg_database,
            "schema": os.getenv("LAKEBASE_SCHEMA", ""),
            "port": int(pg_port) if pg_port else 5432,
            "user": pg_user,
            "sslmode": pg_sslmode or "require",
            "source": "databricks_resource",
            "mode": "autoscaling" if _is_autoscaling_mode() else "provisioned",
        }

    logger.info("Using custom LAKEBASE_* environment variables")

    user = os.getenv("LAKEBASE_USER", "")
    if not user:
        # DATABRICKS_CLIENT_ID is auto-injected by the Databricks Apps platform
        # and is the correct username for OAuth authentication to Lakebase
        user = os.getenv("DATABRICKS_CLIENT_ID", "")
        if user:
            logger.info(f"Using DATABRICKS_CLIENT_ID as Lakebase user: {user[:20]}...")
    if not user:
        logger.warning(
            "PGUSER, LAKEBASE_USER, and DATABRICKS_CLIENT_ID all unset. "
            "Attempting to get identity from Databricks SDK..."
        )
        try:
            if DATABRICKS_SDK_AVAILABLE:
                w = _get_workspace_client()
                if hasattr(w.config, 'client_id') and w.config.client_id:
                    user = w.config.client_id
                    logger.info(f"Got service principal client_id from SDK: {user[:20]}...")
        except Exception as e:
            logger.warning(f"Could not get identity from SDK: {e}")

    return {
        "host": os.getenv("LAKEBASE_HOST", ""),
        "database": os.getenv("LAKEBASE_DATABASE", ""),
        "schema": os.getenv("LAKEBASE_SCHEMA", ""),
        "port": int(os.getenv("LAKEBASE_PORT", "5432")),
        "user": user,
        "sslmode": "require",
        "source": "manual_config",
        "mode": "autoscaling" if _is_autoscaling_mode() else "provisioned",
    }


def get_schema() -> str:
    """Get the schema name for Lakebase tables"""
    config = _get_config()
    return config["schema"]


def is_lakebase_configured() -> bool:
    """Check if Lakebase is properly configured (reads env vars at runtime)"""
    has_driver = PSYCOPG3_AVAILABLE or PSYCOPG2_AVAILABLE
    config = _get_config()
    configured = bool(has_driver and config["host"] and config["database"])
    if not configured:
        logger.info(f"Lakebase config check: driver={_DRIVER}, host={bool(config['host'])}, db={bool(config['database'])}")
    else:
        logger.info(f"Lakebase configured via {config.get('source', 'unknown')} [{config.get('mode')}]: host={config['host'][:30]}...")
    return configured


def _get_oauth_token() -> Optional[str]:
    """
    Get OAuth token for Lakebase Provisioned authentication.

    For Autoscaling mode, use _generate_autoscaling_credential() instead.
    """
    databricks_token = os.getenv("DATABRICKS_TOKEN", "")
    lakebase_token = os.getenv("LAKEBASE_TOKEN", "")

    if databricks_token:
        return databricks_token
    if lakebase_token:
        return lakebase_token

    if not DATABRICKS_SDK_AVAILABLE:
        return None

    try:
        w = _get_workspace_client()

        if hasattr(w.config, 'token') and w.config.token:
            return w.config.token

        try:
            headers = w.config.authenticate()
            if headers and 'Authorization' in headers:
                auth_header = headers['Authorization']
                if auth_header.startswith('Bearer '):
                    return auth_header[7:]
        except Exception:
            pass

        try:
            if hasattr(w.config, 'oauth_token') and callable(w.config.oauth_token):
                token_resp = w.config.oauth_token()
                if token_resp and hasattr(token_resp, 'access_token'):
                    return token_resp.access_token
        except Exception:
            pass

        return None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Autoscaling connection pool (psycopg3 with token rotation)
# ---------------------------------------------------------------------------

def _get_autoscaling_pool():
    """Lazily initialise and return the Autoscaling connection pool."""
    global _autoscaling_pool
    if _autoscaling_pool is not None:
        return _autoscaling_pool

    if not (PSYCOPG3_AVAILABLE and PSYCOPG3_POOL_AVAILABLE and DATABRICKS_SDK_AVAILABLE):
        raise RuntimeError(
            "Autoscaling mode requires psycopg[binary,pool]>=3.1.0 and "
            "databricks-sdk>=0.81.0.  Install them and restart the app."
        )

    config = _get_config()
    user = config.get("user", "")
    host = config["host"]
    port = config["port"]
    database = config["database"]
    sslmode = config.get("sslmode", "require")

    conninfo = (
        f"dbname={database} user={user} host={host} "
        f"port={port} sslmode={sslmode}"
    )

    class _OAuthConnection(psycopg.Connection):
        """Generates a fresh Autoscaling credential per connection."""
        @classmethod
        def connect(cls, conninfo='', **kwargs):
            kwargs['password'] = _generate_autoscaling_credential()
            return super().connect(conninfo, **kwargs)

    _autoscaling_pool = ConnectionPool(
        conninfo=conninfo,
        connection_class=_OAuthConnection,
        min_size=1,
        max_size=10,
        open=True,
    )
    logger.info("Autoscaling ConnectionPool initialised (1-10 connections, OAuth token rotation)")
    return _autoscaling_pool


# ---------------------------------------------------------------------------
# Unified get_connection() -- works for both modes and both drivers
# ---------------------------------------------------------------------------

def _connect_psycopg3(config: Dict, password: str):
    """Create a psycopg3 connection for Provisioned mode."""
    return psycopg.connect(
        host=config["host"],
        port=config["port"],
        dbname=config["database"],
        user=config["user"],
        password=password,
        sslmode=config.get("sslmode", "require"),
    )


def _connect_psycopg2(config: Dict, password: str):
    """Create a psycopg2 connection (legacy fallback)."""
    return psycopg2.connect(
        host=config["host"],
        port=config["port"],
        database=config["database"],
        user=config["user"],
        password=password,
        sslmode=config.get("sslmode", "require"),
    )


@contextmanager
def get_connection():
    """
    Get a connection to Lakebase PostgreSQL database.

    Autoscaling mode: borrows from the ConnectionPool (token rotation automatic).
    Provisioned mode: creates a fresh connection per call.
    Includes retry logic for scale-to-zero cold starts.
    """
    if not is_lakebase_configured():
        raise RuntimeError("Lakebase not configured. Check environment variables.")

    # --- Autoscaling path (psycopg3 pool) ---
    if _is_autoscaling_mode():
        pool = _get_autoscaling_pool()
        conn = None
        try:
            for attempt in range(1, COLD_START_MAX_RETRIES + 1):
                try:
                    conn = pool.getconn()
                    break
                except Exception as e:
                    if attempt == COLD_START_MAX_RETRIES:
                        logger.error(f"Autoscaling connection failed after {COLD_START_MAX_RETRIES} attempts: {e}")
                        raise
                    wait = COLD_START_RETRY_DELAY * attempt
                    logger.warning(f"Connection attempt {attempt}/{COLD_START_MAX_RETRIES} failed (scale-to-zero wake?), retrying in {wait}s...")
                    _time.sleep(wait)
            yield conn
        except Exception as e:
            logger.error(f"Autoscaling connection error: {type(e).__name__}: {e}")
            raise
        finally:
            if conn:
                pool.putconn(conn)
        return

    # --- Provisioned path ---
    config = _get_config()
    user = config.get("user", "")
    password = None
    auth_method = None

    pg_password = os.getenv("PGPASSWORD", "")
    if pg_password:
        password = pg_password
        auth_method = "PGPASSWORD"
    if not password:
        # In Autoscaling fallback (psycopg2 only), generate credential manually
        if _is_autoscaling_mode() and DATABRICKS_SDK_AVAILABLE:
            try:
                password = _generate_autoscaling_credential()
                auth_method = "autoscaling_credential"
            except Exception:
                pass
    if not password:
        token = _get_oauth_token()
        if token:
            password = token
            auth_method = "OAuth"
    if not password:
        lakebase_password = os.getenv("LAKEBASE_PASSWORD", "")
        if lakebase_password:
            password = lakebase_password
            auth_method = "LAKEBASE_PASSWORD"

    if not user:
        raise RuntimeError(
            "No user configured for Lakebase connection. "
            "PGUSER should be auto-injected by the Lakebase resource link."
        )
    if not password:
        raise RuntimeError(
            "No password or OAuth token available. "
            "Ensure PGPASSWORD is set by Databricks, or set DATABRICKS_TOKEN/LAKEBASE_PASSWORD."
        )

    logger.info(f"Connecting to Lakebase via {auth_method} [{_DRIVER}]")
    conn = None
    try:
        for attempt in range(1, COLD_START_MAX_RETRIES + 1):
            try:
                if PSYCOPG3_AVAILABLE:
                    conn = _connect_psycopg3(config, password)
                else:
                    conn = _connect_psycopg2(config, password)
                break
            except Exception as e:
                if attempt == COLD_START_MAX_RETRIES:
                    raise
                wait = COLD_START_RETRY_DELAY * attempt
                logger.warning(f"Connection attempt {attempt}/{COLD_START_MAX_RETRIES} failed, retrying in {wait}s... ({e})")
                _time.sleep(wait)
        logger.info("Connected to Lakebase")
        yield conn
    except Exception as e:
        logger.error(f"CONNECTION FAILED: {type(e).__name__}: {e}")
        raise
    finally:
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Helper: create a dict-returning cursor for whichever driver is active
# ---------------------------------------------------------------------------

def _dict_cursor(conn):
    if PSYCOPG3_AVAILABLE and isinstance(conn, psycopg.Connection):
        return conn.cursor(row_factory=dict_row)
    return conn.cursor(cursor_factory=RealDictCursor)


def execute_query(sql: str, params: tuple = None) -> List[Dict]:
    """Execute a SELECT query and return results as list of dicts."""
    if not is_lakebase_configured():
        logger.info("Lakebase not configured - returning empty results")
        return []

    try:
        with get_connection() as conn:
            cursor = _dict_cursor(conn)
            cursor.execute(sql, params)
            results = cursor.fetchall()
            cursor.close()
            return [dict(row) for row in results]
    except Exception as e:
        logger.error(f"Error executing query: {e}")
        return []


def execute_insert(sql: str, params: tuple = None) -> bool:
    """Execute an INSERT/UPDATE/DELETE statement. Returns True on success."""
    if not is_lakebase_configured():
        logger.error("Lakebase not configured - cannot execute insert")
        return False

    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            conn.commit()
            cursor.close()
            return True
    except Exception as e:
        logger.error(f"Error executing insert: {e}")
        return False


# =============================================================================
# DDL for table creation (run via Lakebase UI or psql)
# =============================================================================

def get_create_tables_ddl() -> str:
    """Return the DDL to create tables in Lakebase (PostgreSQL)"""
    schema = get_schema()
    
    return f"""
-- =============================================================================
-- Vibe Coding Workshop - Lakebase Tables DDL
-- =============================================================================

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS {schema};

-- =============================================================================
-- Table: usecase_descriptions
-- Stores industry/use-case prompt templates with versioning
-- =============================================================================
CREATE TABLE IF NOT EXISTS {schema}.usecase_descriptions (
    config_id SERIAL PRIMARY KEY,
    industry VARCHAR(100) NOT NULL,
    industry_label VARCHAR(255) NOT NULL,
    use_case VARCHAR(100) NOT NULL,
    use_case_label VARCHAR(255) NOT NULL,
    prompt_template TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    inserted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- Indexes for usecase_descriptions
CREATE INDEX IF NOT EXISTS idx_usecase_industry_usecase 
ON {schema}.usecase_descriptions(industry, use_case);

CREATE INDEX IF NOT EXISTS idx_usecase_active_version 
ON {schema}.usecase_descriptions(is_active, version DESC);

-- =============================================================================
-- Table: section_input_prompts
-- Stores section-specific input templates and system prompts with versioning
-- =============================================================================
CREATE TABLE IF NOT EXISTS {schema}.section_input_prompts (
    input_id SERIAL PRIMARY KEY,
    section_tag VARCHAR(100) NOT NULL,
    section_title VARCHAR(255),
    section_description TEXT,
    input_template TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    order_number INTEGER,
    how_to_apply TEXT,
    expected_output TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    inserted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- Indexes for section_input_prompts
CREATE INDEX IF NOT EXISTS idx_section_tag 
ON {schema}.section_input_prompts(section_tag);

CREATE INDEX IF NOT EXISTS idx_section_active_version 
ON {schema}.section_input_prompts(is_active, version DESC);

CREATE INDEX IF NOT EXISTS idx_section_order 
ON {schema}.section_input_prompts(order_number);

-- Add comments
COMMENT ON TABLE {schema}.usecase_descriptions IS 
'Industry and use case prompt templates with versioning for Vibe Coding Workshop';

COMMENT ON TABLE {schema}.section_input_prompts IS 
'Section-specific input templates and system prompts with versioning';
"""


# =============================================================================
# Session Management Functions
# =============================================================================

import json
from datetime import datetime

SESSIONS_TABLE = "sessions"


def _get_sessions_table_name() -> str:
    """Get fully qualified sessions table name"""
    return f"{get_schema()}.{SESSIONS_TABLE}"


def save_session(
    session_id: str,
    industry: str = None,
    industry_label: str = None,
    use_case: str = None,
    use_case_label: str = None,
    session_name: str = None,
    session_description: str = None,
    feedback_rating: str = None,
    feedback_comment: str = None,
    feedback_request_followup: bool = None,
    prerequisites_completed: bool = None,
    current_step: int = None,
    workshop_level: str = None,
    completed_steps: List[int] = None,
    skipped_steps: List[int] = None,
    step_prompts: Dict[int, str] = None,
    created_by: str = None,
) -> bool:
    """
    Save or update a session in Lakebase.
    Uses UPSERT (INSERT ON CONFLICT) for PostgreSQL.
    
    IMPORTANT: All optional fields use None as default. When None, the UPSERT
    preserves the existing database value via COALESCE. Only explicitly provided
    values will overwrite. This prevents partial updates from wiping data.
    
    Args:
        session_id: Unique session identifier
        industry: Selected industry key
        industry_label: Display label for industry
        use_case: Selected use case key
        use_case_label: Display label for use case
        session_name: User-provided session name
        session_description: User-provided description
        feedback_rating: 'thumbs_up', 'thumbs_down', or None
        feedback_comment: User feedback text
        feedback_request_followup: Whether user requests follow-up support
        current_step: Current step number (None preserves existing)
        completed_steps: List of completed step numbers (None preserves existing)
        skipped_steps: List of skipped step numbers (None preserves existing)
        step_prompts: Dict mapping step number to generated prompt text
        created_by: User email
    
    Returns:
        True if successful, False otherwise
    """
    if not is_lakebase_configured():
        logger.warning(f"Lakebase not configured, cannot save session {session_id}")
        return False
    
    table_name = _get_sessions_table_name()
    
    # Defensive logging: track exactly which fields are being written
    _fields_being_set = []
    if completed_steps is not None: _fields_being_set.append(f"completed_steps({len(completed_steps)} items)")
    if skipped_steps is not None: _fields_being_set.append(f"skipped_steps({len(skipped_steps)} items)")
    if current_step is not None: _fields_being_set.append(f"current_step={current_step}")
    if workshop_level is not None: _fields_being_set.append(f"workshop_level={workshop_level}")
    if industry is not None: _fields_being_set.append("industry")
    if use_case is not None: _fields_being_set.append("use_case")
    if prerequisites_completed is not None: _fields_being_set.append(f"prerequisites_completed={prerequisites_completed}")
    if step_prompts is not None: _fields_being_set.append(f"step_prompts({len(step_prompts)} keys)")
    if session_name is not None: _fields_being_set.append(f"session_name={session_name}")
    if feedback_rating is not None: _fields_being_set.append("feedback")
    logger.info(f"Saving session {session_id}: fields=[{', '.join(_fields_being_set) or 'none'}]")
    
    try:
        # Step 1 stored in dedicated column, steps 2-20 stored in JSONB
        step_1_prompt_value = step_prompts.get(1) if step_prompts else None
        
        # Build step_prompts JSONB for steps 2-20 (exclude step 1)
        step_prompts_jsonb = {}
        if step_prompts:
            for step_num, prompt_text in step_prompts.items():
                if step_num != 1 and prompt_text:  # Skip step 1, include steps 2-20
                    step_prompts_jsonb[str(step_num)] = prompt_text
        step_prompts_json = json.dumps(step_prompts_jsonb)
        
        # Serialize completed_steps and skipped_steps to JSON
        # Use SQL NULL (None) when not provided so COALESCE preserves existing DB values
        completed_steps_json = json.dumps(completed_steps) if completed_steps is not None else None
        skipped_steps_json = json.dumps(skipped_steps) if skipped_steps is not None else None
        
        # Current timestamp
        now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        
        with get_connection() as conn:
            cursor = conn.cursor()
            
            # Build the UPSERT SQL
            upsert_sql = f"""
            INSERT INTO {table_name} (
                session_id, created_by,
                session_name, session_description,
                industry, industry_label, use_case, use_case_label,
                feedback_rating, feedback_comment, feedback_request_followup,
                step_1_prompt, step_prompts,
                prerequisites_completed, current_step, workshop_level, completed_steps, skipped_steps,
                created_at, updated_at
            ) VALUES (
                %s, %s,
                %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s
            )
            ON CONFLICT (session_id) DO UPDATE SET
                industry = COALESCE(EXCLUDED.industry, {table_name}.industry),
                industry_label = COALESCE(EXCLUDED.industry_label, {table_name}.industry_label),
                use_case = COALESCE(EXCLUDED.use_case, {table_name}.use_case),
                use_case_label = COALESCE(EXCLUDED.use_case_label, {table_name}.use_case_label),
                session_name = COALESCE(EXCLUDED.session_name, {table_name}.session_name),
                session_description = COALESCE(EXCLUDED.session_description, {table_name}.session_description),
                feedback_rating = COALESCE(EXCLUDED.feedback_rating, {table_name}.feedback_rating),
                feedback_comment = COALESCE(EXCLUDED.feedback_comment, {table_name}.feedback_comment),
                feedback_request_followup = COALESCE(EXCLUDED.feedback_request_followup, {table_name}.feedback_request_followup),
                prerequisites_completed = COALESCE(EXCLUDED.prerequisites_completed, {table_name}.prerequisites_completed),
                current_step = COALESCE(EXCLUDED.current_step, {table_name}.current_step),
                workshop_level = COALESCE(EXCLUDED.workshop_level, {table_name}.workshop_level),
                completed_steps = COALESCE(EXCLUDED.completed_steps, {table_name}.completed_steps),
                skipped_steps = COALESCE(EXCLUDED.skipped_steps, {table_name}.skipped_steps),
                step_1_prompt = COALESCE(EXCLUDED.step_1_prompt, {table_name}.step_1_prompt),
                step_prompts = COALESCE({table_name}.step_prompts, '{{}}'::jsonb) || COALESCE(EXCLUDED.step_prompts, '{{}}'::jsonb),
                updated_at = EXCLUDED.updated_at
            """
            
            params = (
                session_id, created_by or "",
                session_name, session_description,
                industry, industry_label, use_case, use_case_label,
                feedback_rating, feedback_comment, feedback_request_followup,
                step_1_prompt_value, step_prompts_json,
                prerequisites_completed, current_step, workshop_level, completed_steps_json, skipped_steps_json,
                now,
                now,
            )
            
            cursor.execute(upsert_sql, params)
            conn.commit()
            cursor.close()
            logger.info(f"Session {session_id} saved successfully to Lakebase")
            return True
            
    except Exception as e:
        logger.error(f"Error saving session to Lakebase: {e}", exc_info=True)
        return False


def save_chapter_feedback(session_id: str, chapter_name: str, rating: str) -> bool:
    """
    Save thumbs up/down feedback for a specific chapter.
    Uses JSONB merge to add/update feedback for one chapter without affecting others.
    
    The chapter_feedback column stores:
    {
        "Chapter 1": {"rating": "up", "timestamp": "2026-02-09T22:00:00Z"},
        "Chapter 2": {"rating": "down", "timestamp": "2026-02-09T22:30:00Z"}
    }
    
    Args:
        session_id: Session identifier
        chapter_name: Chapter name (e.g. "Chapter 1", "Foundation")
        rating: "up" or "down"
    
    Returns:
        True if successful, False otherwise
    """
    if not is_lakebase_configured():
        logger.warning(f"Lakebase not configured, cannot save chapter feedback")
        return False
    
    table_name = _get_sessions_table_name()
    
    try:
        now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        feedback_patch = json.dumps({
            chapter_name: {
                "rating": rating,
                "timestamp": now
            }
        })
        
        with get_connection() as conn:
            cursor = conn.cursor()
            
            # Use JSONB merge (||) to add/update this chapter's feedback
            # without overwriting other chapters' feedback
            update_sql = f"""
            UPDATE {table_name}
            SET chapter_feedback = COALESCE(chapter_feedback, '{{}}'::jsonb) || %s::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE session_id = %s
            """
            
            cursor.execute(update_sql, (feedback_patch, session_id))
            conn.commit()
            
            rows_affected = cursor.rowcount
            cursor.close()
            
            if rows_affected > 0:
                logger.info(f"Chapter feedback saved: session={session_id}, chapter={chapter_name}, rating={rating}")
                return True
            else:
                logger.warning(f"No session found for chapter feedback: {session_id}")
                return False
            
    except Exception as e:
        logger.error(f"Error saving chapter feedback: {e}", exc_info=True)
        return False


def load_session(session_id: str) -> Optional[Dict]:
    """
    Load a session from Lakebase by session_id.
    Returns None if not found.
    """
    if not is_lakebase_configured():
        logger.info(f"Lakebase not configured, cannot load session {session_id}")
        return None
    
    table_name = _get_sessions_table_name()
    logger.info(f"Loading session {session_id} from Lakebase table {table_name}")
    
    try:
        with get_connection() as conn:
            cursor = _dict_cursor(conn)
            
            query = f"""
            SELECT 
                session_id, industry, industry_label, use_case, use_case_label,
                session_name, session_description, feedback_rating, feedback_comment,
                prerequisites_completed, current_step, workshop_level, completed_steps, skipped_steps,
                step_1_prompt, step_prompts,
                COALESCE(session_parameters, '{{}}') as session_parameters,
                created_by, created_at, updated_at
            FROM {table_name}
            WHERE session_id = %s
            """
            
            cursor.execute(query, (session_id,))
            row = cursor.fetchone()
            cursor.close()
            
            if row:
                logger.info(f"Session {session_id} found in Lakebase")
                
                # Parse completed_steps from JSON
                completed_steps = []
                if row.get("completed_steps"):
                    try:
                        completed_steps = json.loads(row["completed_steps"])
                    except:
                        completed_steps = []
                
                # Parse skipped_steps from JSON
                skipped_steps = []
                if row.get("skipped_steps"):
                    try:
                        skipped_steps = json.loads(row["skipped_steps"])
                    except:
                        skipped_steps = []
                
                # Build step_prompts dict: step_1 from column + steps 2-20 from JSONB
                step_prompts = {}
                if row.get("step_1_prompt"):
                    step_prompts[1] = row["step_1_prompt"]
                
                # Merge in steps 2-20 from JSONB column
                step_prompts_jsonb = row.get("step_prompts")
                if step_prompts_jsonb:
                    # Handle both dict and string formats
                    if isinstance(step_prompts_jsonb, str):
                        try:
                            step_prompts_jsonb = json.loads(step_prompts_jsonb)
                        except:
                            step_prompts_jsonb = {}
                    
                    for step_str, prompt_text in step_prompts_jsonb.items():
                        try:
                            step_num = int(step_str)
                            if prompt_text:
                                step_prompts[step_num] = prompt_text
                        except ValueError:
                            pass  # Skip invalid keys
                
                # Format timestamps
                created_at = row.get("created_at")
                updated_at = row.get("updated_at")
                if hasattr(created_at, 'strftime'):
                    created_at = created_at.strftime('%Y-%m-%d %H:%M:%S')
                if hasattr(updated_at, 'strftime'):
                    updated_at = updated_at.strftime('%Y-%m-%d %H:%M:%S')
                
                # Determine if session was explicitly saved
                is_saved = bool(row.get("session_name") and row["session_name"] != "New Session")
                
                # Parse session_parameters from JSONB
                session_params = row.get("session_parameters", {})
                if isinstance(session_params, str):
                    try:
                        session_params = json.loads(session_params) if session_params else {}
                    except:
                        session_params = {}
                
                return {
                    "session_id": row["session_id"],
                    "industry": row.get("industry"),
                    "industry_label": row.get("industry_label"),
                    "use_case": row.get("use_case"),
                    "use_case_label": row.get("use_case_label"),
                    "session_name": row.get("session_name"),
                    "session_description": row.get("session_description"),
                    "feedback_rating": row.get("feedback_rating"),
                    "feedback_comment": row.get("feedback_comment"),
                    "prerequisites_completed": row.get("prerequisites_completed", False),
                    "current_step": row.get("current_step", 1),
                    "workshop_level": row.get("workshop_level", "300"),
                    "completed_steps": completed_steps,
                    "skipped_steps": skipped_steps,
                    "step_prompts": step_prompts,
                    "session_parameters": session_params,
                    "created_by": row.get("created_by"),
                    "created_at": created_at,
                    "updated_at": updated_at,
                    "is_saved": is_saved,
                }
            
            logger.info(f"Session {session_id} not found in Lakebase")
            return None
            
    except Exception as e:
        logger.error(f"Error loading session from Lakebase: {e}", exc_info=True)
        return None


def delete_session(session_id: str) -> bool:
    """Delete a session from Lakebase"""
    if not is_lakebase_configured():
        return False
    
    table_name = _get_sessions_table_name()
    
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"DELETE FROM {table_name} WHERE session_id = %s",
                (session_id,)
            )
            conn.commit()
            cursor.close()
            logger.info(f"Session {session_id} deleted from Lakebase")
            return True
    except Exception as e:
        logger.error(f"Error deleting session from Lakebase: {e}", exc_info=True)
        return False


def get_user_sessions(created_by: str, limit: int = 50, saved_only: bool = True) -> List[Dict]:
    """
    Get list of sessions for a user, ordered by updated_at desc.
    
    Args:
        created_by: The user's email
        limit: Maximum number of sessions to return
        saved_only: If True, only return sessions that have been explicitly saved (have a session_name)
    """
    if not is_lakebase_configured():
        return []
    
    table_name = _get_sessions_table_name()
    
    try:
        with get_connection() as conn:
            cursor = _dict_cursor(conn)
            
            # Build query - if saved_only, filter to sessions with a name
            if saved_only:
                query = f"""
                SELECT 
                    session_id, session_name, session_description,
                    industry, industry_label, use_case, use_case_label,
                    current_step, feedback_rating,
                    created_by, created_at, updated_at
                FROM {table_name}
                WHERE created_by = %s
                  AND session_name IS NOT NULL 
                  AND session_name != ''
                  AND session_name != 'New Session'
                ORDER BY updated_at DESC
                LIMIT %s
                """
            else:
                query = f"""
                SELECT 
                    session_id, session_name, session_description,
                    industry, industry_label, use_case, use_case_label,
                    current_step, feedback_rating,
                    created_by, created_at, updated_at
                FROM {table_name}
                WHERE created_by = %s
                ORDER BY updated_at DESC
                LIMIT %s
                """
            
            cursor.execute(query, (created_by, limit))
            rows = cursor.fetchall()
            cursor.close()
            
            sessions = []
            for row in rows:
                created_at = row.get("created_at")
                updated_at = row.get("updated_at")
                if hasattr(created_at, 'strftime'):
                    created_at = created_at.strftime('%Y-%m-%d %H:%M:%S')
                if hasattr(updated_at, 'strftime'):
                    updated_at = updated_at.strftime('%Y-%m-%d %H:%M:%S')
                
                sessions.append({
                    "session_id": row["session_id"],
                    "session_name": row.get("session_name"),
                    "session_description": row.get("session_description"),
                    "industry": row.get("industry"),
                    "industry_label": row.get("industry_label"),
                    "use_case": row.get("use_case"),
                    "use_case_label": row.get("use_case_label"),
                    "current_step": row.get("current_step", 1),
                    "feedback_rating": row.get("feedback_rating"),
                    "created_by": row.get("created_by"),
                    "created_at": created_at,
                    "updated_at": updated_at,
                    "is_saved": bool(row.get("session_name") and row["session_name"] != "New Session"),
                })
            
            return sessions
            
    except Exception as e:
        logger.error(f"Error getting user sessions: {e}", exc_info=True)
        return []


def get_user_default_session(created_by: str) -> Optional[Dict]:
    """
    Get the user's default "New Session" - prioritizing the one with MOST PROGRESS.
    This ensures users don't lose their work if multiple sessions exist.
    
    Priority order:
    1. Session with highest current_step (most progress)
    2. Most recently updated (tie-breaker)
    
    Returns:
        Session data dict if found, None otherwise
    """
    if not is_lakebase_configured():
        logger.info(f"Lakebase not configured, cannot get default session for {created_by}")
        return None
    
    table_name = _get_sessions_table_name()
    logger.info(f"Looking for default session for user {created_by}")
    
    try:
        with get_connection() as conn:
            cursor = _dict_cursor(conn)
            
            # Find the "New Session" with MOST PROGRESS for this user
            # Simple and robust: order by current_step (progress), then recency
            # Avoid complex JSON operations in SQL that might fail
            query = f"""
            SELECT 
                session_id, industry, industry_label, use_case, use_case_label,
                session_name, session_description, feedback_rating, feedback_comment,
                prerequisites_completed, current_step, workshop_level, completed_steps, skipped_steps,
                step_1_prompt, step_prompts,
                COALESCE(session_parameters, '{{}}') as session_parameters,
                created_by, created_at, updated_at
            FROM {table_name}
            WHERE created_by = %s
              AND session_name = 'New Session'
            ORDER BY 
                current_step DESC,
                updated_at DESC
            LIMIT 1
            """
            
            cursor.execute(query, (created_by,))
            row = cursor.fetchone()
            cursor.close()
            
            if row:
                current_step = row.get('current_step', 1)
                logger.info(f"Found default session {row['session_id']} for user {created_by} (current_step={current_step})")
                
                # Parse completed_steps
                completed_steps = row.get("completed_steps")
                if completed_steps is None:
                    completed_steps = []
                elif isinstance(completed_steps, str):
                    try:
                        completed_steps = json.loads(completed_steps)
                    except:
                        completed_steps = []
                
                # Parse skipped_steps
                skipped_steps = row.get("skipped_steps")
                if skipped_steps is None:
                    skipped_steps = []
                elif isinstance(skipped_steps, str):
                    try:
                        skipped_steps = json.loads(skipped_steps)
                    except:
                        skipped_steps = []
                
                # Build step_prompts dict: step_1 from column + steps 2-20 from JSONB
                step_prompts = {}
                if row.get("step_1_prompt"):
                    step_prompts[1] = row["step_1_prompt"]
                
                # Merge in steps 2-20 from JSONB column
                step_prompts_jsonb = row.get("step_prompts")
                if step_prompts_jsonb:
                    # Handle both dict and string formats
                    if isinstance(step_prompts_jsonb, str):
                        try:
                            step_prompts_jsonb = json.loads(step_prompts_jsonb)
                        except:
                            step_prompts_jsonb = {}
                    
                    for step_str, prompt_text in step_prompts_jsonb.items():
                        try:
                            step_num = int(step_str)
                            if prompt_text:
                                step_prompts[step_num] = prompt_text
                        except ValueError:
                            pass  # Skip invalid keys
                
                # Format dates
                created_at = row.get("created_at")
                updated_at = row.get("updated_at")
                if hasattr(created_at, 'strftime'):
                    created_at = created_at.strftime('%Y-%m-%d %H:%M:%S')
                if hasattr(updated_at, 'strftime'):
                    updated_at = updated_at.strftime('%Y-%m-%d %H:%M:%S')
                
                # Parse session_parameters from JSONB
                session_params = row.get("session_parameters", {})
                if isinstance(session_params, str):
                    try:
                        session_params = json.loads(session_params) if session_params else {}
                    except:
                        session_params = {}
                
                return {
                    "session_id": row["session_id"],
                    "industry": row.get("industry"),
                    "industry_label": row.get("industry_label"),
                    "use_case": row.get("use_case"),
                    "use_case_label": row.get("use_case_label"),
                    "session_name": row.get("session_name"),
                    "session_description": row.get("session_description"),
                    "feedback_rating": row.get("feedback_rating"),
                    "feedback_comment": row.get("feedback_comment"),
                    "prerequisites_completed": row.get("prerequisites_completed", False),
                    "current_step": row.get("current_step", 1),
                    "workshop_level": row.get("workshop_level", "300"),
                    "completed_steps": completed_steps,
                    "skipped_steps": skipped_steps,
                    "step_prompts": step_prompts,
                    "session_parameters": session_params,
                    "created_by": row.get("created_by"),
                    "created_at": created_at,
                    "updated_at": updated_at,
                    "is_saved": False,  # New Session is never "saved"
                }
            else:
                logger.info(f"No default session found for user {created_by}")
                return None
                
    except Exception as e:
        logger.error(f"Error getting default session: {e}", exc_info=True)
        return None


def delete_user_unsaved_sessions(created_by: str, keep_session_id: str = None) -> int:
    """
    Delete all unsaved "New Session" entries for a user.
    Optionally keep one specific session.
    
    This ensures only ONE unsaved session per user exists at any time.
    
    Args:
        created_by: User email
        keep_session_id: Optional session ID to keep (don't delete this one)
    
    Returns:
        Number of sessions deleted
    """
    if not is_lakebase_configured():
        return 0
    
    table_name = _get_sessions_table_name()
    logger.info(f"Cleaning up unsaved sessions for user {created_by}")
    
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            
            if keep_session_id:
                # Delete all "New Session" except the one to keep
                sql = f"""
                DELETE FROM {table_name}
                WHERE created_by = %s
                  AND session_name = 'New Session'
                  AND session_id != %s
                """
                cursor.execute(sql, (created_by, keep_session_id))
            else:
                # Delete all "New Session" for this user
                sql = f"""
                DELETE FROM {table_name}
                WHERE created_by = %s
                  AND session_name = 'New Session'
                """
                cursor.execute(sql, (created_by,))
            
            deleted_count = cursor.rowcount
            conn.commit()
            cursor.close()
            
            if deleted_count > 0:
                logger.info(f"Deleted {deleted_count} unsaved session(s) for user {created_by}")
            return deleted_count
            
    except Exception as e:
        logger.error(f"Error deleting unsaved sessions: {e}", exc_info=True)
        return 0


def update_step_prompt(session_id: str, step_number: int, prompt_text: str, workshop_level: str = None) -> bool:
    """
    Update a specific step's generated prompt for a session.
    Step 1 is stored in step_1_prompt column, steps 2-30 are stored in step_prompts JSONB.
    Optionally updates workshop_level if provided (to piggyback on progress saves).
    """
    if not is_lakebase_configured():
        return False
    
    if not 1 <= step_number <= 30:
        logger.error(f"Invalid step number: {step_number}")
        return False
    
    table_name = _get_sessions_table_name()
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            
            if step_number == 1:
                # Step 1: Use dedicated column
                if workshop_level:
                    sql = f"""
                    UPDATE {table_name}
                    SET step_1_prompt = %s, workshop_level = %s, updated_at = %s
                    WHERE session_id = %s
                    """
                    cursor.execute(sql, (prompt_text, workshop_level, now, session_id))
                else:
                    sql = f"""
                    UPDATE {table_name}
                    SET step_1_prompt = %s, updated_at = %s
                    WHERE session_id = %s
                    """
                    cursor.execute(sql, (prompt_text, now, session_id))
            else:
                # Steps 2-20: Use JSONB column with merge operator
                # This merges the new key into existing JSONB without overwriting other keys
                step_key = str(step_number)
                step_data_json = json.dumps({step_key: prompt_text})
                
                if workshop_level:
                    sql = f"""
                    UPDATE {table_name}
                    SET step_prompts = COALESCE(step_prompts, '{{}}'::jsonb) || %s::jsonb,
                        workshop_level = %s,
                        updated_at = %s
                    WHERE session_id = %s
                    """
                    cursor.execute(sql, (step_data_json, workshop_level, now, session_id))
                else:
                    sql = f"""
                    UPDATE {table_name}
                    SET step_prompts = COALESCE(step_prompts, '{{}}'::jsonb) || %s::jsonb,
                        updated_at = %s
                    WHERE session_id = %s
                    """
                    cursor.execute(sql, (step_data_json, now, session_id))
            
            conn.commit()
            cursor.close()
            logger.info(f"Updated step {step_number} prompt for session {session_id}")
            return True
            
    except Exception as e:
        logger.error(f"Error updating step prompt: {e}", exc_info=True)
        return False


# =============================================================================
# Leaderboard Scoring System
# =============================================================================

# Scoring configuration: Points per step based on chapter difficulty
# Later chapters = harder = more points
STEP_SCORES = {
    # Foundation (steps 1-3): 10 points each
    1: 10, 2: 10, 3: 10,
    # Chapter 1 - Databricks App (steps 4-5): 20 points each
    4: 20, 5: 20,
    # Chapter 2 - Lakebase (steps 6-8): 30 points each
    6: 30, 7: 30, 8: 30,
    # Chapter 3 - Lakehouse (steps 9-14, 22): 40 points each
    9: 40, 10: 40, 11: 40, 12: 40, 13: 40, 14: 40, 22: 40,
    # Chapter 4 - Data Intelligence (steps 15-19): 50 points each
    15: 50, 16: 50, 17: 50, 18: 50, 19: 50,
    # Refinement (steps 20-21): 60 points each
    20: 60, 21: 60,
    # Agent Skills (steps 26-30): 40 points each
    26: 40, 27: 40, 28: 40, 29: 40, 30: 40,
}

# Chapter definitions for progress tracking
CHAPTERS = {
    'Foundation': {'steps': {1, 2, 3}, 'display': 'Foundation'},
    'Chapter 1': {'steps': {4, 5}, 'display': 'Databricks App'},
    'Chapter 2': {'steps': {6, 7, 8}, 'display': 'Lakebase'},
    'Chapter 3': {'steps': {9, 10, 11, 12, 13, 14, 22}, 'display': 'Lakehouse'},
    'Chapter 4': {'steps': {15, 16, 17, 18, 19}, 'display': 'Data Intelligence'},
    'Refinement': {'steps': {20, 21}, 'display': 'Refinement'},
    'Agent Skills': {'steps': {26, 27, 28, 29, 30}, 'display': 'Agent Skills'},
}

# Emoji avatar pool for leaderboard display
AVATAR_EMOJIS = ['🦊', '🐙', '🦄', '🐼', '🦉', '🐬', '🦁', '🐸', '🦋', '🐯', '🦈', '🐨', '🦩', '🐻', '🦖']


def _calculate_score(completed_steps: List[int], skipped_steps: List[int] = None) -> int:
    """Calculate total score from completed steps. Skipped steps earn 0."""
    skipped = set(skipped_steps) if skipped_steps else set()
    return sum(STEP_SCORES.get(step, 0) for step in completed_steps if step not in skipped)


def _get_chapter_status(completed_steps: List[int], skipped_steps: List[int] = None) -> tuple:
    """
    Determine which chapters are completed and which are in progress.
    Skipped steps count as "done" for chapter completion check.
    
    Returns:
        Tuple of (completed_chapters: list, in_progress_chapters: list)
    """
    completed_set = set(completed_steps)
    skipped_set = set(skipped_steps) if skipped_steps else set()
    done_set = completed_set | skipped_set
    completed_chapters = []
    in_progress_chapters = []
    
    for chapter_name, chapter_info in CHAPTERS.items():
        chapter_steps = chapter_info['steps']
        done_in_chapter = done_set & chapter_steps
        
        if done_in_chapter == chapter_steps:
            completed_chapters.append(chapter_info['display'])
        elif done_in_chapter:
            in_progress_chapters.append(chapter_info['display'])
    
    return completed_chapters, in_progress_chapters


def _format_display_name(email: str) -> str:
    """
    Convert email to display name format: "First L."
    Examples:
        john.doe@company.com -> "John D."
        jane_smith@email.com -> "Jane S."
        singlename@test.com -> "Singlename"
    """
    if not email or '@' not in email:
        return email or "Anonymous"
    
    # Get the part before @
    name_part = email.split('@')[0]
    
    # Split on common separators (., _, -)
    import re
    parts = re.split(r'[._\-]', name_part)
    parts = [p for p in parts if p]  # Remove empty strings
    
    if len(parts) >= 2:
        first_name = parts[0].capitalize()
        last_initial = parts[1][0].upper() if parts[1] else ""
        return f"{first_name} {last_initial}."
    elif parts:
        return parts[0].capitalize()
    
    return name_part.capitalize()


def _get_avatar_for_user(email: str) -> str:
    """
    Get a consistent emoji avatar for a user based on their email.
    Uses hash to ensure same user always gets same avatar.
    """
    if not email:
        return AVATAR_EMOJIS[0]
    
    # Use hash of email to get consistent avatar
    hash_value = hash(email.lower())
    index = abs(hash_value) % len(AVATAR_EMOJIS)
    return AVATAR_EMOJIS[index]


def get_leaderboard(limit: int = 10) -> List[Dict]:
    """
    Get leaderboard data showing top users by score.
    
    For users with multiple sessions, uses the session with the highest score.
    Ties are broken by earliest updated_at (completed first = higher rank).
    
    Args:
        limit: Maximum number of entries to return (default 10)
    
    Returns:
        List of leaderboard entries with rank, display_name, score, chapters, etc.
    """
    if not is_lakebase_configured():
        logger.info("Lakebase not configured - returning empty leaderboard")
        return []
    
    table_name = _get_sessions_table_name()
    logger.info(f"Fetching leaderboard from {table_name}")
    
    try:
        with get_connection() as conn:
            cursor = _dict_cursor(conn)
            
            # Get all sessions with completed_steps
            # We'll process scoring in Python for flexibility
            query = f"""
            SELECT 
                created_by,
                completed_steps,
                skipped_steps,
                updated_at,
                workshop_level
            FROM {table_name}
            WHERE created_by IS NOT NULL 
              AND created_by != ''
              AND completed_steps IS NOT NULL
              AND completed_steps != '[]'
            ORDER BY created_by, updated_at DESC
            """
            
            cursor.execute(query)
            rows = cursor.fetchall()
            cursor.close()
            
            # Aggregate by user - keep session with highest score
            user_scores = {}  # email -> {score, completed_steps, updated_at}
            
            for row in rows:
                email = row.get('created_by', '')
                if not email:
                    continue
                
                # Parse completed_steps
                completed_steps_raw = row.get('completed_steps', '[]')
                try:
                    if isinstance(completed_steps_raw, str):
                        completed_steps = json.loads(completed_steps_raw)
                    else:
                        completed_steps = completed_steps_raw or []
                except:
                    completed_steps = []
                
                if not completed_steps:
                    continue
                
                # Parse skipped_steps
                skipped_steps_raw = row.get('skipped_steps', '[]')
                try:
                    if isinstance(skipped_steps_raw, str):
                        skipped_steps = json.loads(skipped_steps_raw)
                    else:
                        skipped_steps = skipped_steps_raw or []
                except:
                    skipped_steps = []
                
                score = _calculate_score(completed_steps, skipped_steps)
                updated_at = row.get('updated_at')
                
                workshop_level = row.get('workshop_level')
                
                # Keep the best session for each user
                if email not in user_scores or score > user_scores[email]['score']:
                    user_scores[email] = {
                        'score': score,
                        'completed_steps': completed_steps,
                        'skipped_steps': skipped_steps,
                        'updated_at': updated_at,
                        'workshop_level': workshop_level,
                    }
                elif score == user_scores[email]['score']:
                    if updated_at and user_scores[email]['updated_at']:
                        if updated_at < user_scores[email]['updated_at']:
                            user_scores[email] = {
                                'score': score,
                                'completed_steps': completed_steps,
                                'skipped_steps': skipped_steps,
                                'updated_at': updated_at,
                                'workshop_level': workshop_level,
                            }
            
            # Sort by score DESC, then updated_at ASC (ties broken by earliest completion)
            sorted_users = sorted(
                user_scores.items(),
                key=lambda x: (-x[1]['score'], x[1]['updated_at'] or datetime.max)
            )
            
            # Build leaderboard entries
            leaderboard = []
            for rank, (email, data) in enumerate(sorted_users[:limit], start=1):
                completed_chapters, in_progress_chapters = _get_chapter_status(data['completed_steps'], data.get('skipped_steps', []))
                
                # Format updated_at
                updated_at = data['updated_at']
                if hasattr(updated_at, 'isoformat'):
                    updated_at = updated_at.isoformat()
                elif hasattr(updated_at, 'strftime'):
                    updated_at = updated_at.strftime('%Y-%m-%dT%H:%M:%S')
                
                leaderboard.append({
                    'rank': rank,
                    'user_id': email,  # Used for tracking movement
                    'display_name': _format_display_name(email),
                    'avatar': _get_avatar_for_user(email),
                    'score': data['score'],
                    'completed_steps': sorted(data['completed_steps']),
                    'skipped_steps': sorted(data.get('skipped_steps', [])),
                    'completed_chapters': completed_chapters,
                    'in_progress_chapters': in_progress_chapters,
                    'updated_at': updated_at,
                    'workshop_level': data.get('workshop_level'),
                })
            
            logger.info(f"Leaderboard: {len(leaderboard)} entries returned")
            return leaderboard
            
    except Exception as e:
        logger.error(f"Error fetching leaderboard: {e}", exc_info=True)
        return []


_WORKSHOP_LEVEL_LABELS: Dict[str, str] = {
    'app-only': 'Databricks Apps',
    'app-database': '+ Lakebase',
    'lakehouse': 'Lakehouse',
    'lakehouse-di': '+ Data Intelligence',
    'end-to-end': 'Complete Workshop',
    'accelerator': 'Data Product Accelerator',
    'genie-accelerator': 'Genie Accelerator',
    'data-engineering-accelerator': 'Data Engineering Accelerator',
    'skills-accelerator': 'Skills Accelerator',
}


def get_workshop_users() -> Dict:
    """
    Get all distinct users with their most recent session details.
    
    Returns:
        Dict with total count and list of users, each including
        display_name, email, workshop_level, updated_at,
        last_session_id, and is_saved.
    """
    if not is_lakebase_configured():
        return {'total': 0, 'users': []}
    
    table_name = _get_sessions_table_name()
    
    try:
        with get_connection() as conn:
            cursor = _dict_cursor(conn)
            cursor.execute(f"""
                SELECT DISTINCT ON (created_by)
                    created_by,
                    workshop_level,
                    updated_at,
                    session_id,
                    session_name
                FROM {table_name}
                WHERE created_by IS NOT NULL AND created_by != ''
                ORDER BY created_by, updated_at DESC
            """)
            rows = cursor.fetchall()
            cursor.close()
            
            users = []
            for row in rows:
                email = row.get('created_by', '')
                if not email:
                    continue
                level = row.get('workshop_level') or ''
                updated_at = row.get('updated_at')
                if hasattr(updated_at, 'isoformat'):
                    updated_at = updated_at.isoformat()
                elif hasattr(updated_at, 'strftime'):
                    updated_at = updated_at.strftime('%Y-%m-%dT%H:%M:%S')
                session_name = row.get('session_name') or ''
                users.append({
                    'display_name': _format_display_name(email),
                    'email': email,
                    'workshop_level': level,
                    'workshop_level_label': _WORKSHOP_LEVEL_LABELS.get(level, level or 'Unknown'),
                    'updated_at': updated_at,
                    'last_session_id': row.get('session_id') or '',
                    'is_saved': bool(session_name and session_name != 'New Session'),
                })
            
            return {'total': len(users), 'users': users}
    
    except Exception as e:
        logger.error(f"Error fetching workshop users: {e}", exc_info=True)
        return {'total': 0, 'users': []}


def cleanup_session_steps() -> Dict[str, int]:
    """
    Clean up session data:
    1. Replace step 41 with step 4 in all completed_steps arrays
    2. Update current_step to be max(completed_steps) for each session
    
    Returns:
        Dict with counts: {'sessions_fixed': n, 'step_41_replaced': n}
    """
    if not is_lakebase_configured():
        logger.warning("Lakebase not configured - cannot cleanup sessions")
        return {'sessions_fixed': 0, 'step_41_replaced': 0}
    
    table_name = _get_sessions_table_name()
    logger.info(f"Starting session cleanup on {table_name}")
    
    stats = {'sessions_fixed': 0, 'step_41_replaced': 0}
    
    try:
        with get_connection() as conn:
            cursor = _dict_cursor(conn)
            
            # Get all sessions with completed_steps
            query = f"""
            SELECT session_id, completed_steps, current_step
            FROM {table_name}
            WHERE completed_steps IS NOT NULL
            """
            
            cursor.execute(query)
            rows = cursor.fetchall()
            
            for row in rows:
                session_id = row['session_id']
                completed_steps_raw = row.get('completed_steps', '[]')
                current_step = row.get('current_step', 1)
                
                # Parse completed_steps
                try:
                    if isinstance(completed_steps_raw, str):
                        completed_steps = json.loads(completed_steps_raw)
                    else:
                        completed_steps = completed_steps_raw or []
                except:
                    completed_steps = []
                
                if not completed_steps:
                    continue
                
                needs_update = False
                
                # Fix step 41 -> 4
                if 41 in completed_steps:
                    completed_steps = [4 if s == 41 else s for s in completed_steps]
                    # Remove duplicates while preserving order
                    seen = set()
                    completed_steps = [s for s in completed_steps if not (s in seen or seen.add(s))]
                    stats['step_41_replaced'] += 1
                    needs_update = True
                
                # Fix current_step to be max of completed_steps
                if completed_steps:
                    correct_current_step = max(completed_steps)
                    if current_step != correct_current_step:
                        current_step = correct_current_step
                        needs_update = True
                
                # Update if needed
                if needs_update:
                    update_cursor = conn.cursor()
                    update_sql = f"""
                    UPDATE {table_name}
                    SET completed_steps = %s,
                        current_step = %s,
                        updated_at = %s
                    WHERE session_id = %s
                    """
                    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
                    update_cursor.execute(update_sql, (
                        json.dumps(completed_steps),
                        current_step,
                        now,
                        session_id
                    ))
                    update_cursor.close()
                    stats['sessions_fixed'] += 1
            
            conn.commit()
            cursor.close()
            
            logger.info(f"Session cleanup complete: {stats}")
            return stats
            
    except Exception as e:
        logger.error(f"Error during session cleanup: {e}", exc_info=True)
        return stats


# =============================================================================
# SAVED USE CASE DESCRIPTIONS (Build Your Use Case [Beta])
# =============================================================================

def save_usecase_builder_description(
    created_by: str,
    display_name: str,
    industry: str,
    use_case_name: str,
    description: str
) -> Optional[int]:
    """Save a new use case description to the community library. Returns the new row id."""
    try:
        config = _get_config()
        schema = config["schema"]
        table_name = f"{schema}.saved_usecase_descriptions"
        
        with get_connection() as conn:
            cursor = conn.cursor()
            insert_sql = f"""
            INSERT INTO {table_name} (created_by, display_name, updated_by, industry, use_case_name, description)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """
            cursor.execute(insert_sql, (created_by, display_name, created_by, industry, use_case_name, description))
            row = cursor.fetchone()
            conn.commit()
            cursor.close()
            new_id = row[0] if row else None
            logger.info(f"Saved use case description id={new_id} by {created_by}")
            return new_id
    except Exception as e:
        logger.error(f"Error saving use case description: {e}", exc_info=True)
        return None


def get_all_saved_usecases() -> List[Dict[str, Any]]:
    """Get all active saved use case descriptions (community library)."""
    try:
        config = _get_config()
        schema = config["schema"]
        table_name = f"{schema}.saved_usecase_descriptions"
        
        with get_connection() as conn:
            cursor = conn.cursor()
            select_sql = f"""
            SELECT id, created_by, display_name, updated_by, industry, use_case_name,
                   description, version, created_at, updated_at
            FROM {table_name}
            WHERE is_active = TRUE
            ORDER BY updated_at DESC
            """
            cursor.execute(select_sql)
            rows = cursor.fetchall()
            cursor.close()
            
            results = []
            for row in rows:
                results.append({
                    "id": row[0],
                    "created_by": row[1],
                    "display_name": row[2] or _format_display_name(row[1]),
                    "updated_by": row[3],
                    "industry": row[4],
                    "use_case_name": row[5],
                    "description": row[6],
                    "version": row[7],
                    "created_at": row[8].isoformat() if row[8] else None,
                    "updated_at": row[9].isoformat() if row[9] else None,
                })
            logger.info(f"Retrieved {len(results)} saved use case descriptions")
            return results
    except Exception as e:
        logger.error(f"Error getting saved use cases: {e}", exc_info=True)
        return []


def update_saved_usecase(
    uc_id: int,
    updated_by: str,
    industry: Optional[str] = None,
    use_case_name: Optional[str] = None,
    description: Optional[str] = None
) -> bool:
    """Update a saved use case description. Any user can edit (collaborative)."""
    try:
        config = _get_config()
        schema = config["schema"]
        table_name = f"{schema}.saved_usecase_descriptions"
        
        set_clauses = ["updated_by = %s", "updated_at = CURRENT_TIMESTAMP"]
        params: list = [updated_by]
        
        if industry is not None:
            set_clauses.append("industry = %s")
            params.append(industry)
        if use_case_name is not None:
            set_clauses.append("use_case_name = %s")
            params.append(use_case_name)
        if description is not None:
            set_clauses.append("description = %s")
            params.append(description)
        
        params.append(uc_id)
        
        with get_connection() as conn:
            cursor = conn.cursor()
            update_sql = f"""
            UPDATE {table_name}
            SET {', '.join(set_clauses)}
            WHERE id = %s AND is_active = TRUE
            """
            cursor.execute(update_sql, params)
            affected = cursor.rowcount
            conn.commit()
            cursor.close()
            logger.info(f"Updated use case id={uc_id} by {updated_by}, affected={affected}")
            return affected > 0
    except Exception as e:
        logger.error(f"Error updating use case id={uc_id}: {e}", exc_info=True)
        return False


def delete_saved_usecase(uc_id: int) -> bool:
    """Soft-delete a saved use case description (set is_active=FALSE)."""
    try:
        config = _get_config()
        schema = config["schema"]
        table_name = f"{schema}.saved_usecase_descriptions"
        
        with get_connection() as conn:
            cursor = conn.cursor()
            delete_sql = f"""
            UPDATE {table_name}
            SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND is_active = TRUE
            """
            cursor.execute(delete_sql, (uc_id,))
            affected = cursor.rowcount
            conn.commit()
            cursor.close()
            logger.info(f"Soft-deleted use case id={uc_id}, affected={affected}")
            return affected > 0
    except Exception as e:
        logger.error(f"Error deleting use case id={uc_id}: {e}", exc_info=True)
        return False

