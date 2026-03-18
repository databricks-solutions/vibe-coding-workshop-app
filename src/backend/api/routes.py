"""
API Routes for Vibe Coding Workshop Application
All UI data is served from these endpoints

Configuration is loaded from:
  - Lakebase tables (PostgreSQL) for industries, use_cases, usecase_descriptions, section_input_prompts
  - prompts_config.yaml for workflow_steps and prerequisites (UI-only config)
  
The system uses Lakebase as the primary source of truth with YAML fallback.
"""

import os
import json
import logging
import time
import yaml
from pathlib import Path
import uuid
import shutil
from fastapi import APIRouter, HTTPException, Response, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, AsyncGenerator
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION SOURCE (Lakebase + YAML fallback)
# =============================================================================

# Lakebase configuration (PostgreSQL tables)
USE_LAKEBASE = os.getenv("USE_LAKEBASE", "true").lower() == "true"

# Import Lakebase service
try:
    from src.backend.services.lakebase import (
        is_lakebase_configured,
        execute_query,
        execute_insert,
        get_schema,
        PSYCOPG2_AVAILABLE
    )
    LAKEBASE_SERVICE_AVAILABLE = True
except ImportError:
    LAKEBASE_SERVICE_AVAILABLE = False
    PSYCOPG2_AVAILABLE = False
    logger.warning("Lakebase service not available - using YAML fallback")
    
    def is_lakebase_configured():
        return False
    def execute_query(sql, params=None):
        return []
    def execute_insert(sql, params=None):
        return False
    def get_schema():
        return os.getenv("LAKEBASE_SCHEMA", "")

# YAML fallback path (for workflow_steps, prerequisites, and fallback data)
CONFIG_PATH = Path(__file__).parent.parent / "prompts_config.yaml"

# Cache for Lakebase data
_lakebase_cache = {
    "usecase_descriptions": None,
    "section_input_prompts": None,
    "last_refresh": None
}

# Cache TTL in seconds (refresh every 30 seconds for faster updates)
CACHE_TTL = 30

def clear_lakebase_cache():
    """Clear the Lakebase cache to force a refresh on next request."""
    global _lakebase_cache
    _lakebase_cache = {
        "usecase_descriptions": None,
        "section_input_prompts": None,
        "last_refresh": None
    }
    logger.info("Lakebase cache cleared")

def load_yaml_config() -> Dict:
    """Load configuration from YAML file (fallback + UI config)."""
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except Exception as e:
        logger.error(f"Failed to load config from {CONFIG_PATH}: {e}")
        return {}

# Load YAML config at startup (for workflow_steps and prerequisites)
_yaml_config = load_yaml_config()

def get_yaml_config() -> Dict:
    """Get the loaded YAML configuration."""
    global _yaml_config
    if not _yaml_config:
        _yaml_config = load_yaml_config()
    return _yaml_config

# =============================================================================
# LAKEBASE DATA ACCESS (using PostgreSQL/psycopg2)
# =============================================================================

def _invalidate_lakebase_cache():
    """Invalidate the Lakebase cache to force a refresh on next access."""
    global _lakebase_cache
    _lakebase_cache["last_refresh"] = None
    logger.info("[Cache] Lakebase cache invalidated - will refresh on next access")

def _refresh_lakebase_cache():
    """Refresh Lakebase data from PostgreSQL tables."""
    import time
    
    global _lakebase_cache
    
    # Check if cache is still valid
    if _lakebase_cache["last_refresh"]:
        elapsed = time.time() - _lakebase_cache["last_refresh"]
        if elapsed < CACHE_TTL:
            return  # Cache is still valid
    
    if not LAKEBASE_SERVICE_AVAILABLE or not is_lakebase_configured():
        logger.info("Lakebase not configured - using YAML fallback")
        return
    
    schema = get_schema()
    
    try:
        # Fetch latest usecase_descriptions (PostgreSQL syntax with DISTINCT ON)
        usecase_desc_sql = f"""
            SELECT DISTINCT ON (industry, use_case)
                industry, industry_label, use_case, use_case_label, prompt_template, version
            FROM {schema}.usecase_descriptions
            WHERE is_active = TRUE
            ORDER BY industry, use_case, version DESC
        """
        usecase_descriptions = execute_query(usecase_desc_sql)
        
        if usecase_descriptions:
            _lakebase_cache["usecase_descriptions"] = usecase_descriptions
            
            # Fetch latest section_input_prompts (PostgreSQL syntax with DISTINCT ON)
            section_prompts_sql = f"""
                SELECT DISTINCT ON (section_tag)
                    section_tag, input_template, system_prompt, section_title, section_description, 
                    order_number, version, how_to_apply, expected_output, bypass_llm,
                    how_to_apply_images, expected_output_images
                FROM {schema}.section_input_prompts
                WHERE is_active = TRUE
                ORDER BY section_tag, version DESC
            """
            section_prompts = execute_query(section_prompts_sql)
            
            if section_prompts:
                _lakebase_cache["section_input_prompts"] = section_prompts
            
            _lakebase_cache["last_refresh"] = time.time()
            logger.info(f"Lakebase cache refreshed: {len(_lakebase_cache['usecase_descriptions'])} use cases, {len(_lakebase_cache.get('section_input_prompts', []))} section prompts")
        else:
            logger.info("No data from Lakebase - tables may not exist yet, using YAML fallback")
        
    except Exception as e:
        logger.warning(f"Failed to refresh Lakebase cache: {e}")

def get_usecase_descriptions_from_lakebase() -> List[Dict]:
    """Get use case descriptions from Lakebase cache or refresh if needed."""
    if USE_LAKEBASE and LAKEBASE_SERVICE_AVAILABLE:
        schema = get_schema()
        logger.info(f"[DB Connection] Fetching configurations from Lakebase schema: {schema}")
        _refresh_lakebase_cache()
        if _lakebase_cache["usecase_descriptions"]:
            logger.info(f"[Lakebase] Loaded {len(_lakebase_cache['usecase_descriptions'])} use case descriptions from database")
            return _lakebase_cache["usecase_descriptions"]
    return None  # Fallback to YAML

def get_section_input_prompts_from_lakebase() -> List[Dict]:
    """Get section input prompts from Lakebase cache or refresh if needed."""
    if USE_LAKEBASE and LAKEBASE_SERVICE_AVAILABLE:
        schema = get_schema()
        logger.info(f"[DB Connection] Fetching section input prompts from Lakebase schema: {schema}")
        _refresh_lakebase_cache()
        if _lakebase_cache["section_input_prompts"]:
            logger.info(f"[Lakebase] Loaded {len(_lakebase_cache['section_input_prompts'])} section input prompts from database")
            return _lakebase_cache["section_input_prompts"]
    return None  # Fallback to YAML

# =============================================================================
# UNIFIED CONFIG ACCESS (Lakebase with YAML fallback)
# =============================================================================

def get_config() -> Dict:
    """Get configuration - uses Lakebase for dynamic content, YAML for UI config."""
    return get_yaml_config()  # For backward compatibility

# Databricks SDK - handles authentication automatically when running as Databricks App
try:
    from databricks.sdk import WorkspaceClient
    DATABRICKS_SDK_AVAILABLE = True
except ImportError:
    DATABRICKS_SDK_AVAILABLE = False
    WorkspaceClient = None
    logger.warning("Databricks SDK not available - LLM features will use mock responses")

# ============== Databricks Configuration ==============

# When running as a Databricks App, the SDK automatically uses OAuth credentials
# injected by the platform - no token needed!

# Default serving endpoint - can be overridden via environment variable
# Common endpoint names in Databricks workspaces:
# - databricks-meta-llama-3-1-70b-instruct (Foundation Model API)
# - databricks-dbrx-instruct (Foundation Model API)
# - databricks-mixtral-8x7b-instruct (Foundation Model API)
# - Custom endpoints deployed in your workspace
# Default endpoint (Claude Sonnet 4.5)
SERVING_ENDPOINT_NAME = os.getenv("DATABRICKS_SERVING_ENDPOINT", "databricks-claude-sonnet-4-5")

# Fallback endpoints to try if the default doesn't work
FALLBACK_ENDPOINTS = [
    "databricks-meta-llama-3-1-70b-instruct",
    "databricks-meta-llama-3-70b-instruct", 
    "databricks-dbrx-instruct",
    "databricks-mixtral-8x7b-instruct",
    "databricks-llama-2-70b-chat",
]

# Initialize WorkspaceClient - automatically handles auth when running as Databricks App
# Uses OAuth from environment when deployed, falls back to config file for local dev
_workspace_client = None
_available_endpoints_cache = None

def get_workspace_client() -> Optional['WorkspaceClient']:
    """
    Get or create the Databricks WorkspaceClient.
    When running as a Databricks App, authentication is automatic via OAuth.
    """
    global _workspace_client
    if _workspace_client is None and DATABRICKS_SDK_AVAILABLE:
        try:
            # The SDK automatically detects the environment:
            # - In Databricks Apps: Uses app's OAuth credentials (no token needed)
            # - In local dev: Uses ~/.databrickscfg or environment variables
            _workspace_client = WorkspaceClient()
            logger.info("Databricks WorkspaceClient initialized")
        except Exception as e:
            logger.warning(f"Could not initialize WorkspaceClient: {e}")
            import traceback
            logger.warning(f"  Traceback: {traceback.format_exc()}")
    return _workspace_client


def get_available_serving_endpoints() -> List[str]:
    """
    Get list of available serving endpoints in the workspace.
    Results are cached to avoid repeated API calls.
    """
    global _available_endpoints_cache
    
    if _available_endpoints_cache is not None:
        return _available_endpoints_cache
    
    client = get_workspace_client()
    if not client:
        logger.warning("Cannot list endpoints - WorkspaceClient not available")
        return []
    
    try:
        logger.info("Fetching available serving endpoints from workspace...")
        endpoints = client.serving_endpoints.list()
        endpoint_names = [ep.name for ep in endpoints if ep.name]
        _available_endpoints_cache = endpoint_names
        logger.info(f"Found {len(endpoint_names)} serving endpoints: {endpoint_names}")
        return endpoint_names
    except Exception as e:
        logger.error(f"Error listing serving endpoints: {e}")
        return []


def get_best_available_endpoint() -> Optional[str]:
    """
    Find the best available endpoint to use.
    Priority:
    1. Environment variable DATABRICKS_SERVING_ENDPOINT
    2. First available endpoint from FALLBACK_ENDPOINTS list
    3. Any available endpoint in the workspace
    """
    # Check if configured endpoint is set
    if SERVING_ENDPOINT_NAME:
        logger.info(f"Using configured endpoint: {SERVING_ENDPOINT_NAME}")
        return SERVING_ENDPOINT_NAME
    
    # Get available endpoints
    available = get_available_serving_endpoints()
    
    if not available:
        logger.warning("No serving endpoints available in workspace")
        return None
    
    # Try fallback endpoints in order
    for fallback in FALLBACK_ENDPOINTS:
        if fallback in available:
            logger.info(f"Using fallback endpoint: {fallback}")
            return fallback
    
    # Use first available endpoint
    first_available = available[0]
    logger.info(f"Using first available endpoint: {first_available}")
    return first_available

# ============== Data Models ==============

class SelectOption(BaseModel):
    value: str
    label: str

class Industry(BaseModel):
    value: str
    label: str

class UseCase(BaseModel):
    value: str
    label: str

class ImageMetadata(BaseModel):
    """Metadata for an uploaded image"""
    id: str
    filename: str
    path: str
    uploaded_at: str
    uploaded_by: Optional[str] = None

class GeneratedContent(BaseModel):
    prompt: str
    input: str
    input_template: Optional[str] = None  # Raw input template with variables for user reference
    how_to_apply: Optional[str] = None  # Instructions on how to apply the generated prompt
    expected_output: Optional[str] = None  # Sample expected output with links/images
    how_to_apply_images: List[ImageMetadata] = []  # Images for "How to Apply" section
    expected_output_images: List[ImageMetadata] = []  # Images for "Expected Output" section
    source: Optional[str] = None  # 'llm_generated', 'mock_llm', 'input_only_no_llm', 'fallback_due_to_error'
    model: Optional[str] = None   # Model name used (if LLM was called)
    usage: Optional[Dict[str, int]] = None  # Token usage stats
    error: Optional[str] = None   # Error message if there was a fallback

class PromptRequest(BaseModel):
    industry: str
    use_case: str
    section_tag: str
    use_llm: bool = True  # If True, generates prompt using LLM; if False, returns input as prompt
    previous_outputs: Optional[Dict[str, str]] = None  # Outputs from previous steps, e.g., {"prd_document": "..."}
    session_id: Optional[str] = None  # If provided, uses session-specific parameter overrides

class TestPromptRequest(BaseModel):
    """Request model for testing prompt generation with custom values (used in Configuration page)"""
    industry: str = "sample"  # Default to sample industry for testing
    use_case: str = "booking_app"  # Default to booking app for testing
    section_tag: str  # Which section this is for (used for variable substitution)
    system_prompt: str  # Custom system prompt to test
    input_template: str  # Custom input template to test
    bypass_llm: bool = False  # If True, return input_template as-is without LLM processing

class MetadataCsvRequest(BaseModel):
    """Request model for processing uploaded schema metadata CSV"""
    csv_content: str
    session_id: Optional[str] = None
    industry: str = "sample"
    use_case: str = "booking_app"
    section_tag: str = "bronze_table_metadata_upload"

class LLMRequest(BaseModel):
    """Request model for LLM endpoint calls"""
    prompt: str
    max_tokens: int = 2048
    temperature: float = 0.7
    endpoint_name: Optional[str] = None  # Override default endpoint

class LLMResponse(BaseModel):
    """Response model from LLM endpoint"""
    response: str
    model: str
    usage: Optional[Dict[str, int]] = None

class EnhancedPromptRequest(BaseModel):
    """Request to generate and optionally enhance prompt with LLM"""
    industry: str
    use_case: str
    section_tag: str
    enhance_with_llm: bool = False
    custom_instructions: Optional[str] = None

class WorkflowStep(BaseModel):
    id: int
    icon: str
    title: str
    description: str
    color: str
    input: Optional[str] = None
    section_tag: str
    option_label: Optional[str] = None

class Prerequisite(BaseModel):
    id: int
    icon: str
    icon_color: str
    title: str
    description: str
    links: List[Dict[str, str]]
    command: Optional[str] = None
    is_optional: bool = False


# =============================================================================
# CONFIGURATION MANAGEMENT MODELS (Admin UI)
# =============================================================================

class PromptConfigCreate(BaseModel):
    """Request to create/update a prompt configuration (new version)"""
    industry: str = Field(..., min_length=1, description="Industry identifier")
    industry_label: str = Field(..., min_length=1, description="Display label for industry")
    use_case: str = Field(..., min_length=1, description="Use case identifier")
    use_case_label: str = Field(..., min_length=1, description="Display label for use case")
    prompt_template: str = Field(..., description="The prompt template text")


class PromptConfigResponse(BaseModel):
    """Response model for prompt configuration"""
    config_id: Optional[int] = None
    industry: str
    industry_label: str
    use_case: str
    use_case_label: str
    prompt_template: str
    version: int
    is_active: bool = True
    inserted_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_by: Optional[str] = None


class SectionInputCreate(BaseModel):
    """Request to create/update section input (new version)"""
    section_tag: str = Field(..., min_length=1, description="Section identifier")
    section_title: Optional[str] = Field(None, description="Display title")
    section_description: Optional[str] = Field(None, description="Brief description")
    input_template: str = Field(..., description="Input template text for LLM")
    system_prompt: str = Field(..., description="System prompt for LLM")
    order_number: Optional[int] = Field(None, description="Display order on UI (ascending)")
    how_to_apply: Optional[str] = Field(None, description="Instructions on how to apply the generated prompt")
    expected_output: Optional[str] = Field(None, description="Sample expected output with links/images")
    bypass_llm: Optional[bool] = Field(None, description="If True, return input_template as-is without LLM processing. None = inherit from previous version.")


class SectionInputResponse(BaseModel):
    """Response model for section input"""
    input_id: Optional[int] = None
    section_tag: str
    section_title: Optional[str] = None
    section_description: Optional[str] = None
    input_template: str
    system_prompt: str
    order_number: Optional[int] = None
    how_to_apply: Optional[str] = None
    expected_output: Optional[str] = None
    how_to_apply_images: List[ImageMetadata] = []
    expected_output_images: List[ImageMetadata] = []
    bypass_llm: bool = False  # If True, return input_template as-is without LLM processing
    step_enabled: bool = True
    version: int
    is_active: bool = True
    inserted_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_by: Optional[str] = None


class StepVisibilityUpdate(BaseModel):
    """Request to toggle a step's visibility"""
    enabled: bool = Field(..., description="Whether the step should be enabled")


class IndustryCreate(BaseModel):
    """Request to add a new industry"""
    industry: str = Field(..., min_length=1, description="Industry identifier (lowercase, no spaces)")
    industry_label: str = Field(..., min_length=1, description="Display label for the industry")


class UseCaseCreate(BaseModel):
    """Request to add a new use case under an industry"""
    industry: str = Field(..., min_length=1, description="Parent industry identifier")
    use_case: str = Field(..., min_length=1, description="Use case identifier (lowercase, no spaces)")
    use_case_label: str = Field(..., min_length=1, description="Display label for the use case")


class ConfigVersionInfo(BaseModel):
    """Version information for a configuration"""
    version: int
    inserted_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_by: Optional[str] = None
    is_active: bool = True


# ============== Data Store (Lakebase with YAML fallback) ==============

def get_industries() -> List[Dict]:
    """Get industries - from Lakebase or YAML fallback.
    
    Industries are controlled by the is_active flag in the database.
    The database query already filters to only return active use cases (is_active=TRUE).
    """
    # Custom label overrides (value -> label)
    label_overrides = {
        "sample": "sample [for enablement]"
    }
    
    # Priority order for industries (first in list = first in dropdown)
    priority_order = ["sample", "retail", "cpg", "travel"]
    
    # Try Lakebase first - data is already filtered by is_active=TRUE in the SQL query
    lakebase_data = get_usecase_descriptions_from_lakebase()
    if lakebase_data:
        # Extract unique industries from Lakebase (only active use cases are returned)
        industries_dict = {}
        for row in lakebase_data:
            industry = row.get("industry")
            if industry and industry not in industries_dict:
                # Use override label if available, otherwise use database label
                label = label_overrides.get(industry, row.get("industry_label", industry.title()))
                industries_dict[industry] = {"value": industry, "label": label}
        
        # Build ordered list: start with placeholder
        industries = [{"value": "", "label": "Select an industry..."}]
        
        # Add industries in priority order first
        for industry in priority_order:
            if industry in industries_dict:
                industries.append(industries_dict.pop(industry))
        
        # Add any remaining industries (not in priority list)
        for industry_data in industries_dict.values():
            industries.append(industry_data)
        
        return industries
    
    # Fallback to YAML
    logger.info("[YAML Fallback] Using industries from prompts_config.yaml")
    return get_config().get('industries', [])

def get_use_cases_map() -> Dict[str, List[Dict]]:
    """Get use cases map - from Lakebase or YAML fallback."""
    # Try Lakebase first
    lakebase_data = get_usecase_descriptions_from_lakebase()
    if lakebase_data:
        # Group use cases by industry
        use_cases_map = {}
        for row in lakebase_data:
            industry = row.get("industry")
            use_case = row.get("use_case")
            if industry and use_case:
                if industry not in use_cases_map:
                    use_cases_map[industry] = [{"value": "", "label": "Select a use case..."}]
                use_cases_map[industry].append({
                    "value": use_case,
                    "label": row.get("use_case_label", use_case.title())
                })
        return use_cases_map
    
    # Fallback to YAML
    logger.info("[YAML Fallback] Using use_cases from prompts_config.yaml")
    return get_config().get('use_cases', {})

def get_prompt_templates_map() -> Dict[str, Dict[str, str]]:
    """Get prompt templates - from Lakebase database only (no YAML fallback)."""
    lakebase_data = get_usecase_descriptions_from_lakebase()
    if lakebase_data:
        # Group prompt templates by industry -> use_case
        templates_map = {}
        for row in lakebase_data:
            industry = row.get("industry")
            use_case = row.get("use_case")
            template = row.get("prompt_template")
            if industry and use_case and template:
                if industry not in templates_map:
                    templates_map[industry] = {}
                templates_map[industry][use_case] = template
        return templates_map
    
    # No YAML fallback - database is required
    logger.warning("[Database Required] No usecase_descriptions found in Lakebase. Run setup-lakebase.sh --recreate to seed data.")
    return {}

def get_workflow_steps_list() -> List[Dict]:
    """Get workflow steps from YAML (UI config, not in Lakebase)."""
    return get_config().get('workflow_steps', [])

def get_prerequisites_list() -> List[Dict]:
    """Get prerequisites from YAML (UI config, not in Lakebase)."""
    return get_config().get('prerequisites', [])

def get_section_input_prompts_map() -> Dict[str, Dict[str, Any]]:
    """Get section input prompts - from Lakebase database only (no YAML fallback)."""
    lakebase_data = get_section_input_prompts_from_lakebase()
    if lakebase_data:
        # Convert list to map by section_tag
        prompts_map = {}
        for row in lakebase_data:
            section_tag = row.get("section_tag")
            if section_tag:
                # Parse image fields if they're strings
                how_to_apply_images = row.get("how_to_apply_images", [])
                expected_output_images = row.get("expected_output_images", [])
                if isinstance(how_to_apply_images, str):
                    try:
                        how_to_apply_images = json.loads(how_to_apply_images)
                    except json.JSONDecodeError:
                        how_to_apply_images = []
                if isinstance(expected_output_images, str):
                    try:
                        expected_output_images = json.loads(expected_output_images)
                    except json.JSONDecodeError:
                        expected_output_images = []
                
                prompts_map[section_tag] = {
                    "input": row.get("input_template", ""),
                    "system_prompt": row.get("system_prompt", ""),
                    "how_to_apply": row.get("how_to_apply", ""),
                    "expected_output": row.get("expected_output", ""),
                    "how_to_apply_images": how_to_apply_images or [],
                    "expected_output_images": expected_output_images or [],
                    "section_title": row.get("section_title", ""),
                    "section_description": row.get("section_description", ""),
                    "order_number": row.get("order_number", 99),
                    "bypass_llm": row.get("bypass_llm", False)
                }
        return prompts_map
    
    # No YAML fallback - database is required
    logger.warning("[Database Required] No section_input_prompts found in Lakebase. Run setup-lakebase.sh --recreate to seed data.")
    return {}

# Backwards compatibility - load as module-level variables
# Note: Only "sample" is enabled for now. Other industries are hidden.
INDUSTRIES: List[Dict] = get_industries() or [
    {"value": "", "label": "Select an industry..."},
    {"value": "sample", "label": "sample [for enablement]"},
]

USE_CASES: Dict[str, List[Dict]] = get_use_cases_map() or {}

PROMPT_TEMPLATES: Dict[str, Dict[str, str]] = get_prompt_templates_map() or {}

WORKFLOW_STEPS: List[Dict] = get_workflow_steps_list() or []

PREREQUISITES: List[Dict] = get_prerequisites_list() or []

# ============== Helper Functions ==============

def format_industry_name(industry: str) -> str:
    industry_map = {
        "sample": "Sample for Enablement",
        "retail": "Retail",
        "cpg": "CPG",
        "travel": "Travel"
    }
    return industry_map.get(industry.lower(), industry)

def format_use_case_name(use_case: str) -> str:
    """Convert snake_case or kebab-case to Title Case"""
    return ' '.join(word.capitalize() for word in use_case.replace('_', ' ').replace('-', ' ').split())

def get_workshop_parameters_sync() -> Dict[str, str]:
    """
    Get all workshop parameters as a dictionary (sync version for template substitution).
    Returns key-value pairs like {'workspace_url': 'https://...', 'lakebase_instance_name': '...', 'lakebase_host_name': '...'}
    """
    schema = get_schema()
    sql = f"""
        SELECT param_key, param_value
        FROM {schema}.workshop_parameters
        WHERE is_active = TRUE
    """
    results = execute_query(sql)
    
    if not results:
        # Return defaults from env vars (set in app.yaml) when DB has no data
        return {
            'workspace_url': os.getenv('WORKSPACE_URL', ''),
            'workspace_org_id': os.getenv('WORKSPACE_ORG_ID', ''),
            'default_warehouse': os.getenv('DEFAULT_WAREHOUSE', ''),
            'lakebase_instance_name': os.getenv('LAKEBASE_INSTANCE_NAME', ''),
            'lakebase_host_name': os.getenv('LAKEBASE_HOST', ''),
            'company_brand_url': '',
            'lakebase_uc_catalog_name': os.getenv('LAKEBASE_UC_CATALOG', ''),
            'lakebase_mode': os.getenv('LAKEBASE_MODE', 'autoscaling'),
        }
    
    return {row['param_key']: row['param_value'] for row in results}


def get_effective_workshop_parameters(session_id: Optional[str] = None) -> Dict[str, str]:
    """
    Get effective workshop parameters, with session overrides applied if session_id is provided.
    
    This is the single source of truth for parameter resolution:
    1. Start with global parameters from workshop_parameters table
    2. If session_id is provided, overlay any session-specific overrides
    
    Args:
        session_id: Optional session ID. If provided, session overrides are applied.
        
    Returns:
        Dict of param_key -> param_value with effective values for the session
    """
    # Get global parameters as base
    params = get_workshop_parameters_sync()
    
    # If no session_id, return global parameters
    if not session_id:
        return params
    
    # Get session-specific overrides + fields needed for user_schema_prefix derivation
    schema = get_schema()
    sql = f"""
        SELECT COALESCE(session_parameters, '{{}}') as session_parameters,
               created_by, use_case_label, use_case, workshop_level
        FROM {schema}.sessions
        WHERE session_id = %s
    """
    results = execute_query(sql, (session_id,))
    
    if results and results[0].get('session_parameters'):
        session_overrides = results[0]['session_parameters']
        if isinstance(session_overrides, str):
            import json
            try:
                session_overrides = json.loads(session_overrides)
            except json.JSONDecodeError:
                session_overrides = {}
        
        # Overlay session overrides on top of global parameters
        if session_overrides:
            params.update(session_overrides)
            logger.debug(f"[Session Params] Applied {len(session_overrides)} session overrides for session {session_id}")
    
    # Derive user_schema_prefix, user_app_name, use_case_slug, and use_case_file_prefix on-the-fly if any is missing
    _needs_schema = results and 'user_schema_prefix' not in params
    _needs_app_name = results and 'user_app_name' not in params
    _needs_slug = results and 'use_case_slug' not in params
    _needs_file_prefix = results and 'use_case_file_prefix' not in params
    if _needs_schema or _needs_app_name or _needs_slug or _needs_file_prefix:
        import re as _re
        _created_by = results[0].get('created_by', '') or ''
        _uc_name = (
            params.get('custom_use_case_label', '').strip()
            or (results[0].get('use_case') or '')
            or (results[0].get('use_case_label') or '')
        )
        _user_part = "user"
        if _created_by and '@' in _created_by:
            _local = _created_by.split('@')[0]
            _parts = _local.split('.')
            _first = _parts[0].lower()
            _last_init = _parts[1][0].lower() if len(_parts) > 1 and _parts[1] else ''
            _user_part = f"{_first}_{_last_init}" if _last_init else _first
        
        _is_accelerator = results[0].get('workshop_level') in ('accelerator', 'genie-accelerator')
        if _is_accelerator:
            _suffix = params.get('chapter_3_lakehouse_schema', 'vibe_coding')
        elif _uc_name.strip():
            _suffix = _re.sub(r'[^a-z0-9]+', '_', _uc_name.strip().lower()).strip('_')
        else:
            _suffix = None
        
        if _suffix:
            _patch = {}
            _uc_slug_hyphen = _re.sub(r'[^a-z0-9]+', '-', (_uc_name.strip().lower() if _uc_name.strip() else 'vibe-coding')).strip('-')
            
            if _needs_schema:
                params['user_schema_prefix'] = f"{_user_part}_{_suffix}"
                _patch['user_schema_prefix'] = params['user_schema_prefix']
                logger.info(f"[Session Params] Derived user_schema_prefix: {params['user_schema_prefix']} (accelerator={_is_accelerator}) for session {session_id}")
            
            if _needs_app_name:
                _user_part_hyphen = _user_part.replace('_', '-')
                params['user_app_name'] = f"{_user_part_hyphen}-{_uc_slug_hyphen}"
                _patch['user_app_name'] = params['user_app_name']
                logger.info(f"[Session Params] Derived user_app_name: {params['user_app_name']} for session {session_id}")
            
            if _needs_slug:
                params['use_case_slug'] = _uc_slug_hyphen
                _patch['use_case_slug'] = params['use_case_slug']
                logger.info(f"[Session Params] Derived use_case_slug: {params['use_case_slug']} for session {session_id}")
            
            if _needs_file_prefix:
                _uc_file_prefix = _re.sub(r'[^a-z0-9]+', '_', (_uc_name.strip().lower() if _uc_name.strip() else 'vibe_coding')).strip('_') or 'vibe_coding'
                params['use_case_file_prefix'] = _uc_file_prefix
                _patch['use_case_file_prefix'] = params['use_case_file_prefix']
                logger.info(f"[Session Params] Derived use_case_file_prefix: {params['use_case_file_prefix']} (from use_case_name, accelerator={_is_accelerator}) for session {session_id}")
            
            if _patch:
                try:
                    import json as _json
                    _merge_sql = f"""
                        UPDATE {schema}.sessions
                        SET session_parameters = COALESCE(session_parameters, '{{}}'::jsonb) || %s::jsonb,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE session_id = %s
                    """
                    execute_insert(_merge_sql, (_json.dumps(_patch), session_id))
                    logger.info(f"[Session Params] Persisted {list(_patch.keys())} for session {session_id}")
                except Exception as e:
                    logger.warning(f"[Session Params] Failed to persist derived params: {e}")
    
    return params


def get_section_input_content(industry: str, use_case: str, section_tag: str, previous_outputs: Optional[Dict[str, str]] = None, session_id: Optional[str] = None) -> Dict[str, str]:
    """
    Get the input content (context/requirements) for a specific section.
    Templates are loaded from prompts_config.yaml with parameter substitution.
    
    Parameters substituted:
      - {industry_name}: Formatted industry name
      - {use_case_title}: Formatted use case title
      - {use_case_description}: Full prompt template text for this use case
      - {section_tag}: The section identifier
      - {prd_document}: PRD document from Step 2 (for UI design steps)
      - Workshop parameters: {workspace_url}, {lakebase_instance_name}, {lakebase_host_name}, {default_warehouse}
      - Any other keys from previous_outputs dict
    """
    industry_name = format_industry_name(industry)
    use_case_title = format_use_case_name(use_case)
    
    # Look up the detailed use case description from prompt_templates
    prompt_templates = get_prompt_templates_map()
    use_case_description = ""
    
    if industry.lower() in prompt_templates:
        industry_templates = prompt_templates[industry.lower()]
        if use_case.lower() in industry_templates:
            use_case_description = industry_templates[use_case.lower()]
    
    # Fallback description if not found
    if not use_case_description:
        use_case_description = f"Build a {use_case_title} solution for the {industry_name} industry."
    
    # Get workshop parameters (includes session-specific overrides if session_id is provided)
    workshop_params = get_effective_workshop_parameters(session_id)
    
    # Check for session-level use case overrides (user-edited name/description)
    if session_id:
        custom_desc = workshop_params.get('custom_use_case_description', '').strip()
        if custom_desc:
            use_case_description = custom_desc
        custom_title = workshop_params.get('custom_use_case_label', '').strip()
        if custom_title:
            use_case_title = custom_title
    
    # Load section inputs from config
    section_input_prompts_config = get_section_input_prompts_map()
    
    # Get template for this section (or default)
    template = section_input_prompts_config.get(section_tag, section_input_prompts_config.get('default', {}))
    
    # Replace parameters in templates
    input_text = template.get('input', '')
    input_template_raw = input_text  # Keep the raw template with variables for reference
    system_prompt = template.get('system_prompt', '')
    how_to_apply = template.get('how_to_apply', '')
    expected_output = template.get('expected_output', '')
    how_to_apply_images = template.get('how_to_apply_images', [])
    expected_output_images = template.get('expected_output_images', [])
    bypass_llm = template.get('bypass_llm', False)  # Check if this section bypasses LLM
    
    # Substitute all parameters including use_case_description
    params = {
        '{industry_name}': industry_name,
        '{use_case_title}': use_case_title,
        '{use_case_description}': use_case_description,
        '{section_tag}': section_tag,
    }
    
    # Add workshop parameters to substitution params
    for key, value in workshop_params.items():
        params['{' + key + '}'] = value
    
    # Add previous outputs to params (e.g., {prd_document})
    if previous_outputs:
        for key, value in previous_outputs.items():
            params['{' + key + '}'] = value or f"[No {key} provided - please complete Step 2 first]"
    
    # Set default for {prd_document} if not provided (for UI design steps)
    if '{prd_document}' not in params:
        params['{prd_document}'] = "[PRD not provided - please complete Step 2 (PRD Generation) first to include the PRD in your UI design]"
    
    for key, value in params.items():
        input_text = input_text.replace(key, str(value))
        system_prompt = system_prompt.replace(key, str(value))
        how_to_apply = how_to_apply.replace(key, str(value))
        expected_output = expected_output.replace(key, str(value))
    
    # Conditional branding injection -- only when company_brand_url is specified
    brand_url = workshop_params.get('company_brand_url', '').strip()
    if brand_url and section_tag in ('figma_ui_design', 'cursor_copilot_ui_design'):
        _company_display = ''
        try:
            from urllib.parse import urlparse
            _parsed = urlparse(brand_url)
            _path = _parsed.path.strip('/')
            if _path:
                _last_seg = _path.split('/')[-1]
                if any(c.isalpha() for c in _last_seg) and len(_last_seg) > 2:
                    _company_display = _last_seg.replace('-', ' ').replace('_', ' ').title()
        except Exception:
            pass

        if _company_display:
            branding_section = f"""

---

## Branding Guidelines

Use **{_company_display}** as the brand for this application.
- Reference {brand_url} for the official brand color codes and assets
- Apply the company's primary and secondary brand colors throughout the UI (theme, buttons, headers, accents)
- Use the company's logo where appropriate (e.g., header/navbar, favicon)
- Ensure all UI elements, buttons, and accents align with the brand's visual identity"""
        else:
            branding_section = f"""

---

## Branding Guidelines

Use the brand defined at the following URL for this application.
- Reference {brand_url} for the official brand color codes and assets
- Apply the brand's primary and secondary colors throughout the UI (theme, buttons, headers, accents)
- Use the brand's logo where appropriate (e.g., header/navbar, favicon)
- Ensure all UI elements, buttons, and accents align with the brand's visual identity"""
        input_text += branding_section
    
    # If no config found, use fallback
    if not input_text:
        input_text = f"""Generate content for {section_tag} in {industry_name} for {use_case_title}.

## Use Case Context
{use_case_description}

Industry: {industry_name}
Use Case: {use_case_title}
Section: {section_tag}

Please provide detailed requirements and specifications for this section."""
        system_prompt = f"""You are an expert Databricks solutions architect.
Generate a detailed, actionable prompt for {section_tag} in a {industry_name} {use_case_title} application."""
    
    return {
        "input": input_text,
        "input_template": input_template_raw,
        "system_prompt": system_prompt,
        "how_to_apply": how_to_apply,
        "expected_output": expected_output,
        "how_to_apply_images": how_to_apply_images,
        "expected_output_images": expected_output_images,
        "bypass_llm": bypass_llm
    }


async def generate_prompt_content_with_llm(
    industry: str, 
    use_case: str, 
    section_tag: str,
    use_llm: bool = True,
    previous_outputs: Optional[Dict[str, str]] = None,
    session_id: Optional[str] = None
) -> Dict[str, str]:
    """
    Generate prompt content by calling the LLM with the section input.
    
    Args:
        industry: The selected industry
        use_case: The selected use case
        section_tag: The workflow section identifier
        use_llm: If True, calls LLM to generate prompt. If False, returns input as prompt.
        previous_outputs: Dict of outputs from previous steps (e.g., {"prd_document": "..."})
        session_id: If provided, uses session-specific parameter overrides
    
    Returns:
        Dict with 'prompt' (LLM-generated), 'input' (context sent to LLM), 
        'how_to_apply', and 'expected_output'
    """
    logger.info(f"  industry: {industry}")
    logger.info(f"  use_case: {use_case}")
    logger.info(f"  section_tag: {section_tag}")
    logger.info(f"  use_llm: {use_llm} (default is True)")
    logger.info(f"  previous_outputs keys: {list(previous_outputs.keys()) if previous_outputs else 'None'}")
    logger.info(f"  session_id: {session_id}")
    
    # Get the input content for this section (uses session parameters if session_id provided)
    section_content = get_section_input_content(industry, use_case, section_tag, previous_outputs, session_id)
    input_text = section_content["input"]
    input_template = section_content.get("input_template", input_text)  # Raw template with variables
    system_prompt = section_content.get("system_prompt", "You are a helpful assistant. Generate a detailed, actionable prompt based on the given requirements.")
    how_to_apply = section_content.get("how_to_apply", "")
    expected_output = section_content.get("expected_output", "")
    how_to_apply_images = section_content.get("how_to_apply_images", [])
    expected_output_images = section_content.get("expected_output_images", [])
    bypass_llm = section_content.get("bypass_llm", False)
    
    logger.info(f"  Input text length: {len(input_text)} characters")
    logger.info(f"  bypass_llm: {bypass_llm}")
    
    if bypass_llm:
        logger.info(f"[Bypass LLM] Section {section_tag} has bypass_llm=True, returning template as-is (non-streaming)")
        combined_output = f"## Context\n\n{system_prompt}\n\n---\n\n{input_text}" if system_prompt else input_text
        return {
            "prompt": combined_output,
            "input": input_text,
            "input_template": input_template,
            "how_to_apply": how_to_apply,
            "expected_output": expected_output,
            "how_to_apply_images": how_to_apply_images,
            "expected_output_images": expected_output_images,
            "source": "bypass_llm"
        }
    
    if not use_llm:
        return {
            "prompt": input_text,
            "input": input_text,
            "input_template": input_template,
            "how_to_apply": how_to_apply,
            "expected_output": expected_output,
            "how_to_apply_images": how_to_apply_images,
            "expected_output_images": expected_output_images,
            "source": "input_only_no_llm"
        }
    
    
    try:
        # Call the LLM to generate the actual prompt
        llm_response = await call_databricks_serving_endpoint(
            prompt=f"Based on the following requirements, generate a detailed, actionable prompt that can be used with an AI assistant or developer:\n\n{input_text}",
            system_prompt=system_prompt,
            max_tokens=4000,  # Full response length
            temperature=0.7
        )
        
        generated_prompt = llm_response.get("response", input_text)
        model_used = llm_response.get("model", "unknown")
        usage = llm_response.get("usage", {})
        
        logger.info(f"     Response length: {len(generated_prompt)} characters")
        logger.info(f"     Token usage: {usage}")
        logger.info(f"     Response preview: {generated_prompt[:200]}...")
        
        # Check if response looks like a mock
        is_mock = "[Mock Response" in generated_prompt
        if is_mock:
            logger.warning("Response appears to be a MOCK response")
        
        return {
            "prompt": generated_prompt,
            "input": input_text,
            "input_template": input_template,
            "how_to_apply": how_to_apply,
            "expected_output": expected_output,
            "how_to_apply_images": how_to_apply_images,
            "expected_output_images": expected_output_images,
            "source": "mock_llm" if is_mock else "llm_generated",
            "model": model_used,
            "usage": usage
        }
        
    except Exception as e:
        logger.error(f"  ❌ ERROR generating prompt with LLM: {str(e)}")
        logger.error(f"     Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"     Traceback: {traceback.format_exc()}")
        logger.info("  Falling back to returning input as prompt")
        # Fallback to returning input as prompt
        return {
            "prompt": input_text,
            "input": input_text,
            "input_template": input_template,
            "how_to_apply": how_to_apply,
            "expected_output": expected_output,
            "how_to_apply_images": how_to_apply_images,
            "expected_output_images": expected_output_images,
            "source": "fallback_due_to_error",
            "error": str(e)
        }


def generate_prompt_content(industry: str, use_case: str, section_tag: str, previous_outputs: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """
    Synchronous version - returns input content without LLM call.
    Used for backwards compatibility and non-async contexts.
    """
    section_content = get_section_input_content(industry, use_case, section_tag, previous_outputs)
    input_text = section_content["input"]
    input_template = section_content.get("input_template", input_text)
    how_to_apply = section_content.get("how_to_apply", "")
    expected_output = section_content.get("expected_output", "")
    how_to_apply_images = section_content.get("how_to_apply_images", [])
    expected_output_images = section_content.get("expected_output_images", [])
    
    return {
        "prompt": input_text,  # Without LLM, prompt = input
        "input": input_text,
        "input_template": input_template,
        "how_to_apply": how_to_apply,
        "expected_output": expected_output,
        "how_to_apply_images": how_to_apply_images,
        "expected_output_images": expected_output_images
    }


# ============== Databricks Serving Endpoint Functions ==============

async def call_databricks_serving_endpoint(
    prompt: str,
    endpoint_name: str = None,
    max_tokens: int = 4000,  # Full response length
    temperature: float = 0.5,  # Lower temp = faster generation
    system_prompt: str = None
) -> Dict[str, Any]:
    """
    Call a Databricks Model Serving endpoint using the SDK's API client.
    
    When running as a Databricks App, authentication is automatic via OAuth -
    no token needed! The SDK uses the app's service principal credentials.
    
    Args:
        prompt: The user prompt to send to the model
        endpoint_name: Name of the serving endpoint (auto-discovered if not provided)
        max_tokens: Maximum tokens in the response
        temperature: Sampling temperature (0.0-1.0)
        system_prompt: Optional system prompt for the model
    
    Returns:
        Dict containing the response, model info, and usage stats
    """
    # Auto-discover endpoint if not specified
    endpoint = endpoint_name or get_best_available_endpoint()
    
    if not endpoint:
        logger.error("  ❌ No serving endpoint available!")
        logger.error("     Please configure DATABRICKS_SERVING_ENDPOINT or deploy a model serving endpoint")
        available = get_available_serving_endpoints()
        logger.error(f"     Available endpoints in workspace: {available if available else 'None found'}")
        return {
            "response": "[Error] No serving endpoint configured or available. Please set DATABRICKS_SERVING_ENDPOINT environment variable or deploy a model serving endpoint in your Databricks workspace.",
            "model": "none",
            "usage": {}
        }
    
    
    # Get the workspace client (handles auth automatically)
    client = get_workspace_client()
    
    
    if not client or not DATABRICKS_SDK_AVAILABLE:
        logger.warning("  ⚠️ Databricks SDK not available or client not initialized")
        logger.warning("  ⚠️ Returning MOCK response")
        return {
            "response": f"[Mock Response - SDK not available] This is a simulated response for: {prompt[:100]}...",
            "model": endpoint,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        }
    
    # Build messages list for SDK query (OpenAI chat format)
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    
    # Use SDK's serving_endpoints.query() - this automatically uses app's service principal permissions
    # No direct HTTP calls needed - the SDK handles authentication
    
    import time
    start_time = time.time()
    
    try:
        # Use raw HTTP request instead of SDK's query() method to avoid SDK serialization bug
        
        # Get the workspace host from the SDK client
        workspace_host = client.config.host.rstrip('/')
        
        # Try OpenAI-compatible format first (most common)
        openai_payload = {
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        # Build a combined prompt string for simple input format
        combined_prompt = prompt
        if messages:
            parts = []
            for msg in messages:
                role = msg.get("role", "")
                content = msg.get("content", "")
                if role == "system":
                    parts.append(f"[System] {content}")
                else:
                    parts.append(content)
            combined_prompt = "\n\n".join(parts)
        
        # Agent format payloads - try multiple variations
        agent_payloads = [
            # Variation 1: Messages as input (like OpenAI but different key)
            {"input": messages, "max_output_tokens": max_tokens, "temperature": temperature},
            # Variation 2: Simple string input in array
            {"input": [combined_prompt], "max_output_tokens": max_tokens, "temperature": temperature},
            # Variation 3: Just the string input
            {"input": combined_prompt, "max_output_tokens": max_tokens, "temperature": temperature},
            # Variation 4: Minimal with just input
            {"input": combined_prompt},
        ]
        
        import json as json_lib
        
        
        # Use SDK's serving_endpoints.query() directly - it handles auth automatically
        def make_request(payload):
            """Make request using SDK's serving_endpoints API."""
            try:
                # Check if it's OpenAI format (has 'messages')
                if 'messages' in payload:
                    # Use only required parameters to avoid SDK adding extra keys
                    result = client.serving_endpoints.query(
                        name=endpoint,
                        messages=payload.get('messages'),
                        max_tokens=payload.get('max_tokens', max_tokens),
                        temperature=payload.get('temperature', temperature)
                    )
                else:
                    # For Agent/custom format, use inputs with ONLY the input key
                    input_data = payload.get('input', '')
                    
                    # Ensure input is always a list of message dicts for Agent endpoints
                    if isinstance(input_data, str):
                        input_list = [{"role": "user", "content": input_data}]
                    elif isinstance(input_data, list):
                        if all(isinstance(x, dict) for x in input_data):
                            input_list = input_data
                        else:
                            input_list = [{"role": "user", "content": str(input_data)}]
                    else:
                        input_list = [{"role": "user", "content": str(input_data)}]
                    
                    logger.info(f"  Input list length: {len(input_list)}")
                    # Use only inputs parameter - no other parameters
                    result = client.serving_endpoints.query(
                        name=endpoint,
                        input=input_list  # Try 'input' instead of 'inputs'
                    )
                
                logger.info(f"  SDK query returned type: {type(result).__name__}")
                
                # Safely convert result to dict
                if result is None:
                    return {}
                if isinstance(result, dict):
                    return result
                    
                # Try to convert to dict without calling as_dict (which causes the bug)
                result_dict = {}
                for attr in ['choices', 'usage', 'model', 'id', 'object', 'created', 'output', 'predictions']:
                    if hasattr(result, attr):
                        val = getattr(result, attr)
                        if val is not None:
                            # Convert nested objects
                            if isinstance(val, list):
                                result_dict[attr] = []
                                for item in val:
                                    if isinstance(item, dict):
                                        result_dict[attr].append(item)
                                    elif hasattr(item, '__dict__'):
                                        result_dict[attr].append({k: v for k, v in vars(item).items() if not k.startswith('_')})
                                    else:
                                        result_dict[attr].append(item)
                            elif isinstance(val, dict):
                                result_dict[attr] = val
                            elif hasattr(val, '__dict__'):
                                result_dict[attr] = {k: v for k, v in vars(val).items() if not k.startswith('_')}
                            else:
                                result_dict[attr] = val
                
                if result_dict:
                    return result_dict
                    
                # Last resort - try to stringify
                return {"raw": str(result)}
                
            except Exception as e:
                logger.error(f"  SDK query failed: {e}")
                raise
        
        # Bypass SDK's buggy serving_endpoints.query() - use low-level API client instead
        query_response = None
        last_error = None
        
        # Build payload for OpenAI-compatible endpoint
        # Note: gpt-5-mini doesn't support temperature parameter
        openai_request_body = {
            "messages": messages,
            "max_tokens": max_tokens,
        }
        # Only add temperature if not using gpt-5-mini (which only supports default temp)
        if "mini" not in endpoint.lower():
            openai_request_body["temperature"] = temperature
        
        
        try:
            # Use SDK's api_client.do() which handles auth but doesn't have the as_dict bug
            raw_result = client.api_client.do(
                method="POST",
                path=f"/serving-endpoints/{endpoint}/invocations",
                body=openai_request_body
            )
            
            # The api_client.do() returns a dict directly
            if isinstance(raw_result, dict):
                query_response = raw_result
            else:
                query_response = {"raw": str(raw_result)}
        except Exception as openai_err:
            last_error = openai_err
            error_msg = str(openai_err).lower()
            logger.info(f"  OpenAI format failed: {openai_err}")
            
            # Only try Agent format if it's a schema/format error
            if "schema" in error_msg or "missing inputs" in error_msg or "input" in error_msg:
                for i, agent_payload in enumerate(agent_payloads):
                    try:
                        logger.info(f"  Trying Agent format variation {i+1}...")
                        query_response = make_request(agent_payload)
                        last_error = None
                        break
                    except Exception as agent_err:
                        logger.info(f"  Agent format variation {i+1} failed: {agent_err}")
                        last_error = agent_err
        
        if last_error:
            logger.error(f"  ❌ All formats failed!")
            raise last_error
        
        logger.info(f"  Raw API response type: {type(query_response).__name__}")
        
        elapsed_time = time.time() - start_time
        logger.info(f"  Response repr: {repr(query_response)[:500]}")
        
        # Convert response to a plain dict - SDK often returns dict already
        response = None
        
        # Case 1: Already a plain dict - use it directly
        if isinstance(query_response, dict):
            response = query_response
            logger.info(f"  Response is already a dict, using directly")
        
        # Case 2: SDK object - try various conversion methods (each wrapped in try/except)
        elif query_response is not None:
            import json
            
            # Try as_dict first
            if response is None:
                try:
                    if hasattr(query_response, 'as_dict'):
                        response = query_response.as_dict()
                        logger.info(f"  Converted using as_dict()")
                except Exception as e:
                    logger.warning(f"  as_dict() failed: {e}")
            
            # Try to_dict
            if response is None:
                try:
                    if hasattr(query_response, 'to_dict'):
                        response = query_response.to_dict()
                        logger.info(f"  Converted using to_dict()")
                except Exception as e:
                    logger.warning(f"  to_dict() failed: {e}")
            
            # Try vars/__dict__
            if response is None:
                try:
                    if hasattr(query_response, '__dict__'):
                        response = dict(vars(query_response))
                        logger.info(f"  Converted using vars()")
                except Exception as e:
                    logger.warning(f"  vars() failed: {e}")
            
            # Try JSON serialization
            if response is None:
                try:
                    response = json.loads(json.dumps(query_response, default=str))
                    logger.info(f"  Converted using JSON serialization")
                except Exception as e:
                    logger.warning(f"  JSON serialization failed: {e}")
            
            # Ultimate fallback - string
            if response is None:
                response = {"raw_response": str(query_response)}
                logger.info(f"  Using string fallback")
        
        if response is None:
            response = {"error": "Empty response from SDK"}
            
        logger.info(f"  Final response type: {type(response).__name__}")
        
        logger.info(f"  Response keys: {list(response.keys()) if isinstance(response, dict) else 'N/A'}")
        
        # Parse the response
        content = None
        usage = {}
        model_used = endpoint
        
        if isinstance(response, dict):
            # Log all keys and their types for debugging
            for key, val in response.items():
                val_type = type(val).__name__
                val_preview = str(val)[:100] if val else "None"
                logger.info(f"    Key '{key}': type={val_type}, value={val_preview}")
            
            # Try OpenAI format (choices)
            if "choices" in response and response["choices"]:
                choice = response["choices"][0]
                logger.info(f"  Choice type: {type(choice).__name__}")
                
                # Handle choice as dict
                if isinstance(choice, dict):
                    message = choice.get("message", {})
                    if isinstance(message, dict):
                        content = message.get("content", "")
                    elif hasattr(message, 'content'):
                        content = getattr(message, 'content', '')
                # Handle choice as SDK object
                elif hasattr(choice, 'message'):
                    message = choice.message
                    if isinstance(message, dict):
                        content = message.get("content", "")
                    elif hasattr(message, 'content'):
                        content = getattr(message, 'content', '')
                
                if "usage" in response:
                    usage_data = response["usage"]
                    if isinstance(usage_data, dict):
                        usage = {
                            "prompt_tokens": usage_data.get("prompt_tokens", 0),
                            "completion_tokens": usage_data.get("completion_tokens", 0),
                            "total_tokens": usage_data.get("total_tokens", 0)
                        }
                    elif hasattr(usage_data, 'prompt_tokens'):
                        usage = {
                            "prompt_tokens": getattr(usage_data, 'prompt_tokens', 0),
                            "completion_tokens": getattr(usage_data, 'completion_tokens', 0),
                            "total_tokens": getattr(usage_data, 'total_tokens', 0)
                        }
                model_used = response.get("model", endpoint)
            
            # Try output format (agent endpoints)
            elif "output" in response:
                content = response["output"]
                if isinstance(content, list):
                    content = content[0] if content else ""
                elif isinstance(content, dict):
                    content = content.get("content") or content.get("text") or str(content)
                usage = response.get("usage", {})
            
            # Try predictions format
            elif "predictions" in response:
                content = response["predictions"]
                if isinstance(content, list):
                    content = content[0] if content else ""
            
            # Try result format
            elif "result" in response:
                content = response["result"]
                if isinstance(content, list):
                    content = content[0] if content else ""
                elif isinstance(content, dict):
                    content = content.get("content") or content.get("text") or str(content)
            
            # Try response format (nested)
            elif "response" in response:
                content = response["response"]
                if isinstance(content, list):
                    content = content[0] if content else ""
                elif isinstance(content, dict):
                    content = content.get("content") or content.get("text") or str(content)
            
            # Try data format
            elif "data" in response:
                data = response["data"]
                if isinstance(data, list) and data:
                    item = data[0]
                    content = item.get("content") if isinstance(item, dict) else str(item)
                elif isinstance(data, dict):
                    content = data.get("content") or data.get("text") or str(data)
                else:
                    content = str(data)
            
            # Try text format
            elif "text" in response:
                content = response["text"]
            
            # Try content format directly
            elif "content" in response:
                content = response["content"]
            
            # Fallback
            else:
                content = str(response)
        
        # Check for empty content (common with reasoning models that use all tokens for reasoning)
        if content is not None and content != "":
            logger.info(f"     Model: {model_used}")
            logger.info(f"     Response length: {len(str(content))} characters")
            logger.info(f"     Usage: {usage}")
            preview = str(content)[:150]
            logger.info(f"     Preview: {preview}{'...' if len(str(content)) > 150 else ''}")
            
            return {
                "response": content,
                "model": model_used,
                "usage": usage,
                "source": "llm_generated"
            }
        else:
            # Check if this is a reasoning model that exhausted tokens
            finish_reason = None
            reasoning_tokens = 0
            if isinstance(response, dict) and "choices" in response and response["choices"]:
                choice = response["choices"][0]
                if isinstance(choice, dict):
                    finish_reason = choice.get("finish_reason")
            if isinstance(response, dict) and "usage" in response:
                usage_details = response["usage"]
                if isinstance(usage_details, dict):
                    reasoning_tokens = usage_details.get("completion_tokens_details", {}).get("reasoning_tokens", 0)
            
            logger.warning(f"  ⚠️ Empty content in response!")
            logger.warning(f"     Finish reason: {finish_reason}")
            logger.warning(f"     Reasoning tokens: {reasoning_tokens}")
            logger.warning(f"     This model may have used all tokens for internal reasoning.")
            
            # Return a more helpful message
            if finish_reason == "length" and reasoning_tokens > 0:
                return {
                    "response": f"[Model used {reasoning_tokens} reasoning tokens but produced no visible output. This is a reasoning model - try increasing max_tokens or using a different model.]",
                    "model": model_used,
                    "usage": usage,
                    "source": "llm_reasoning_exhausted"
                }
            else:
                return {
                    "response": str(response) if response else "[Empty response from LLM]",
                    "model": model_used,
                    "usage": usage,
                    "source": "llm_empty_response"
                }
            
    except Exception as e:
        error_str = str(e)
        logger.error(f"  ❌ SDK query failed!")
        logger.error(f"     Error type: {type(e).__name__}")
        logger.error(f"     Error message: {error_str}")
        import traceback
        logger.error(f"     Traceback:\n{traceback.format_exc()}")
        
        error_msg = error_str.lower()
        if "unauthorized" in error_msg or "403" in error_msg or "401" in error_msg or "permission" in error_msg:
            logger.error("     ❌ AUTHENTICATION ERROR - Check app permissions for serving endpoints")
            logger.error("     Make sure the serving endpoint resource is added in the Databricks App UI!")
            raise HTTPException(
                status_code=403,
                detail=f"Authentication failed. Ensure the app has permission to access the serving endpoint '{endpoint}'. "
                       f"Add the endpoint as a resource in the Databricks App settings. Error: {error_str}"
            )
        elif "not found" in error_msg or "404" in error_msg or "does not exist" in error_msg:
            logger.error(f"     ❌ ENDPOINT NOT FOUND - '{endpoint}' does not exist")
            raise HTTPException(
                status_code=404,
                detail=f"Serving endpoint '{endpoint}' not found. Check the endpoint name and ensure it exists in your workspace."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Error calling serving endpoint '{endpoint}': {error_str}"
            )


async def enhance_prompt_with_llm(
    base_prompt: str,
    industry: str,
    use_case: str,
    custom_instructions: str = None
) -> str:
    """
    Enhance a prompt using an LLM to make it more detailed and context-specific.
    
    Args:
        base_prompt: The original prompt to enhance
        industry: The selected industry
        use_case: The selected use case
        custom_instructions: Optional additional instructions for enhancement
    
    Returns:
        Enhanced prompt string
    """
    system_prompt = """You are an expert Databricks solutions architect and prompt engineer. 
Your task is to enhance and improve prompts for building Databricks applications.
Make the prompts more specific, actionable, and tailored to the given industry and use case.
Include best practices, specific technical recommendations, and implementation details.
Keep the enhanced prompt focused and practical."""

    enhancement_prompt = f"""Please enhance the following prompt for a {industry} {use_case} application:

Original Prompt:
{base_prompt}

{f'Additional Instructions: {custom_instructions}' if custom_instructions else ''}

Please provide an enhanced, more detailed version of this prompt that includes:
1. Specific technical recommendations
2. Best practices for the {industry} industry
3. Detailed implementation steps
4. Security and governance considerations
5. Performance optimization tips

Enhanced Prompt:"""

    result = await call_databricks_serving_endpoint(
        prompt=enhancement_prompt,
        system_prompt=system_prompt,
        max_tokens=3000,
        temperature=0.7
    )
    
    return result["response"]


# ============== API Endpoints ==============

@router.get("/industries", response_model=List[Dict], summary="Get list of industries")
async def api_get_industries(response: Response):
    """Returns the list of available industries for the prompt generator.
    Fetches fresh data from database (with cache TTL) to reflect is_active changes.
    """
    # Prevent browser caching
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    # Force cache refresh to get latest is_active status
    clear_lakebase_cache()
    return get_industries()

@router.get("/use-cases/{industry_id}", response_model=List[Dict], summary="Get use cases for an industry")
async def api_get_use_cases(industry_id: str, response: Response):
    """Returns the list of use cases for a specific industry.
    Fetches fresh data from database (with cache TTL) to reflect is_active changes.
    """
    # Prevent browser caching
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    # Force cache refresh to get latest is_active status
    clear_lakebase_cache()
    use_cases = get_use_cases_map()
    if industry_id not in use_cases:
        return [{"value": "", "label": "Select a use case..."}]
    return use_cases[industry_id]

@router.get("/prompt-template/{industry_id}/{use_case_id}", summary="Get prompt template")
async def get_prompt_template(industry_id: str, use_case_id: str):
    """Returns the main prompt template for a specific industry and use case."""
    if industry_id not in PROMPT_TEMPLATES:
        raise HTTPException(status_code=404, detail=f"Industry '{industry_id}' not found")
    
    industry_templates = PROMPT_TEMPLATES[industry_id]
    if use_case_id not in industry_templates:
        raise HTTPException(status_code=404, detail=f"Use case '{use_case_id}' not found for industry '{industry_id}'")
    
    return {
        "industry": industry_id,
        "use_case": use_case_id,
        "prompt": industry_templates[use_case_id]
    }

@router.get("/section-metadata/{section_tag}", summary="Get section metadata (how_to_apply, expected_output)")
async def get_section_metadata_endpoint(
    section_tag: str,
    industry: str = "",
    use_case: str = "",
    session_id: Optional[str] = None,
):
    """
    Lightweight endpoint that returns only how_to_apply, expected_output, and images
    for a given section_tag.  Reads from the Lakebase cache (30-s TTL) without
    clearing it, so it is much faster than /generate-prompt.
    """
    section_content = get_section_input_content(
        industry, use_case, section_tag, None, session_id
    )
    return {
        "how_to_apply": section_content.get("how_to_apply", ""),
        "expected_output": section_content.get("expected_output", ""),
        "how_to_apply_images": section_content.get("how_to_apply_images", []),
        "expected_output_images": section_content.get("expected_output_images", []),
    }


@router.post("/generate-prompt", response_model=GeneratedContent, summary="Generate prompt for a workflow section")
async def generate_prompt(request: PromptRequest):
    """
    Generates the prompt and input content for a specific workflow section
    based on the selected industry and use case.
    
    The 'input' field contains the context/requirements that describe what needs to be built.
    The 'prompt' field contains the LLM-generated actionable prompt based on that input.
    
    Set use_llm=False to skip LLM generation and return the input as the prompt.
    
    For sections that depend on previous steps (e.g., UI Design depends on PRD),
    pass the previous_outputs dict with keys like 'prd_document'.
    """
    content = await generate_prompt_content_with_llm(
        industry=request.industry,
        use_case=request.use_case,
        section_tag=request.section_tag,
        use_llm=request.use_llm,
        previous_outputs=request.previous_outputs,
        session_id=request.session_id
    )
    return GeneratedContent(**content)


async def stream_llm_response(
    industry: str,
    use_case: str, 
    section_tag: str,
    previous_outputs: Optional[Dict[str, str]] = None,
    session_id: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    Stream LLM response using Server-Sent Events format.
    This provides much better perceived performance as users see content immediately.
    
    If bypass_llm is True for this section, returns the input_template as-is without LLM processing.
    
    Args:
        session_id: If provided, uses session-specific parameter overrides
    """
    # Get the input content for this section (uses session parameters if session_id provided)
    section_content = get_section_input_content(industry, use_case, section_tag, previous_outputs, session_id)
    input_text = section_content["input"]
    system_prompt = section_content.get("system_prompt", "You are a helpful assistant.")
    bypass_llm = section_content.get("bypass_llm", False)
    
    # If bypass_llm is True, return system prompt + input text combined (no LLM call)
    if bypass_llm:
        logger.info(f"[Bypass LLM] Section {section_tag} has bypass_llm=True, returning combined output")
        yield f"data: {json.dumps({'type': 'start', 'model': 'bypass_llm'})}\n\n"
        # Combine system prompt (context) and input text (task) with separator
        # System prompt provides context, input text provides the actual instructions
        combined_output = f"""## Context

{system_prompt}

---

{input_text}"""
        yield f"data: {json.dumps({'type': 'content', 'content': combined_output})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return
    
    # Get the workspace client
    client = get_workspace_client()
    endpoint = get_best_available_endpoint()
    
    if not client or not endpoint:
        yield f"data: {json.dumps({'error': 'LLM not available'})}\n\n"
        return
    
    # Build messages
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Generate a detailed prompt based on: {input_text}"}
    ]
    
    # Build streaming request
    request_body = {
        "messages": messages,
        "max_tokens": 4000,  # Increased for full response
        "stream": True  # Enable streaming!
    }
    if "mini" not in endpoint.lower():
        request_body["temperature"] = 0.5
    
    try:
        # Send initial metadata
        yield f"data: {json.dumps({'type': 'start', 'model': endpoint})}\n\n"
        
        # Make streaming request - use SDK's auth mechanism
        import httpx
        workspace_host = client.config.host.rstrip('/')
        
        # Get auth from SDK's config - it auto-refreshes OAuth tokens
        headers = {"Content-Type": "application/json"}
        
        # Get OAuth token from SDK's authenticate method
        try:
            auth_header = client.config.authenticate()
            if auth_header:
                headers.update(auth_header)
        except Exception as auth_err:
            logger.warning(f"  Could not get auth headers: {auth_err}")
        
        async with httpx.AsyncClient(timeout=120.0) as http_client:
            async with http_client.stream(
                "POST",
                f"{workspace_host}/serving-endpoints/{endpoint}/invocations",
                json=request_body,
                headers=headers
            ) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    yield f"data: {json.dumps({'type': 'error', 'error': f'HTTP {response.status_code}: {error_body.decode()[:200]}'})}\n\n"
                    return
                    
                content_buffer = ""
                last_flush = time.monotonic()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            if content_buffer:
                                yield f"data: {json.dumps({'type': 'content', 'content': content_buffer})}\n\n"
                            yield f"data: {json.dumps({'type': 'done'})}\n\n"
                        else:
                            try:
                                chunk = json.loads(data)
                                if "choices" in chunk and chunk["choices"]:
                                    delta = chunk["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        content_buffer += content
                                        now = time.monotonic()
                                        if len(content_buffer) >= 100 or (now - last_flush) >= 0.05:
                                            yield f"data: {json.dumps({'type': 'content', 'content': content_buffer})}\n\n"
                                            content_buffer = ""
                                            last_flush = now
                            except json.JSONDecodeError:
                                pass
                                
    except Exception as e:
        logger.error(f"Streaming error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"


@router.post("/generate-prompt-stream", summary="Stream prompt generation (SSE)")
async def generate_prompt_stream(request: PromptRequest):
    """
    Streaming version of generate-prompt using Server-Sent Events.
    Provides much better perceived performance as content appears immediately.
    
    For sections that depend on previous steps (e.g., UI Design depends on PRD),
    pass the previous_outputs dict with keys like 'prd_document'.
    
    Returns SSE stream with events:
    - {type: 'start', model: '...'} - Initial metadata
    - {type: 'content', content: '...'} - Content chunks
    - {type: 'done'} - Stream complete
    - {type: 'error', error: '...'} - Error occurred
    """
    # Clear cache to ensure fresh data from database
    clear_lakebase_cache()
    
    return StreamingResponse(
        stream_llm_response(
            request.industry, 
            request.use_case, 
            request.section_tag, 
            request.previous_outputs,
            request.session_id  # Use session-specific parameters if provided
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Transfer-Encoding": "chunked",
        }
    )


async def stream_metadata_csv_response(
    csv_content: str,
    session_id: Optional[str] = None,
    industry: str = "sample",
    use_case: str = "booking_app",
    section_tag: str = "bronze_table_metadata_upload"
) -> AsyncGenerator[str, None]:
    """
    Stream LLM response for processing an uploaded metadata CSV.
    Uses the given section_tag config from DB for system prompt and bypass_llm flag.
    If bypass_llm is True, returns the substituted template directly without LLM.
    """
    import csv
    import io

    REQUIRED_COLUMNS = {'table_name', 'column_name', 'data_type', 'ordinal_position', 'is_nullable', 'comment'}

    # Server-side CSV validation
    try:
        reader = csv.reader(io.StringIO(csv_content))
        header = [col.strip().lower() for col in next(reader)]
        missing = REQUIRED_COLUMNS - set(header)
        if missing:
            missing_str = ', '.join(sorted(missing))
            error_msg = f'Missing required columns: {missing_str}'
            yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"
            return
        rows = list(reader)
        if len(rows) == 0:
            yield f"data: {json.dumps({'type': 'error', 'error': 'CSV has no data rows (only header)'})}\n\n"
            return
        table_names = sorted(set(row[header.index('table_name')] for row in rows if row[header.index('table_name')].strip()))
        table_count = len(table_names)
        row_count = len(rows)
    except Exception as e:
        csv_error = f'Invalid CSV: {str(e)}'
        yield f"data: {json.dumps({'type': 'error', 'error': csv_error})}\n\n"
        return

    # Get the section content from DB
    section_content = get_section_input_content(industry, use_case, section_tag, None, session_id)
    input_template = section_content["input"]
    system_prompt_text = section_content.get("system_prompt", "You are a senior data engineer.")
    bypass_llm = section_content.get("bypass_llm", False)

    # Substitute {csv_content} placeholder in the input template
    input_text = input_template.replace('{csv_content}', csv_content)

    # If bypass_llm is True, return combined output directly (no LLM call)
    if bypass_llm:
        logger.info(f"[Bypass LLM] Section {section_tag} has bypass_llm=True, returning combined output")
        yield f"data: {json.dumps({'type': 'start', 'model': 'bypass_llm'})}\n\n"
        combined_output = f"""## Context

{system_prompt_text}

---

{input_text}"""
        yield f"data: {json.dumps({'type': 'content', 'content': combined_output})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return

    # Get workspace client and endpoint
    client = get_workspace_client()
    endpoint = get_best_available_endpoint()

    if not client or not endpoint:
        yield f"data: {json.dumps({'type': 'error', 'error': 'LLM not available'})}\n\n"
        return

    messages = [
        {"role": "system", "content": system_prompt_text},
        {"role": "user", "content": f"Process this uploaded schema CSV ({table_count} tables, {row_count} column definitions) and generate the coding assistant prompt:\n\n{input_text}"}
    ]

    request_body = {
        "messages": messages,
        "max_tokens": 8000,
        "stream": True
    }
    if "mini" not in endpoint.lower():
        request_body["temperature"] = 0.3

    try:
        yield f"data: {json.dumps({'type': 'start', 'model': endpoint})}\n\n"

        import httpx
        workspace_host = client.config.host.rstrip('/')
        headers = {"Content-Type": "application/json"}
        try:
            auth_header = client.config.authenticate()
            if auth_header:
                headers.update(auth_header)
        except Exception as auth_err:
            logger.warning(f"  Could not get auth headers: {auth_err}")

        async with httpx.AsyncClient(timeout=180.0) as http_client:
            async with http_client.stream(
                "POST",
                f"{workspace_host}/serving-endpoints/{endpoint}/invocations",
                json=request_body,
                headers=headers
            ) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    yield f"data: {json.dumps({'type': 'error', 'error': f'HTTP {response.status_code}: {error_body.decode()[:200]}'})}\n\n"
                    return

                content_buffer = ""
                last_flush = time.monotonic()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            if content_buffer:
                                yield f"data: {json.dumps({'type': 'content', 'content': content_buffer})}\n\n"
                            yield f"data: {json.dumps({'type': 'done'})}\n\n"
                        else:
                            try:
                                chunk = json.loads(data)
                                if "choices" in chunk and chunk["choices"]:
                                    delta = chunk["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        content_buffer += content
                                        now = time.monotonic()
                                        if len(content_buffer) >= 100 or (now - last_flush) >= 0.05:
                                            yield f"data: {json.dumps({'type': 'content', 'content': content_buffer})}\n\n"
                                            content_buffer = ""
                                            last_flush = now
                            except json.JSONDecodeError:
                                pass

    except Exception as e:
        logger.error(f"Metadata CSV streaming error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"


@router.post("/process-metadata-csv", summary="Process uploaded metadata CSV (SSE)")
async def process_metadata_csv(request: MetadataCsvRequest):
    """
    Process an uploaded schema metadata CSV through the LLM to generate a
    coding-assistant-ready prompt. Streams the response via Server-Sent Events.
    """
    return StreamingResponse(
        stream_metadata_csv_response(
            request.csv_content,
            request.session_id,
            request.industry,
            request.use_case,
            request.section_tag
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
        }
    )


async def stream_test_prompt_response(
    industry: str,
    use_case: str,
    section_tag: str,
    system_prompt: str,
    input_template: str,
    bypass_llm: bool = False
) -> AsyncGenerator[str, None]:
    """
    Stream test prompt response for Configuration page testing.
    Uses custom system_prompt and input_template values (instead of database values).
    """
    # Format industry and use case names
    industry_name = format_industry_name(industry)
    use_case_title = format_use_case_name(use_case)
    
    # Get the use case description for variable substitution
    prompt_templates = get_prompt_templates_map()
    use_case_description = ""
    if industry.lower() in prompt_templates:
        industry_templates = prompt_templates[industry.lower()]
        if use_case.lower() in industry_templates:
            use_case_description = industry_templates[use_case.lower()]
    
    if not use_case_description:
        use_case_description = f"Build a {use_case_title} solution for the {industry_name} industry."
    
    # Substitute variables in the input template
    params = {
        '{industry_name}': industry_name,
        '{use_case_title}': use_case_title,
        '{use_case_description}': use_case_description,
        '{section_tag}': section_tag,
        '{prd_document}': "[Test mode - PRD placeholder]",
        '{table_metadata}': "[Test mode - Table metadata placeholder]",
        '{silver_layer_output}': "[Test mode - Silver layer output placeholder]",
        '{gold_layer_output}': "[Test mode - Gold layer output placeholder]",
    }
    
    # Add workshop parameters (workspace_url, lakebase_instance_name, lakebase_host_name, etc.)
    workshop_params = get_workshop_parameters_sync()
    for key, value in workshop_params.items():
        params['{' + key + '}'] = value
    
    processed_input = input_template
    processed_system = system_prompt
    for key, value in params.items():
        processed_input = processed_input.replace(key, str(value))
        processed_system = processed_system.replace(key, str(value))
    
    # If bypass_llm is True, return system prompt + processed input combined
    if bypass_llm:
        logger.info(f"[Test] Bypass LLM mode - returning combined output")
        yield f"data: {json.dumps({'type': 'start', 'model': 'bypass_llm'})}\n\n"
        # Combine system prompt (context) and input text (task) with separator
        combined_output = f"""## Context

{processed_system}

---

{processed_input}"""
        yield f"data: {json.dumps({'type': 'content', 'content': combined_output})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return
    
    # Otherwise, call the LLM with the custom prompts
    logger.info(f"[Test] Generating with LLM for section {section_tag}")
    
    # Get workspace client and endpoint (same as regular streaming)
    client = get_workspace_client()
    endpoint = get_best_available_endpoint()
    
    if not client or not endpoint:
        # No LLM configured - return test content without LLM
        no_llm_prefix = "**Test Mode (No LLM configured)**\n\n---\n\n"
        test_content = no_llm_prefix + processed_input
        yield f"data: {json.dumps({'type': 'start', 'model': 'test_mode_no_llm'})}\n\n"
        yield f"data: {json.dumps({'type': 'content', 'content': test_content})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return
    
    # Build messages
    messages = [
        {"role": "system", "content": processed_system},
        {"role": "user", "content": f"Generate a detailed prompt based on: {processed_input}"}
    ]
    
    # Build streaming request
    request_body = {
        "messages": messages,
        "max_tokens": 4000,
        "stream": True
    }
    if "mini" not in endpoint.lower():
        request_body["temperature"] = 0.5
    
    try:
        # Send initial metadata
        yield f"data: {json.dumps({'type': 'start', 'model': endpoint})}\n\n"
        
        # Make streaming request
        import httpx
        workspace_host = client.config.host.rstrip('/')
        
        headers = {"Content-Type": "application/json"}
        try:
            auth_header = client.config.authenticate()
            if auth_header:
                headers.update(auth_header)
        except Exception as auth_err:
            logger.warning(f"[Test] Could not get auth headers: {auth_err}")
        
        async with httpx.AsyncClient(timeout=120.0) as http_client:
            async with http_client.stream(
                "POST",
                f"{workspace_host}/serving-endpoints/{endpoint}/invocations",
                json=request_body,
                headers=headers
            ) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    yield f"data: {json.dumps({'type': 'error', 'error': f'HTTP {response.status_code}: {error_body.decode()[:200]}'})}\n\n"
                    return
                
                content_buffer = ""
                last_flush = time.monotonic()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            if content_buffer:
                                yield f"data: {json.dumps({'type': 'content', 'content': content_buffer})}\n\n"
                            yield f"data: {json.dumps({'type': 'done'})}\n\n"
                        else:
                            try:
                                chunk = json.loads(data)
                                if "choices" in chunk and chunk["choices"]:
                                    delta = chunk["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        content_buffer += content
                                        now = time.monotonic()
                                        if len(content_buffer) >= 100 or (now - last_flush) >= 0.05:
                                            yield f"data: {json.dumps({'type': 'content', 'content': content_buffer})}\n\n"
                                            content_buffer = ""
                                            last_flush = now
                            except json.JSONDecodeError:
                                pass
    
    except Exception as e:
        logger.error(f"[Test] LLM streaming error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"


@router.post("/test-prompt-stream", summary="Test prompt generation with custom values (SSE)")
async def test_prompt_stream(request: TestPromptRequest):
    """
    Test prompt generation with custom system_prompt and input_template values.
    Used by the Configuration page to preview how prompts will be generated.
    
    This endpoint allows testing changes before saving them to the database.
    
    Returns SSE stream with events:
    - {type: 'start', model: '...'} - Initial metadata
    - {type: 'content', content: '...'} - Content chunks
    - {type: 'done'} - Stream complete
    - {type: 'error', error: '...'} - Error occurred
    """
    return StreamingResponse(
        stream_test_prompt_response(
            request.industry,
            request.use_case,
            request.section_tag,
            request.system_prompt,
            request.input_template,
            request.bypass_llm
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
        }
    )


@router.get("/workflow-steps", response_model=List[Dict], summary="Get workflow steps configuration")
async def get_workflow_steps():
    """Returns the configuration for all workflow steps."""
    return WORKFLOW_STEPS

@router.get("/prerequisites", response_model=List[Dict], summary="Get prerequisites list")
async def get_prerequisites():
    """Returns the list of prerequisites for the workflow."""
    return PREREQUISITES

@router.get("/all-data", summary="Get all configuration data")
async def get_all_data(response: Response):
    """
    Returns all configuration data in a single request.
    Useful for initial page load to minimize API calls.
    
    NOTE: Always fetches fresh data from database to reflect is_active changes.
    """
    # Prevent browser caching
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    # Clear cache and fetch fresh data (not stale global variables!)
    clear_lakebase_cache()
    
    return {
        "industries": get_industries(),
        "use_cases": get_use_cases_map(),
        "prompt_templates": get_prompt_templates_map(),
        "workflow_steps": get_workflow_steps_list() or WORKFLOW_STEPS,
        "prerequisites": PREREQUISITES,
        "disabled_steps": get_disabled_step_tags()
    }


# ============== LLM / Databricks Serving Endpoints ==============

@router.post("/llm/chat", response_model=LLMResponse, summary="Call Databricks serving endpoint")
async def call_llm(request: LLMRequest):
    """
    Call a Databricks Model Serving endpoint (GPT-4, GPT-5.2, or custom models).
    
    This endpoint allows you to send prompts to Databricks-hosted LLMs
    and receive AI-generated responses.
    
    Supported endpoints (configure via DATABRICKS_SERVING_ENDPOINT env var):
    - gpt-4o-mini (default)
    - gpt-4o
    - gpt-5.2
    - Custom foundation model endpoints
    """
    result = await call_databricks_serving_endpoint(
        prompt=request.prompt,
        endpoint_name=request.endpoint_name,
        max_tokens=request.max_tokens,
        temperature=request.temperature
    )
    return LLMResponse(**result)


@router.post("/llm/enhance-prompt", summary="Enhance a prompt using LLM")
async def enhance_prompt_endpoint(request: EnhancedPromptRequest):
    """
    Generate a prompt and optionally enhance it using an LLM.
    
    If enhance_with_llm is True, the base prompt will be sent to the
    Databricks serving endpoint to be enhanced with more specific details,
    best practices, and implementation guidance.
    """
    # First generate the base prompt
    base_content = generate_prompt_content(
        request.industry,
        request.use_case,
        request.section_tag
    )
    
    if not request.enhance_with_llm:
        return {
            "original_prompt": base_content["prompt"],
            "enhanced_prompt": None,
            "input": base_content["input"],
            "enhanced": False
        }
    
    # Enhance the prompt using LLM
    enhanced = await enhance_prompt_with_llm(
        base_prompt=base_content["prompt"],
        industry=request.industry,
        use_case=request.use_case,
        custom_instructions=request.custom_instructions
    )
    
    return {
        "original_prompt": base_content["prompt"],
        "enhanced_prompt": enhanced,
        "input": base_content["input"],
        "enhanced": True
    }


@router.get("/llm/endpoints", summary="List available serving endpoints")
async def list_serving_endpoints():
    """
    Returns information about available Databricks serving endpoints.
    
    When running as a Databricks App, authentication is automatic via OAuth.
    No token configuration is needed.
    
    This endpoint dynamically discovers available serving endpoints in your workspace.
    """
    # Check SDK and client availability
    client = get_workspace_client()
    
    # Determine connection status
    connection_status = "unknown"
    auth_method = "unknown"
    current_user_name = None
    
    if client:
        try:
            # Test the connection by getting current user
            current_user = client.current_user.me()
            current_user_name = current_user.user_name
            connection_status = f"connected_as_{current_user_name}"
            auth_method = "oauth_automatic"
        except Exception as e:
            connection_status = f"sdk_available_but_error: {str(e)[:50]}"
            auth_method = "error"
    elif DATABRICKS_SDK_AVAILABLE:
        connection_status = "sdk_available_client_not_initialized"
        auth_method = "not_configured"
    else:
        connection_status = "sdk_not_installed"
        auth_method = "none"
    
    # Get actual available endpoints from the workspace
    available_endpoint_names = get_available_serving_endpoints()
    
    # Get the best available endpoint
    best_endpoint = get_best_available_endpoint()
    
    # Build response with actual endpoints
    actual_endpoints = [
        {"name": name, "available": True}
        for name in available_endpoint_names
    ]
    
    return {
        "configured_endpoint": SERVING_ENDPOINT_NAME or "(auto-discover)",
        "selected_endpoint": best_endpoint,
        "authentication": {
            "method": auth_method,
            "description": "OAuth automatic authentication when running as Databricks App - no token needed!",
            "sdk_available": DATABRICKS_SDK_AVAILABLE,
            "current_user": current_user_name
        },
        "workspace_endpoints": actual_endpoints,
        "workspace_endpoint_count": len(actual_endpoints),
        "fallback_endpoints": FALLBACK_ENDPOINTS,
        "connection_status": connection_status,
        "instructions": {
            "to_use_specific_endpoint": "Set DATABRICKS_SERVING_ENDPOINT environment variable in app.yaml",
            "example": "DATABRICKS_SERVING_ENDPOINT=your-endpoint-name"
        }
    }


# =============================================================================
# CONFIGURATION MANAGEMENT API ENDPOINTS (Admin UI)
# =============================================================================


def _get_current_user() -> str:
    """Get current user for audit fields."""
    try:
        client = get_workspace_client()
        if client:
            return client.current_user.me().user_name
    except:
        pass
    return "system"


def _invalidate_cache():
    """Invalidate the Lakebase cache to force refresh on next read."""
    clear_lakebase_cache()  # Use the complete cache clear function


# ---------- Prompt Config Endpoints ----------

@router.get("/config/prompts/latest")
async def get_latest_prompt_configs(response: Response) -> List[PromptConfigResponse]:
    """
    Get the latest version of all prompt configurations.
    Returns one row per (industry, use_case) with the highest version.
    NOTE: Returns ALL configs (active and inactive) for configuration management.
    """
    logger.info("[Config API] Fetching latest prompt configs")
    
    # Prevent browser caching and clear backend cache for fresh data
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    clear_lakebase_cache()
    
    schema = get_schema()
    sql = f"""
        SELECT DISTINCT ON (industry, use_case)
            config_id, industry, industry_label, use_case, use_case_label, 
            prompt_template, version, is_active, 
            TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') as inserted_at, 
            TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at, 
            created_by
        FROM {schema}.usecase_descriptions
        ORDER BY industry, use_case, version DESC
    """
    
    results = execute_query(sql)
    
    if not results:
        # Fallback to YAML
        yaml_config = get_yaml_config()
        yaml_templates = yaml_config.get('prompt_templates', {})
        yaml_industries = yaml_config.get('industries', [])
        yaml_use_cases = yaml_config.get('use_cases', {})
        
        configs = []
        for industry_opt in yaml_industries:
            if not industry_opt.get('value'):
                continue
            industry = industry_opt['value']
            industry_label = industry_opt['label']
            
            for uc in yaml_use_cases.get(industry, []):
                if not uc.get('value'):
                    continue
                use_case = uc['value']
                use_case_label = uc['label']
                template = yaml_templates.get(industry, {}).get(use_case, '')
                
                configs.append(PromptConfigResponse(
                    industry=industry,
                    industry_label=industry_label,
                    use_case=use_case,
                    use_case_label=use_case_label,
                    prompt_template=template,
                    version=1,
                    is_active=True
                ))
        return configs
    
    return [PromptConfigResponse(**row) for row in results]


@router.get("/config/prompts/versions")
async def get_prompt_config_versions(industry: str, use_case: str) -> List[ConfigVersionInfo]:
    """
    Get versions of a specific prompt configuration.
    Returns only the 5 most recent versions (sorted by version descending).
    """
    logger.info(f"[Config API] Fetching versions for {industry}/{use_case}")
    
    schema = get_schema()
    sql = f"""
        SELECT version, 
               TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') as inserted_at, 
               TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at, 
               created_by, is_active
        FROM {schema}.usecase_descriptions
        WHERE industry = %s AND use_case = %s
        ORDER BY version DESC
        LIMIT 5
    """
    
    results = execute_query(sql, (industry, use_case))
    
    if not results:
        return [ConfigVersionInfo(version=1, is_active=True)]
    
    return [ConfigVersionInfo(**row) for row in results]


@router.get("/config/prompts/version/{industry}/{use_case}/{version}")
async def get_prompt_config_by_version(industry: str, use_case: str, version: int) -> PromptConfigResponse:
    """
    Get a specific version of a prompt configuration.
    """
    logger.info(f"[Config API] Fetching {industry}/{use_case} version {version}")
    
    schema = get_schema()
    sql = f"""
        SELECT config_id, industry, industry_label, use_case, use_case_label, 
               prompt_template, version, is_active, 
               TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') as inserted_at, 
               TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at, 
               created_by
        FROM {schema}.usecase_descriptions
        WHERE industry = %s AND use_case = %s AND version = %s
    """
    
    results = execute_query(sql, (industry, use_case, version))
    
    if not results:
        raise HTTPException(status_code=404, detail=f"Version {version} not found for {industry}/{use_case}")
    
    return PromptConfigResponse(**results[0])


@router.post("/config/cache/refresh")
async def refresh_config_cache() -> Dict[str, Any]:
    """
    Force refresh the Lakebase configuration cache.
    Use this after making direct database updates to see changes immediately.
    """
    logger.info("[Config API] Manual cache refresh requested")
    clear_lakebase_cache()
    # Force immediate refresh
    _refresh_lakebase_cache()
    return {
        "status": "success",
        "message": "Cache refreshed successfully",
        "cache_entries": {
            "usecase_descriptions": len(_lakebase_cache.get("usecase_descriptions") or []),
            "section_input_prompts": len(_lakebase_cache.get("section_input_prompts") or [])
        }
    }


@router.post("/config/prompts")
async def create_prompt_config(request: PromptConfigCreate) -> PromptConfigResponse:
    """
    Create a new version of a prompt configuration.
    Computes next version automatically (max + 1).
    Never updates existing rows - always appends.
    """
    logger.info(f"[Config API] Creating new prompt config version for {request.industry}/{request.use_case}")
    
    schema = get_schema()
    current_user = _get_current_user()
    
    # Get current max version for this industry/use_case
    version_sql = f"""
        SELECT COALESCE(MAX(version), 0) as max_version
        FROM {schema}.usecase_descriptions
        WHERE industry = %s AND use_case = %s
    """
    version_result = execute_query(version_sql, (request.industry, request.use_case))
    next_version = int(version_result[0].get('max_version', 0)) + 1 if version_result else 1
    
    # Insert new row with computed version
    insert_sql = f"""
        INSERT INTO {schema}.usecase_descriptions 
        (industry, industry_label, use_case, use_case_label, prompt_template, 
         version, is_active, inserted_at, updated_at, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, %s)
    """
    
    success = execute_insert(insert_sql, (
        request.industry,
        request.industry_label,
        request.use_case,
        request.use_case_label,
        request.prompt_template,
        next_version,
        current_user
    ))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create prompt configuration")
    
    # Invalidate cache so next read gets fresh data
    _invalidate_cache()
    
    logger.info(f"[Config API] Created prompt config version {next_version} for {request.industry}/{request.use_case}")
    
    return PromptConfigResponse(
        industry=request.industry,
        industry_label=request.industry_label,
        use_case=request.use_case,
        use_case_label=request.use_case_label,
        prompt_template=request.prompt_template,
        version=next_version,
        is_active=True,
        created_by=current_user
    )


@router.post("/config/industries")
async def add_industry(request: IndustryCreate) -> Dict[str, Any]:
    """
    Add a new industry by creating a placeholder prompt config.
    """
    logger.info(f"[Config API] Adding new industry: {request.industry}")
    
    schema = get_schema()
    # Check if industry already exists
    check_sql = f"""
        SELECT 1 FROM {schema}.usecase_descriptions
        WHERE industry = %s
        LIMIT 1
    """
    existing = execute_query(check_sql, (request.industry,))
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Industry '{request.industry}' already exists")
    
    # Create a placeholder prompt config for this industry
    config = PromptConfigCreate(
        industry=request.industry,
        industry_label=request.industry_label,
        use_case="_placeholder",
        use_case_label="(No use cases yet)",
        prompt_template=""
    )
    
    await create_prompt_config(config)
    
    return {
        "success": True,
        "industry": request.industry,
        "industry_label": request.industry_label,
        "message": f"Industry '{request.industry_label}' created successfully"
    }


@router.post("/config/use-cases")
async def add_use_case(request: UseCaseCreate) -> Dict[str, Any]:
    """
    Add a new use case under an existing industry.
    """
    logger.info(f"[Config API] Adding new use case: {request.industry}/{request.use_case}")
    
    schema = get_schema()
    # Check if industry exists
    check_sql = f"""
        SELECT industry_label FROM {schema}.usecase_descriptions
        WHERE industry = %s
        LIMIT 1
    """
    existing = execute_query(check_sql, (request.industry,))
    
    if not existing:
        raise HTTPException(status_code=404, detail=f"Industry '{request.industry}' not found")
    
    industry_label = existing[0].get('industry_label', request.industry.title())
    
    # Create prompt config for this use case
    config = PromptConfigCreate(
        industry=request.industry,
        industry_label=industry_label,
        use_case=request.use_case,
        use_case_label=request.use_case_label,
        prompt_template=""
    )
    
    await create_prompt_config(config)
    
    return {
        "success": True,
        "industry": request.industry,
        "use_case": request.use_case,
        "use_case_label": request.use_case_label,
        "message": f"Use case '{request.use_case_label}' created successfully"
    }


@router.patch("/config/prompts/{industry}/{use_case}/toggle-active")
async def toggle_usecase_active(industry: str, use_case: str) -> Dict[str, Any]:
    """
    Toggle the is_active flag for a use case.
    This controls whether the use case appears in the workflow dropdown.
    """
    logger.info(f"[Config API] Toggling active status for {industry}/{use_case}")
    
    schema = get_schema()
    
    # Get current is_active status
    check_sql = f"""
        SELECT is_active FROM {schema}.usecase_descriptions
        WHERE industry = %s AND use_case = %s
        LIMIT 1
    """
    existing = execute_query(check_sql, (industry, use_case))
    
    if not existing:
        raise HTTPException(status_code=404, detail=f"Use case '{industry}/{use_case}' not found")
    
    current_status = existing[0].get('is_active', False)
    new_status = not current_status
    
    # Update all versions of this use case
    update_sql = f"""
        UPDATE {schema}.usecase_descriptions
        SET is_active = %s, updated_at = CURRENT_TIMESTAMP
        WHERE industry = %s AND use_case = %s
    """
    
    success = execute_insert(update_sql, (new_status, industry, use_case))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to toggle active status")
    
    # Invalidate cache
    _invalidate_cache()
    
    logger.info(f"[Config API] Toggled {industry}/{use_case} to is_active={new_status}")
    
    return {
        "success": True,
        "industry": industry,
        "use_case": use_case,
        "is_active": new_status,
        "message": f"Use case is now {'active' if new_status else 'inactive'}"
    }


@router.delete("/config/prompts/{industry}/{use_case}")
async def delete_usecase(industry: str, use_case: str) -> Dict[str, Any]:
    """
    Delete a use case and all its versions.
    This is a hard delete - use toggle-active for soft disable.
    """
    logger.info(f"[Config API] Deleting use case: {industry}/{use_case}")
    
    schema = get_schema()
    
    # Check if use case exists
    check_sql = f"""
        SELECT COUNT(*) as count FROM {schema}.usecase_descriptions
        WHERE industry = %s AND use_case = %s
    """
    existing = execute_query(check_sql, (industry, use_case))
    
    if not existing or existing[0].get('count', 0) == 0:
        raise HTTPException(status_code=404, detail=f"Use case '{industry}/{use_case}' not found")
    
    # Delete all versions
    delete_sql = f"""
        DELETE FROM {schema}.usecase_descriptions
        WHERE industry = %s AND use_case = %s
    """
    
    success = execute_insert(delete_sql, (industry, use_case))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete use case")
    
    # Invalidate cache
    _invalidate_cache()
    
    logger.info(f"[Config API] Deleted use case: {industry}/{use_case}")
    
    return {
        "success": True,
        "message": f"Use case '{industry}/{use_case}' deleted successfully"
    }


@router.delete("/config/industries/{industry}")
async def delete_industry(industry: str) -> Dict[str, Any]:
    """
    Delete an industry and all its use cases.
    This is a hard delete.
    """
    logger.info(f"[Config API] Deleting industry: {industry}")
    
    schema = get_schema()
    
    # Check if industry exists
    check_sql = f"""
        SELECT COUNT(*) as count FROM {schema}.usecase_descriptions
        WHERE industry = %s
    """
    existing = execute_query(check_sql, (industry,))
    
    if not existing or existing[0].get('count', 0) == 0:
        raise HTTPException(status_code=404, detail=f"Industry '{industry}' not found")
    
    # Delete all use cases in this industry
    delete_sql = f"""
        DELETE FROM {schema}.usecase_descriptions
        WHERE industry = %s
    """
    
    success = execute_insert(delete_sql, (industry,))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete industry")
    
    # Invalidate cache
    _invalidate_cache()
    
    logger.info(f"[Config API] Deleted industry: {industry}")
    
    return {
        "success": True,
        "message": f"Industry '{industry}' and all its use cases deleted successfully"
    }


# ---------- Section Input Endpoints ----------

@router.get("/config/section-inputs/latest")
async def get_latest_section_inputs(response: Response) -> List[SectionInputResponse]:
    """
    Get the latest version of all section inputs.
    Returns one row per section_tag with the highest version.
    Ordered by order_number ascending.
    """
    logger.info("[Config API] Fetching latest section inputs")
    
    # Prevent browser caching and clear backend cache for fresh data
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    clear_lakebase_cache()
    
    schema = get_schema()
    sql = f"""
        SELECT DISTINCT ON (section_tag)
            input_id, section_tag, section_title, section_description,
            input_template, system_prompt, order_number, how_to_apply, expected_output,
            how_to_apply_images, expected_output_images,
            bypass_llm, step_enabled,
            version, is_active,
            TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') as inserted_at,
            TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at,
            created_by
        FROM {schema}.section_input_prompts
        WHERE is_active = TRUE
        ORDER BY section_tag, version DESC
    """
    
    results = execute_query(sql)
    # Sort by order_number after fetching (since DISTINCT ON doesn't allow different ORDER BY)
    if results:
        results = sorted(results, key=lambda x: (x.get('order_number') or 999, x.get('section_tag', '')))
    
    if not results:
        # No YAML fallback - return empty list with error info
        logger.warning("[Database Required] No section_input_prompts found in Lakebase. Run setup-lakebase.sh --recreate to seed data.")
        return []
    
    # Parse JSON image fields
    for row in results:
        for field in ('how_to_apply_images', 'expected_output_images'):
            if row.get(field):
                if isinstance(row[field], str):
                    try:
                        row[field] = json.loads(row[field])
                    except json.JSONDecodeError:
                        row[field] = []
            else:
                row[field] = []
    
    return [SectionInputResponse(**row) for row in results]


@router.get("/config/section-inputs/versions")
async def get_section_input_versions(section_tag: str) -> List[ConfigVersionInfo]:
    """
    Get versions of a specific section input.
    Returns only the 5 most recent versions (sorted by version descending).
    """
    logger.info(f"[Config API] Fetching versions for section: {section_tag}")
    
    schema = get_schema()
    sql = f"""
        SELECT version, 
               TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') as inserted_at, 
               TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at, 
               created_by, is_active
        FROM {schema}.section_input_prompts
        WHERE section_tag = %s
        ORDER BY version DESC
        LIMIT 5
    """
    
    results = execute_query(sql, (section_tag,))
    
    if not results:
        return [ConfigVersionInfo(version=1, is_active=True)]
    
    return [ConfigVersionInfo(**row) for row in results]


@router.get("/config/section-inputs/version/{section_tag}/{version}")
async def get_section_input_by_version(section_tag: str, version: int) -> SectionInputResponse:
    """
    Get a specific version of a section input.
    """
    logger.info(f"[Config API] Fetching {section_tag} version {version}")
    
    schema = get_schema()
    sql = f"""
        SELECT input_id, section_tag, section_title, section_description,
               input_template, system_prompt, order_number, how_to_apply, expected_output,
               how_to_apply_images, expected_output_images,
               bypass_llm,
               version, is_active,
               TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') as inserted_at,
               TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at,
               created_by
        FROM {schema}.section_input_prompts
        WHERE section_tag = %s AND version = %s
    """
    
    results = execute_query(sql, (section_tag, version))
    
    if not results:
        raise HTTPException(status_code=404, detail=f"Version {version} not found for section {section_tag}")
    
    # Parse JSON image fields
    row = results[0]
    for field in ('how_to_apply_images', 'expected_output_images'):
        if row.get(field):
            if isinstance(row[field], str):
                try:
                    row[field] = json.loads(row[field])
                except json.JSONDecodeError:
                    row[field] = []
        else:
            row[field] = []
    
    return SectionInputResponse(**row)


@router.post("/config/section-inputs")
async def create_section_input(request: SectionInputCreate) -> SectionInputResponse:
    """
    Create a new version of a section input.
    Computes next version automatically (max + 1).
    Never updates existing rows - always appends.
    """
    logger.info(f"[Config API] Creating new section input version for {request.section_tag}")
    
    schema = get_schema()
    order_number = request.order_number
    current_user = _get_current_user()
    
    # Get current max version, existing order_number, and bypass_llm for this section_tag
    version_sql = f"""
        SELECT COALESCE(MAX(version), 0) as max_version,
               MAX(order_number) as existing_order
        FROM {schema}.section_input_prompts
        WHERE section_tag = %s
    """
    version_result = execute_query(version_sql, (request.section_tag,))
    next_version = int(version_result[0].get('max_version', 0)) + 1 if version_result else 1
    
    # Use existing order_number if not provided
    if order_number is None and version_result and version_result[0].get('existing_order'):
        order_number = int(version_result[0]['existing_order'])
    
    # Resolve bypass_llm: inherit from previous version when not explicitly provided
    resolved_bypass_llm = request.bypass_llm
    if resolved_bypass_llm is None:
        prev_bypass_sql = f"""
            SELECT bypass_llm FROM {schema}.section_input_prompts
            WHERE section_tag = %s AND is_active = TRUE
            ORDER BY version DESC LIMIT 1
        """
        prev_result = execute_query(prev_bypass_sql, (request.section_tag,))
        resolved_bypass_llm = prev_result[0].get('bypass_llm', False) if prev_result else False
        logger.info(f"[Config API] bypass_llm not provided for {request.section_tag}, inheriting previous value: {resolved_bypass_llm}")
    else:
        # Warn if bypass_llm is being changed from TRUE to FALSE
        prev_bypass_sql = f"""
            SELECT bypass_llm FROM {schema}.section_input_prompts
            WHERE section_tag = %s AND is_active = TRUE
            ORDER BY version DESC LIMIT 1
        """
        prev_result = execute_query(prev_bypass_sql, (request.section_tag,))
        if prev_result and prev_result[0].get('bypass_llm') is True and resolved_bypass_llm is False:
            logger.warning(f"[Config API] bypass_llm changing from TRUE to FALSE for {request.section_tag} — was this intentional?")
    
    # Insert new row with computed version
    insert_sql = f"""
        INSERT INTO {schema}.section_input_prompts 
        (section_tag, section_title, section_description, input_template, system_prompt,
         order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, %s)
    """
    
    success = execute_insert(insert_sql, (
        request.section_tag,
        request.section_title or '',
        request.section_description or '',
        request.input_template,
        request.system_prompt,
        order_number,
        request.how_to_apply or '',
        request.expected_output or '',
        resolved_bypass_llm,
        next_version,
        current_user
    ))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create section input")
    
    # Invalidate cache so next read gets fresh data
    _invalidate_cache()
    
    logger.info(f"[Config API] Created section input version {next_version} for {request.section_tag}")
    
    return SectionInputResponse(
        section_tag=request.section_tag,
        section_title=request.section_title,
        section_description=request.section_description,
        input_template=request.input_template,
        system_prompt=request.system_prompt,
        order_number=order_number,
        how_to_apply=request.how_to_apply,
        expected_output=request.expected_output,
        version=next_version,
        is_active=True,
        created_by=current_user
    )


@router.get("/config/section-tags")
async def get_section_tags() -> List[Dict[str, str]]:
    """
    Get all unique section tags for the dropdown.
    """
    logger.info("[Config API] Fetching section tags")
    
    schema = get_schema()
    sql = f"""
        SELECT DISTINCT section_tag, section_title
        FROM {schema}.section_input_prompts
        WHERE is_active = TRUE
        ORDER BY section_tag
    """
    
    results = execute_query(sql)
    
    if not results:
        # No YAML fallback - return empty list
        logger.warning("[Database Required] No section tags found in Lakebase. Run setup-lakebase.sh --recreate to seed data.")
        return []
    

    return [{"section_tag": row.get('section_tag'), 
             "section_title": row.get('section_title') or row.get('section_tag', '').replace('_', ' ').title()} 
            for row in results]


@router.delete("/config/section-inputs/{section_tag}")
async def delete_section_input(section_tag: str) -> Dict[str, Any]:
    """
    Delete a section input and all its versions.
    This is a hard delete.
    """
    logger.info(f"[Config API] Deleting section input: {section_tag}")
    
    schema = get_schema()
    
    # Check if section input exists
    check_sql = f"""
        SELECT COUNT(*) as count FROM {schema}.section_input_prompts
        WHERE section_tag = %s
    """
    existing = execute_query(check_sql, (section_tag,))
    
    if not existing or existing[0].get('count', 0) == 0:
        raise HTTPException(status_code=404, detail=f"Section input '{section_tag}' not found")
    
    # Delete all versions
    delete_sql = f"""
        DELETE FROM {schema}.section_input_prompts
        WHERE section_tag = %s
    """
    
    success = execute_insert(delete_sql, (section_tag,))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete section input")
    
    # Invalidate cache
    _invalidate_cache()
    
    logger.info(f"[Config API] Deleted section input: {section_tag}")
    
    return {
        "success": True,
        "message": f"Section input '{section_tag}' deleted successfully"
    }


# =============================================================================
# STEP VISIBILITY API ENDPOINTS
# =============================================================================

def get_disabled_step_tags() -> List[str]:
    """Return section_tags where step_enabled=FALSE among active rows."""
    schema = get_schema()
    sql = f"""
        SELECT DISTINCT section_tag FROM {schema}.section_input_prompts
        WHERE step_enabled = FALSE AND is_active = TRUE
    """
    rows = execute_query(sql)
    return [r['section_tag'] for r in rows]


@router.get("/config/disabled-steps", summary="Get disabled step section tags")
async def get_disabled_steps():
    """Returns a list of section_tag values where step_enabled is FALSE."""
    return get_disabled_step_tags()


@router.put("/config/step-visibility/{section_tag}", summary="Toggle step visibility")
async def toggle_step_visibility(section_tag: str, body: StepVisibilityUpdate):
    """Enable or disable a step across all its versions."""
    logger.info(f"[Config API] Setting step_enabled={body.enabled} for section_tag={section_tag}")

    schema = get_schema()
    check_sql = f"SELECT COUNT(*) as count FROM {schema}.section_input_prompts WHERE section_tag = %s"
    existing = execute_query(check_sql, (section_tag,))
    if not existing or existing[0].get('count', 0) == 0:
        raise HTTPException(status_code=404, detail=f"Section tag '{section_tag}' not found")

    sql = f"UPDATE {schema}.section_input_prompts SET step_enabled = %s WHERE section_tag = %s"
    execute_insert(sql, (body.enabled, section_tag))
    _invalidate_cache()

    return {"success": True, "section_tag": section_tag, "step_enabled": body.enabled}


# =============================================================================
# WORKSHOP PARAMETERS API ENDPOINTS
# =============================================================================
# Workshop parameters are key-value pairs that users can configure via the UI.
# These parameters are available to all section input prompts and are passed
# using {param_key} syntax for variable substitution (e.g., {workspace_url}).
# =============================================================================

class WorkshopParameter(BaseModel):
    """Workshop parameter model"""
    param_id: Optional[int] = Field(None, description="Parameter ID")
    param_key: str = Field(..., description="Unique parameter key used in templates")
    param_label: str = Field(..., description="Display label for the parameter")
    param_value: str = Field(..., description="Current parameter value")
    param_description: Optional[str] = Field(None, description="Description of what this parameter is for")
    param_type: str = Field("text", description="Type hint: text, url, select, number")
    display_order: int = Field(0, description="Display order in UI")
    is_required: bool = Field(False, description="Whether this parameter is required")
    is_active: bool = Field(True, description="Whether this parameter is active")
    allow_session_override: bool = Field(True, description="Whether users can override at session level")


class WorkshopParameterUpdate(BaseModel):
    """Request to update a workshop parameter"""
    param_value: str = Field(..., description="New value for the parameter")


@router.get("/config/workshop-parameters")
async def get_workshop_parameters(response: Response) -> List[WorkshopParameter]:
    """
    Get all workshop parameters.
    These parameters are available to all workflow steps and can be used in
    prompt templates using {param_key} syntax.
    """
    logger.info("[Config API] Fetching workshop parameters")
    
    # Prevent browser caching for fresh data
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    schema = get_schema()
    sql = f"""
        SELECT param_id, param_key, param_label, param_value, param_description,
               param_type, display_order, is_required, is_active,
               COALESCE(allow_session_override, TRUE) as allow_session_override
        FROM {schema}.workshop_parameters
        WHERE is_active = TRUE
        ORDER BY display_order, param_key
    """
    
    results = execute_query(sql)
    
    if not results:
        logger.warning("[Database Required] No workshop parameters found. Run setup-lakebase.sh --recreate to seed data.")
        # Return default parameters as fallback
        return [
            WorkshopParameter(
                param_key="workspace_url",
                param_label="Databricks Workspace URL",
                param_value=os.getenv('WORKSPACE_URL', ''),
                param_description="The URL of your Databricks workspace",
                param_type="url",
                display_order=1,
                is_required=True,
                is_active=True,
                allow_session_override=True
            ),
            WorkshopParameter(
                param_key="workspace_org_id",
                param_label="Workspace Org ID",
                param_value=os.getenv('WORKSPACE_ORG_ID', ''),
                param_description="The numeric workspace/org ID used in the ?o= query parameter for Databricks workspace URLs",
                param_type="text",
                display_order=1,
                is_required=True,
                is_active=True,
                allow_session_override=True
            ),
            WorkshopParameter(
                param_key="default_warehouse",
                param_label="Default SQL Warehouse",
                param_value=os.getenv('DEFAULT_WAREHOUSE', ''),
                param_description="The name of the SQL Warehouse to use for Lakehouse operations",
                param_type="text",
                display_order=2,
                is_required=True,
                is_active=True,
                allow_session_override=True
            ),
            WorkshopParameter(
                param_key="lakebase_instance_name",
                param_label="Lakebase Instance Name",
                param_value=os.getenv('LAKEBASE_INSTANCE_NAME', ''),
                param_description="The name of the Lakebase PostgreSQL instance",
                param_type="text",
                display_order=3,
                is_required=True,
                is_active=True,
                allow_session_override=False
            ),
            WorkshopParameter(
                param_key="lakebase_host_name",
                param_label="Lakebase Host Name",
                param_value=os.getenv('LAKEBASE_HOST', ''),
                param_description="The DNS hostname of the Lakebase PostgreSQL instance",
                param_type="text",
                display_order=4,
                is_required=True,
                is_active=True,
                allow_session_override=False
            ),
            WorkshopParameter(
                param_key="company_brand_url",
                param_label="Company Brand URL",
                param_value="",
                param_description="Full URL to a page with brand colors and assets (e.g. https://www.brandcolorcode.com/ralph-lauren-corporation). When set, UI design prompts will include branding instructions. Leave blank to skip branding.",
                param_type="text",
                display_order=9,
                is_required=False,
                is_active=True,
                allow_session_override=True
            ),
            WorkshopParameter(
                param_key="lakebase_uc_catalog_name",
                param_label="Lakebase UC Catalog Name",
                param_value=os.getenv('LAKEBASE_UC_CATALOG', ''),
                param_description="The Unity Catalog catalog name used to register the Lakebase database for read-only access.",
                param_type="catalog",
                display_order=10,
                is_required=True,
                is_active=True,
                allow_session_override=True
            )
        ]
    
    return [WorkshopParameter(**row) for row in results]


@router.get("/config/workshop-parameters/{param_key}")
async def get_workshop_parameter(param_key: str) -> WorkshopParameter:
    """
    Get a specific workshop parameter by key.
    """
    logger.info(f"[Config API] Fetching workshop parameter: {param_key}")
    
    schema = get_schema()
    sql = f"""
        SELECT param_id, param_key, param_label, param_value, param_description,
               param_type, display_order, is_required, is_active,
               COALESCE(allow_session_override, TRUE) as allow_session_override
        FROM {schema}.workshop_parameters
        WHERE param_key = %s AND is_active = TRUE
    """
    
    results = execute_query(sql, (param_key,))
    
    if not results:
        raise HTTPException(status_code=404, detail=f"Parameter '{param_key}' not found")
    
    return WorkshopParameter(**results[0])


@router.put("/config/workshop-parameters/{param_key}")
async def update_workshop_parameter(param_key: str, update: WorkshopParameterUpdate) -> Dict[str, Any]:
    """
    Update a workshop parameter value.
    """
    logger.info(f"[Config API] Updating workshop parameter: {param_key} = {update.param_value[:50]}...")
    
    schema = get_schema()
    
    # Check if parameter exists
    check_sql = f"""
        SELECT param_id FROM {schema}.workshop_parameters
        WHERE param_key = %s AND is_active = TRUE
    """
    existing = execute_query(check_sql, (param_key,))
    
    if not existing:
        raise HTTPException(status_code=404, detail=f"Parameter '{param_key}' not found")
    
    # Update the parameter
    update_sql = f"""
        UPDATE {schema}.workshop_parameters
        SET param_value = %s, updated_at = CURRENT_TIMESTAMP
        WHERE param_key = %s AND is_active = TRUE
    """
    
    success = execute_insert(update_sql, (update.param_value, param_key))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update parameter")
    
    logger.info(f"[Config API] Successfully updated workshop parameter: {param_key}")
    
    return {
        "success": True,
        "message": f"Parameter '{param_key}' updated successfully",
        "param_key": param_key,
        "param_value": update.param_value
    }


@router.delete("/config/workshop-parameters/{param_key}")
async def delete_workshop_parameter(param_key: str) -> Dict[str, Any]:
    """
    Delete a workshop parameter.
    This is a hard delete.
    """
    logger.info(f"[Config API] Deleting workshop parameter: {param_key}")
    
    schema = get_schema()
    
    # Check if parameter exists
    check_sql = f"""
        SELECT param_id FROM {schema}.workshop_parameters
        WHERE param_key = %s
    """
    existing = execute_query(check_sql, (param_key,))
    
    if not existing:
        raise HTTPException(status_code=404, detail=f"Parameter '{param_key}' not found")
    
    # Delete the parameter
    delete_sql = f"""
        DELETE FROM {schema}.workshop_parameters
        WHERE param_key = %s
    """
    
    success = execute_insert(delete_sql, (param_key,))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete parameter")
    
    logger.info(f"[Config API] Deleted workshop parameter: {param_key}")
    
    return {
        "success": True,
        "message": f"Parameter '{param_key}' deleted successfully"
    }


@router.get("/config/workshop-parameters-dict")
async def get_workshop_parameters_dict() -> Dict[str, str]:
    """
    Get all workshop parameters as a simple key-value dictionary.
    Useful for template variable substitution.
    """
    params = await get_workshop_parameters(Response())
    return {p.param_key: p.param_value for p in params}


class WorkshopParameterOverrideUpdate(BaseModel):
    """Request to update allow_session_override flag"""
    allow_session_override: bool = Field(..., description="Whether to allow session-level override")


@router.put("/config/workshop-parameters/{param_key}/override")
async def update_workshop_parameter_override(param_key: str, update: WorkshopParameterOverrideUpdate) -> Dict[str, Any]:
    """
    Update whether a workshop parameter can be overridden at session level.
    """
    logger.info(f"[Config API] Updating allow_session_override for {param_key} to {update.allow_session_override}")
    
    schema = get_schema()
    
    # Check parameter exists
    check_sql = f"""
        SELECT param_key FROM {schema}.workshop_parameters WHERE param_key = %s
    """
    existing = execute_query(check_sql, (param_key,))
    
    if not existing:
        raise HTTPException(status_code=404, detail=f"Parameter '{param_key}' not found")
    
    # Update the override flag
    update_sql = f"""
        UPDATE {schema}.workshop_parameters
        SET allow_session_override = %s, updated_at = CURRENT_TIMESTAMP
        WHERE param_key = %s
    """
    
    success = execute_insert(update_sql, (update.allow_session_override, param_key))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update parameter override setting")
    
    return {
        "success": True,
        "param_key": param_key,
        "allow_session_override": update.allow_session_override
    }


# =============================================================================
# SESSION PARAMETERS API ENDPOINTS
# =============================================================================
# Endpoints for managing session-level parameter overrides.
# Users can override global workshop parameters for their session.
# =============================================================================

class SessionParameterUpdate(BaseModel):
    """Request to update session parameters"""
    parameters: Dict[str, str] = Field(..., description="Key-value map of parameter overrides")


class SessionParameterResponse(BaseModel):
    """Response with effective session parameters"""
    param_key: str
    param_label: str
    param_value: str  # Effective value (session override or global default)
    global_value: str  # Global default value
    is_overridden: bool  # Whether this is a session override
    allow_session_override: bool  # Whether override is allowed
    param_type: str
    param_description: Optional[str] = None


@router.get("/session/{session_id}/parameters")
async def get_session_parameters(session_id: str, response: Response) -> List[SessionParameterResponse]:
    """
    Get effective parameters for a session.
    Returns merged view of global parameters with any session overrides.
    """
    logger.info(f"[Session API] Fetching parameters for session: {session_id}")
    
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    
    schema = get_schema()
    
    # Get global parameters
    global_params = await get_workshop_parameters(response)
    
    # Get session overrides
    session_sql = f"""
        SELECT COALESCE(session_parameters, '{{}}') as session_parameters
        FROM {schema}.sessions
        WHERE session_id = %s
    """
    session_result = execute_query(session_sql, (session_id,))
    
    session_overrides = {}
    if session_result and session_result[0].get('session_parameters'):
        session_overrides = session_result[0]['session_parameters']
        if isinstance(session_overrides, str):
            import json
            session_overrides = json.loads(session_overrides)
    
    # Merge global params with session overrides
    result = []
    for param in global_params:
        is_overridden = param.param_key in session_overrides
        effective_value = session_overrides.get(param.param_key, param.param_value) if is_overridden else param.param_value
        
        result.append(SessionParameterResponse(
            param_key=param.param_key,
            param_label=param.param_label,
            param_value=effective_value,
            global_value=param.param_value,
            is_overridden=is_overridden,
            allow_session_override=param.allow_session_override,
            param_type=param.param_type,
            param_description=param.param_description
        ))
    
    # Append virtual read-only parameters for frontend verification links
    try:
        effective_params = get_effective_workshop_parameters(session_id)
        user_schema_prefix = effective_params.get('user_schema_prefix', '')
        
        session_meta_sql = f"SELECT created_by FROM {schema}.sessions WHERE session_id = %s"
        session_meta = execute_query(session_meta_sql, (session_id,))
        created_by = (session_meta[0].get('created_by', '') if session_meta else '') or ''
        
        user_app_name = effective_params.get('user_app_name', '')
        if not user_app_name and created_by and '@' in created_by:
            _local = created_by.split('@')[0]
            _parts = _local.split('.')
            _first = _parts[0].lower()
            _last_init = _parts[1][0].lower() if len(_parts) > 1 and _parts[1] else ''
            _user_part = f"{_first}-{_last_init}" if _last_init else _first
            user_app_name = f"{_user_part}-vibe-coding"
        
        for vkey, vlabel, vval in [
            ('created_by', 'Session Owner Email', created_by),
            ('user_schema_prefix', 'User Schema Prefix', user_schema_prefix),
            ('user_app_name', 'User App Name', user_app_name),
        ]:
            if vval:
                result.append(SessionParameterResponse(
                    param_key=vkey,
                    param_label=vlabel,
                    param_value=vval,
                    global_value='',
                    is_overridden=False,
                    allow_session_override=False,
                    param_type='text',
                    param_description=f'Auto-derived: {vlabel}'
                ))
    except Exception as e:
        logger.warning(f"[Session API] Failed to append virtual parameters: {e}")
    
    return result


@router.put("/session/{session_id}/parameters")
async def update_session_parameters(session_id: str, update: SessionParameterUpdate) -> Dict[str, Any]:
    """
    Update session parameter overrides.
    Only parameters with allow_session_override=true can be updated.
    """
    logger.info(f"[Session API] Updating parameters for session: {session_id}")
    
    schema = get_schema()
    
    # Get allowed override keys
    global_params = await get_workshop_parameters(Response())
    allowed_keys = {p.param_key for p in global_params if p.allow_session_override}
    
    # Validate all keys are allowed
    for key in update.parameters.keys():
        if key not in allowed_keys:
            raise HTTPException(
                status_code=400, 
                detail=f"Parameter '{key}' cannot be overridden at session level"
            )
    
    # Get current session parameters
    get_sql = f"""
        SELECT COALESCE(session_parameters, '{{}}') as session_parameters
        FROM {schema}.sessions
        WHERE session_id = %s
    """
    current = execute_query(get_sql, (session_id,))
    
    if not current:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    
    # Merge with existing overrides
    import json
    current_overrides = current[0].get('session_parameters', {})
    if isinstance(current_overrides, str):
        current_overrides = json.loads(current_overrides) if current_overrides else {}
    
    # Update with new values (or remove if empty string)
    for key, value in update.parameters.items():
        if value.strip():
            current_overrides[key] = value
        elif key in current_overrides:
            del current_overrides[key]
    
    # Save updated parameters
    update_sql = f"""
        UPDATE {schema}.sessions
        SET session_parameters = %s::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE session_id = %s
    """
    
    success = execute_insert(update_sql, (json.dumps(current_overrides), session_id))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update session parameters")
    
    return {
        "success": True,
        "session_id": session_id,
        "parameters": current_overrides
    }


@router.delete("/session/{session_id}/parameters/{param_key}")
async def reset_session_parameter(session_id: str, param_key: str) -> Dict[str, Any]:
    """
    Reset a session parameter to global default (remove override).
    """
    logger.info(f"[Session API] Resetting parameter {param_key} for session: {session_id}")
    
    schema = get_schema()
    
    # Get current session parameters
    get_sql = f"""
        SELECT COALESCE(session_parameters, '{{}}') as session_parameters
        FROM {schema}.sessions
        WHERE session_id = %s
    """
    current = execute_query(get_sql, (session_id,))
    
    if not current:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    
    import json
    current_overrides = current[0].get('session_parameters', {})
    if isinstance(current_overrides, str):
        current_overrides = json.loads(current_overrides) if current_overrides else {}
    
    # Remove the override
    if param_key in current_overrides:
        del current_overrides[param_key]
    
    # Save updated parameters
    update_sql = f"""
        UPDATE {schema}.sessions
        SET session_parameters = %s::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE session_id = %s
    """
    
    success = execute_insert(update_sql, (json.dumps(current_overrides), session_id))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reset session parameter")
    
    return {
        "success": True,
        "session_id": session_id,
        "param_key": param_key,
        "message": f"Parameter '{param_key}' reset to global default"
    }


# =============================================================================
# LAKEHOUSE PARAMS API (Chapter 3 - Custom inline override for Step 10)
# =============================================================================

class LakehouseParamsResponse(BaseModel):
    """Response model for lakehouse parameters."""
    catalog: str
    schema_name: str  # Using schema_name to avoid conflict with Pydantic's schema
    is_overridden: bool = False

class LakehouseParamsUpdate(BaseModel):
    """Request model for updating lakehouse parameters."""
    catalog: str
    schema_name: str


@router.get("/session/{session_id}/lakehouse-params")
async def get_lakehouse_params(session_id: str) -> LakehouseParamsResponse:
    """
    Get the effective lakehouse catalog/schema for a session.
    Returns session override if set, otherwise global defaults.
    """
    schema = get_schema()
    
    # Get session parameters
    get_sql = f"""
        SELECT COALESCE(session_parameters, '{{}}') as session_parameters
        FROM {schema}.sessions
        WHERE session_id = %s
    """
    result = execute_query(get_sql, (session_id,))
    
    session_params = {}
    if result:
        import json
        raw = result[0].get('session_parameters', {})
        if isinstance(raw, str):
            session_params = json.loads(raw) if raw else {}
        else:
            session_params = raw or {}
    
    # Get global defaults
    global_params = {}
    params_sql = f"""
        SELECT param_key, param_value
        FROM {schema}.workshop_parameters
        WHERE param_key IN ('chapter_3_lakehouse_catalog', 'chapter_3_lakehouse_schema')
        AND is_active = TRUE
    """
    params_result = execute_query(params_sql, ())
    if params_result:
        for row in params_result:
            global_params[row['param_key']] = row['param_value']
    
    # Determine effective values (session override > global default)
    catalog = session_params.get('chapter_3_lakehouse_catalog', global_params.get('chapter_3_lakehouse_catalog', 'samples'))
    schema_name = session_params.get('chapter_3_lakehouse_schema', global_params.get('chapter_3_lakehouse_schema', 'wanderbricks'))
    is_overridden = 'chapter_3_lakehouse_catalog' in session_params or 'chapter_3_lakehouse_schema' in session_params
    
    return LakehouseParamsResponse(
        catalog=catalog,
        schema_name=schema_name,
        is_overridden=is_overridden
    )


@router.put("/session/{session_id}/lakehouse-params")
async def update_lakehouse_params(session_id: str, update: LakehouseParamsUpdate) -> Dict[str, Any]:
    """
    Update the lakehouse catalog/schema for a session.
    This bypasses the allow_session_override check since it has custom UI.
    """
    logger.info(f"[Session API] Updating lakehouse params for session: {session_id}")
    
    schema = get_schema()
    
    # Get current session parameters
    get_sql = f"""
        SELECT COALESCE(session_parameters, '{{}}') as session_parameters
        FROM {schema}.sessions
        WHERE session_id = %s
    """
    current = execute_query(get_sql, (session_id,))
    
    if not current:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    
    import json
    current_overrides = current[0].get('session_parameters', {})
    if isinstance(current_overrides, str):
        current_overrides = json.loads(current_overrides) if current_overrides else {}
    
    # Update lakehouse params
    current_overrides['chapter_3_lakehouse_catalog'] = update.catalog
    current_overrides['chapter_3_lakehouse_schema'] = update.schema_name
    
    # Save updated parameters
    update_sql = f"""
        UPDATE {schema}.sessions
        SET session_parameters = %s::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE session_id = %s
    """
    
    success = execute_insert(update_sql, (json.dumps(current_overrides), session_id))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update lakehouse parameters")
    
    return {
        "success": True,
        "session_id": session_id,
        "catalog": update.catalog,
        "schema_name": update.schema_name
    }


@router.delete("/session/{session_id}/lakehouse-params")
async def reset_lakehouse_params(session_id: str) -> Dict[str, Any]:
    """
    Reset lakehouse params to global defaults (remove session override).
    """
    logger.info(f"[Session API] Resetting lakehouse params for session: {session_id}")
    
    schema = get_schema()
    
    # Get current session parameters
    get_sql = f"""
        SELECT COALESCE(session_parameters, '{{}}') as session_parameters
        FROM {schema}.sessions
        WHERE session_id = %s
    """
    current = execute_query(get_sql, (session_id,))
    
    if not current:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    
    import json
    current_overrides = current[0].get('session_parameters', {})
    if isinstance(current_overrides, str):
        current_overrides = json.loads(current_overrides) if current_overrides else {}
    
    # Remove lakehouse param overrides
    current_overrides.pop('chapter_3_lakehouse_catalog', None)
    current_overrides.pop('chapter_3_lakehouse_schema', None)
    
    # Save updated parameters
    update_sql = f"""
        UPDATE {schema}.sessions
        SET session_parameters = %s::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE session_id = %s
    """
    
    success = execute_insert(update_sql, (json.dumps(current_overrides), session_id))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reset lakehouse parameters")
    
    return {
        "success": True,
        "session_id": session_id,
        "message": "Lakehouse parameters reset to global defaults"
    }


@router.post("/session/{session_id}/lakehouse-params/auto-from-lakebase")
async def auto_set_lakehouse_params_from_lakebase(session_id: str) -> LakehouseParamsResponse:
    """
    Auto-set lakehouse params from the Lakebase UC catalog registration (Step 9).
    Derives the user's schema name from their email and reads the lakebase_uc_catalog_name
    workshop parameter. Sets both as session-level overrides so Step 10 uses them.
    """
    logger.info(f"[Session API] Auto-setting lakehouse params from Lakebase for session: {session_id}")
    
    schema = get_schema()
    
    # 1. Read session's created_by email and use case info
    session_sql = f"""
        SELECT created_by, COALESCE(session_parameters, '{{}}') as session_parameters,
               use_case_label, use_case
        FROM {schema}.sessions
        WHERE session_id = %s
    """
    session_result = execute_query(session_sql, (session_id,))
    
    if not session_result:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    
    created_by = session_result[0].get('created_by', '')
    
    # 2. Derive schema name from email + use case
    import re as _re
    _uc_label = session_result[0].get('use_case') or session_result[0].get('use_case_label') or ''
    _uc_slug = _re.sub(r'[^a-z0-9]+', '_', _uc_label.strip().lower()).strip('_') if _uc_label.strip() else 'vibe_coding'
    if created_by and '@' in created_by:
        local_part = created_by.split('@')[0]
        parts = local_part.split('.')
        firstname = parts[0].lower()
        lastinitial = parts[1][0].lower() if len(parts) > 1 and parts[1] else ''
        derived_schema = f"{firstname}_{lastinitial}_{_uc_slug}" if lastinitial else f"{firstname}_{_uc_slug}"
    else:
        derived_schema = f"user_{_uc_slug}"
    
    # 3. Read lakebase_uc_catalog_name from workshop parameters
    param_sql = f"""
        SELECT param_value FROM {schema}.workshop_parameters
        WHERE param_key = 'lakebase_uc_catalog_name' AND is_active = TRUE
    """
    param_result = execute_query(param_sql, ())
    catalog_name = param_result[0]['param_value'] if param_result else 'vibe_coding_workshop_lakebase'
    
    # 4. Update session parameters with lakehouse overrides
    import json
    current_overrides = session_result[0].get('session_parameters', {})
    if isinstance(current_overrides, str):
        current_overrides = json.loads(current_overrides) if current_overrides else {}
    
    current_overrides['chapter_3_lakehouse_catalog'] = catalog_name
    current_overrides['chapter_3_lakehouse_schema'] = derived_schema
    
    update_sql = f"""
        UPDATE {schema}.sessions
        SET session_parameters = %s::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE session_id = %s
    """
    success = execute_insert(update_sql, (json.dumps(current_overrides), session_id))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to auto-set lakehouse parameters")
    
    logger.info(f"[Session API] Auto-set lakehouse params: catalog={catalog_name}, schema={derived_schema}")
    
    return LakehouseParamsResponse(
        catalog=catalog_name,
        schema_name=derived_schema,
        is_overridden=True
    )


# =============================================================================
# SESSION MANAGEMENT API ENDPOINTS
# =============================================================================

import uuid
from fastapi import Request

# Import session functions from lakebase service
try:
    from src.backend.services.lakebase import (
        save_session,
        save_chapter_feedback,
        load_session,
        delete_session,
        get_user_sessions,
        get_user_default_session,
        delete_user_unsaved_sessions,
        update_step_prompt,
        get_leaderboard,
        cleanup_session_steps,
    )
    SESSION_FUNCTIONS_AVAILABLE = True
except ImportError:
    SESSION_FUNCTIONS_AVAILABLE = False
    logger.warning("Session functions not available")
    
    def save_session(*args, **kwargs):
        return False
    def load_session(*args, **kwargs):
        return None
    def delete_session(*args, **kwargs):
        return False
    def get_user_sessions(*args, **kwargs):
        return []
    def get_user_default_session(*args, **kwargs):
        return None
    def get_leaderboard(*args, **kwargs):
        return []
    def cleanup_session_steps(*args, **kwargs):
        return {'sessions_fixed': 0, 'step_41_replaced': 0}
    def delete_user_unsaved_sessions(*args, **kwargs):
        return 0
    def update_step_prompt(*args, **kwargs):
        return False


# Session Pydantic Models
class SessionSaveRequest(BaseModel):
    """Request to save a session"""
    session_id: str = Field(..., description="Session ID")
    industry: Optional[str] = Field(None, description="Selected industry")
    industry_label: Optional[str] = Field(None, description="Industry display label")
    use_case: Optional[str] = Field(None, description="Selected use case")
    use_case_label: Optional[str] = Field(None, description="Use case display label")
    session_name: Optional[str] = Field(None, max_length=100, description="Session name")
    session_description: Optional[str] = Field(None, max_length=500, description="Session description")
    feedback_rating: Optional[str] = Field(None, description="Feedback rating: thumbs_up or thumbs_down")
    feedback_comment: Optional[str] = Field(None, description="Feedback comment")
    current_step: int = Field(1, description="Current step number (1-22)")
    workshop_level: Optional[str] = Field(None, description="Workshop level: app-only, app-database, lakehouse, lakehouse-di, end-to-end, accelerator, or genie-accelerator")
    completed_steps: List[int] = Field(default_factory=list, description="List of completed step numbers")
    step_prompts: Dict[int, str] = Field(default_factory=dict, description="Map of step number to generated prompt")


class SessionSaveResponse(BaseModel):
    """Response after saving a session"""
    success: bool = Field(..., description="Whether save succeeded")
    session_id: str = Field(..., description="Session ID that was saved")
    message: str = Field(..., description="Status message")
    share_url: Optional[str] = Field(None, description="Shareable URL for this session")


class SessionLoadResponse(BaseModel):
    """Response when loading a session"""
    success: bool = Field(..., description="Whether load succeeded")
    session_id: str = Field(..., description="Session ID")
    industry: Optional[str] = Field(None)
    industry_label: Optional[str] = Field(None)
    use_case: Optional[str] = Field(None)
    use_case_label: Optional[str] = Field(None)
    session_name: Optional[str] = Field(None)
    session_description: Optional[str] = Field(None)
    feedback_rating: Optional[str] = Field(None)
    feedback_comment: Optional[str] = Field(None)
    prerequisites_completed: bool = Field(False)
    current_step: int = Field(1)
    workshop_level: Optional[str] = Field(None, description="Workshop level: app-only, app-database, lakehouse, lakehouse-di, end-to-end, accelerator, or genie-accelerator")
    completed_steps: List[int] = Field(default_factory=list)
    skipped_steps: List[int] = Field(default_factory=list)
    step_prompts: Dict[int, str] = Field(default_factory=dict)
    session_parameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Session parameter overrides (JSONB)")
    created_by: Optional[str] = Field(None)
    created_at: Optional[str] = Field(None)
    updated_at: Optional[str] = Field(None)
    is_saved: bool = Field(False)
    message: str = Field(..., description="Status message")


class NewSessionResponse(BaseModel):
    """Response when creating a new session"""
    session_id: str = Field(..., description="New unique session ID")


class FeedbackRequest(BaseModel):
    """Request to submit feedback"""
    session_id: str = Field(..., description="Session ID")
    feedback_rating: str = Field(..., description="Rating: thumbs_up or thumbs_down")
    feedback_comment: str = Field(..., description="Comment is required")
    feedback_request_followup: bool = Field(False, description="Whether user requests follow-up support")


class UpdateStepPromptRequest(BaseModel):
    """Request to update a step's generated prompt"""
    session_id: str = Field(..., description="Session ID")
    step_number: int = Field(..., ge=1, le=30, description="Step number (1-30)")
    prompt_text: str = Field(..., description="Generated prompt text")
    workshop_level: Optional[str] = Field(None, description="Workshop level to save with this update")


class SessionListItem(BaseModel):
    """Summary of a session for list display"""
    session_id: str
    session_name: Optional[str]
    session_description: Optional[str]
    industry: Optional[str]
    industry_label: Optional[str]
    use_case: Optional[str]
    use_case_label: Optional[str]
    current_step: int
    feedback_rating: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]
    is_saved: bool


def _get_session_user(request: Request) -> str:
    """
    Get the current user email from Databricks OAuth context.
    """
    # Try various header names that Databricks Apps might use
    header_names = [
        "x-forwarded-email",
        "x-forwarded-user",
        "x-databricks-user-email",
        "x-databricks-user",
        "x-user-email",
        "x-user-id",
    ]
    
    for header in header_names:
        user = request.headers.get(header, "")
        if user and "@" in user:
            logger.info(f"Found user email from header '{header}': {user}")
            return user
    
    # Fallback to PGUSER (auto-injected by Lakebase resource link)
    pg_user = os.getenv("PGUSER", "")
    if pg_user and "@" in pg_user:
        return pg_user
    
    logger.warning("Could not determine user email from headers or PGUSER, using 'unknown'")
    return "unknown"


@router.get("/session/new")
async def create_new_session(request: Request) -> NewSessionResponse:
    """
    Create a new unique session ID and persist it to Lakebase with default values.
    Called when user explicitly wants a fresh new session.
    
    IMPORTANT: This ensures only ONE unsaved "New Session" per user exists at any time.
    Any existing "New Session" for this user will be deleted first.
    """
    session_id = str(uuid.uuid4())
    logger.info(f"[Session API] Creating new session: {session_id}")
    
    # Get the current user
    created_by = _get_session_user(request)
    
    # CLEANUP: Delete any existing unsaved "New Session" for this user
    # This ensures only ONE unsaved session per user at any time
    try:
        deleted_count = delete_user_unsaved_sessions(created_by)
        if deleted_count > 0:
            logger.info(f"[Session API] Cleaned up {deleted_count} old unsaved session(s) for user: {created_by}")
    except Exception as e:
        logger.warning(f"[Session API] Error cleaning up old sessions: {e}")
    
    # Persist the new session with default values
    try:
        success = save_session(
            session_id=session_id,
            session_name="New Session",
            current_step=1,
            completed_steps=[],
            created_by=created_by,
        )
        if success:
            logger.info(f"[Session API] Session {session_id} persisted (user: {created_by})")
        else:
            logger.warning(f"[Session API] Failed to persist session {session_id}")
    except Exception as e:
        logger.error(f"[Session API] Error persisting new session {session_id}: {e}")
    
    return NewSessionResponse(session_id=session_id)


@router.get("/session/default")
async def get_or_create_default_session(request: Request) -> SessionLoadResponse:
    """
    Get the user's default unsaved session, or create one if none exists.
    This allows users to continue where they left off without explicitly saving.
    
    Also cleans up orphan unsaved sessions so only ONE unsaved session per user exists.
    """
    created_by = _get_session_user(request)
    logger.info(f"[Session API] Getting default session for user: {created_by}")
    
    try:
        session_data = get_user_default_session(created_by)
        
        if session_data:
            session_id = session_data['session_id']
            current_step = session_data.get("current_step") or 1
            completed_steps = session_data.get("completed_steps") or []
            prereqs = session_data.get("prerequisites_completed")
            prerequisites_completed = prereqs if prereqs is not None else False
            
            logger.info(f"[Session API] Found existing default session: {session_id}, step={current_step}, completed={len(completed_steps)} steps")
            
            # Clean up orphan unsaved sessions, keeping only this one
            try:
                deleted_count = delete_user_unsaved_sessions(created_by, keep_session_id=session_id)
                if deleted_count > 0:
                    logger.info(f"[Session API] Cleaned up {deleted_count} orphan unsaved session(s) for user: {created_by}")
            except Exception as cleanup_err:
                logger.warning(f"[Session API] Error cleaning up orphan sessions: {cleanup_err}")
            
            return SessionLoadResponse(
                success=True,
                session_id=session_id,
                industry=session_data.get("industry"),
                industry_label=session_data.get("industry_label"),
                use_case=session_data.get("use_case"),
                use_case_label=session_data.get("use_case_label"),
                session_name=session_data.get("session_name"),
                session_description=session_data.get("session_description"),
                feedback_rating=session_data.get("feedback_rating"),
                feedback_comment=session_data.get("feedback_comment"),
                prerequisites_completed=prerequisites_completed,
                current_step=current_step,
                workshop_level=session_data.get("workshop_level", "300"),
                completed_steps=completed_steps,
                skipped_steps=session_data.get("skipped_steps") or [],
                step_prompts=session_data.get("step_prompts") or {},
                session_parameters=session_data.get("session_parameters") or {},
                created_by=session_data.get("created_by"),
                created_at=session_data.get("created_at"),
                updated_at=session_data.get("updated_at"),
                is_saved=False,  # Default session is never "saved"
                message="Session loaded successfully",
            )
    except Exception as e:
        logger.error(f"[Session API] Error getting default session: {e}")
    
    # No existing session found - create a new one (first time user)
    session_id = str(uuid.uuid4())
    logger.info(f"[Session API] No existing session found. Creating new default session: {session_id}")
    
    try:
        success = save_session(
            session_id=session_id,
            session_name="New Session",
            current_step=1,
            completed_steps=[],
            created_by=created_by,
        )
        if success:
            logger.info(f"[Session API] New default session {session_id} created for user: {created_by}")
        else:
            logger.warning(f"[Session API] Failed to create default session {session_id}")
    except Exception as e:
        logger.error(f"[Session API] Error creating default session: {e}")
    
    # Return new empty session
    return SessionLoadResponse(
        success=True,
        session_id=session_id,
        session_name="New Session",
        prerequisites_completed=False,
        current_step=1,
        workshop_level="300",
        completed_steps=[],
        step_prompts={},
        created_by=created_by,
        is_saved=False,
        message="New session created",
    )


@router.post("/session/save")
async def save_session_endpoint(request_body: SessionSaveRequest, request: Request) -> SessionSaveResponse:
    """
    Save session to Lakebase.
    Returns a shareable URL with the session ID.
    """
    try:
        current_user = _get_session_user(request)
        logger.info(f"[Session API] Saving session {request_body.session_id} by {current_user}")
        
        # Get base URL for share link
        forwarded_host = request.headers.get("x-forwarded-host")
        host_header = request.headers.get("host")
        
        if forwarded_host:
            protocol = request.headers.get("x-forwarded-proto", "https")
            base_url = f"{protocol}://{forwarded_host}"
        elif host_header and "localhost" not in host_header:
            protocol = "https" if request.url.scheme == "https" else "http"
            base_url = f"{protocol}://{host_header}"
        else:
            base_url = str(request.base_url).rstrip("/")
        
        # Save to Lakebase
        success = save_session(
            session_id=request_body.session_id,
            industry=request_body.industry,
            industry_label=request_body.industry_label,
            use_case=request_body.use_case,
            use_case_label=request_body.use_case_label,
            session_name=request_body.session_name or "Saved Session",
            session_description=request_body.session_description,
            feedback_rating=request_body.feedback_rating,
            feedback_comment=request_body.feedback_comment,
            current_step=request_body.current_step,
            workshop_level=request_body.workshop_level,
            completed_steps=request_body.completed_steps,
            step_prompts=request_body.step_prompts,
            created_by=current_user,
        )
        
        if success:
            share_url = f"{base_url}?sessionId={request_body.session_id}"
            logger.info(f"[Session API] Session {request_body.session_id} saved successfully")
            
            return SessionSaveResponse(
                success=True,
                session_id=request_body.session_id,
                message="Session saved successfully",
                share_url=share_url,
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to save session")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Session API] Error saving session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error saving session: {str(e)}")


@router.get("/session/{session_id}")
async def load_session_endpoint(session_id: str) -> SessionLoadResponse:
    """
    Load session from Lakebase by session ID.
    Used when opening a shared URL with ?sessionId=xxx
    """
    try:
        session_data = load_session(session_id)
        
        if session_data:
            logger.info(f"[Session API] Session {session_id} loaded successfully")
            
            return SessionLoadResponse(
                success=True,
                session_id=session_id,
                industry=session_data.get("industry"),
                industry_label=session_data.get("industry_label"),
                use_case=session_data.get("use_case"),
                use_case_label=session_data.get("use_case_label"),
                session_name=session_data.get("session_name"),
                session_description=session_data.get("session_description"),
                feedback_rating=session_data.get("feedback_rating"),
                feedback_comment=session_data.get("feedback_comment"),
                prerequisites_completed=session_data.get("prerequisites_completed", False),
                current_step=session_data.get("current_step", 1),
                workshop_level=session_data.get("workshop_level", "300"),
                completed_steps=session_data.get("completed_steps", []),
                skipped_steps=session_data.get("skipped_steps", []),
                step_prompts=session_data.get("step_prompts", {}),
                session_parameters=session_data.get("session_parameters", {}),
                created_by=session_data.get("created_by"),
                created_at=session_data.get("created_at"),
                updated_at=session_data.get("updated_at"),
                is_saved=session_data.get("is_saved", False),
                message="Session loaded successfully",
            )
        else:
            logger.warning(f"[Session API] Session {session_id} not found")
            return SessionLoadResponse(
                success=False,
                session_id=session_id,
                is_saved=False,
                message="Session not found. It may have been deleted or never saved.",
            )
            
    except Exception as e:
        logger.error(f"[Session API] Error loading session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error loading session: {str(e)}")


@router.delete("/session/{session_id}")
async def delete_session_endpoint(session_id: str):
    """Delete a session from Lakebase"""
    try:
        success = delete_session(session_id)
        
        if success:
            logger.info(f"[Session API] Session {session_id} deleted")
            return {"success": True, "message": "Session deleted"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete session")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Session API] Error deleting session: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting session: {str(e)}")


@router.post("/session/update-step")
async def update_step_prompt_endpoint(request_body: UpdateStepPromptRequest) -> Dict[str, Any]:
    """
    Update a specific step's generated prompt for a session.
    Called after each prompt generation.
    Also saves workshop_level if provided (piggybacks on progress saves).
    """
    try:
        success = update_step_prompt(
            session_id=request_body.session_id,
            step_number=request_body.step_number,
            prompt_text=request_body.prompt_text,
            workshop_level=request_body.workshop_level,
        )
        
        if success:
            logger.info(f"[Session API] Updated step {request_body.step_number} for session {request_body.session_id}")
            return {"success": True, "message": f"Step {request_body.step_number} prompt saved"}
        else:
            return {"success": False, "message": "Failed to update step prompt (Lakebase may not be configured)"}
            
    except Exception as e:
        logger.error(f"[Session API] Error updating step prompt: {e}")
        return {"success": False, "message": str(e)}


class SessionUpdateMetadataRequest(BaseModel):
    """Request to update session metadata (industry/use case selection)"""
    session_id: str = Field(..., description="Session ID")
    industry: Optional[str] = Field(None, description="Selected industry")
    industry_label: Optional[str] = Field(None, description="Industry display label")
    use_case: Optional[str] = Field(None, description="Selected use case")
    use_case_label: Optional[str] = Field(None, description="Use case display label")
    prerequisites_completed: Optional[bool] = Field(None, description="Whether prerequisites are completed")
    workshop_level: Optional[str] = Field(None, description="Workshop level: app-only, app-database, lakehouse, lakehouse-di, end-to-end, accelerator, or genie-accelerator")
    completed_steps: Optional[List[int]] = Field(None, description="List of completed step numbers")
    skipped_steps: Optional[List[int]] = Field(None, description="List of skipped step numbers")
    custom_use_case_label: Optional[str] = Field(None, max_length=30, description="User-edited use case name override")
    custom_use_case_description: Optional[str] = Field(None, description="User-edited use case description override")
    level_explicitly_selected: Optional[bool] = Field(None, description="Whether the user explicitly clicked a level button")
    company_brand_url: Optional[str] = Field(None, description="URL to company brand colors/assets page")


@router.post("/session/update-metadata")
async def update_session_metadata_endpoint(request_body: SessionUpdateMetadataRequest, request: Request) -> Dict[str, Any]:
    """
    Update session metadata (industry/use case selection, completed steps) without full save.
    This is called when user selects industry/use case or completes steps to track their progress.
    Also handles custom use case overrides stored in session_parameters JSONB.
    """
    try:
        current_user = _get_session_user(request)
        
        # Defensive: log exactly which fields are being sent
        _updating = [k for k, v in {
            'industry': request_body.industry, 'use_case': request_body.use_case,
            'workshop_level': request_body.workshop_level,
            'prerequisites_completed': request_body.prerequisites_completed,
            'completed_steps': request_body.completed_steps,
            'skipped_steps': request_body.skipped_steps,
        }.items() if v is not None]
        logger.info(f"[Session API] Updating metadata for session {request_body.session_id}: fields={_updating}")
        
        # Safety: warn if completed_steps is being explicitly set to empty
        if request_body.completed_steps is not None and len(request_body.completed_steps) == 0:
            logger.warning(f"[Session API] CAUTION: completed_steps being set to EMPTY for session {request_body.session_id}")
        
        # Calculate current_step from completed_steps if provided
        current_step = None
        if request_body.completed_steps:
            current_step = max(request_body.completed_steps) if request_body.completed_steps else None
        
        success = save_session(
            session_id=request_body.session_id,
            industry=request_body.industry,
            industry_label=request_body.industry_label,
            use_case=request_body.use_case,
            use_case_label=request_body.use_case_label,
            created_by=current_user,
            prerequisites_completed=request_body.prerequisites_completed,
            workshop_level=request_body.workshop_level,
            completed_steps=request_body.completed_steps,
            skipped_steps=request_body.skipped_steps,
            current_step=current_step,
        )
        
        # Store custom use case overrides and derive user_schema_prefix
        _session_param_patch = {}
        
        if request_body.custom_use_case_label is not None:
            _session_param_patch['custom_use_case_label'] = request_body.custom_use_case_label
        if request_body.custom_use_case_description is not None:
            _session_param_patch['custom_use_case_description'] = request_body.custom_use_case_description
        if request_body.level_explicitly_selected is not None:
            _session_param_patch['level_explicitly_selected'] = request_body.level_explicitly_selected
        if request_body.company_brand_url is not None:
            _session_param_patch['company_brand_url'] = request_body.company_brand_url
        
        # Derive user_schema_prefix from email + use case name (or source schema for accelerator)
        # Triggered when use case is selected, custom label is edited, or workshop_level changes
        _uc_name = (
            request_body.custom_use_case_label
            or request_body.use_case
            or request_body.use_case_label
        )
        _should_derive = bool(_uc_name and _uc_name.strip()) or request_body.workshop_level is not None
        if _should_derive:
            import re as _re
            _user_part = "user"
            if current_user and '@' in current_user:
                _local = current_user.split('@')[0]
                _parts = _local.split('.')
                _first = _parts[0].lower()
                _last_init = _parts[1][0].lower() if len(_parts) > 1 and _parts[1] else ''
                _user_part = f"{_first}_{_last_init}" if _last_init else _first
            
            # Check if accelerator mode (from request or stored session)
            _is_accelerator = request_body.workshop_level in ('accelerator', 'genie-accelerator')
            if not _is_accelerator and request_body.workshop_level is None:
                _lvl_sql = f"SELECT workshop_level FROM {get_schema()}.sessions WHERE session_id = %s"
                _lvl_row = execute_query(_lvl_sql, (request_body.session_id,))
                _is_accelerator = bool(_lvl_row and _lvl_row[0].get('workshop_level') in ('accelerator', 'genie-accelerator'))
            
            if _is_accelerator:
                _wp = get_workshop_parameters_sync()
                _suffix = _wp.get('chapter_3_lakehouse_schema', 'vibe_coding')
            elif _uc_name and _uc_name.strip():
                _suffix = _re.sub(r'[^a-z0-9]+', '_', _uc_name.strip().lower()).strip('_')
            else:
                _suffix = None
            
            if _suffix:
                _session_param_patch['user_schema_prefix'] = f"{_user_part}_{_suffix}"
                logger.info(f"[Session API] Derived user_schema_prefix: {_session_param_patch['user_schema_prefix']} (accelerator={_is_accelerator})")
        
        if _session_param_patch:
            try:
                import json as _json
                schema = get_schema()
                merge_sql = f"""
                    UPDATE {schema}.sessions
                    SET session_parameters = COALESCE(session_parameters, '{{}}'::jsonb) || %s::jsonb,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE session_id = %s
                """
                execute_insert(merge_sql, (_json.dumps(_session_param_patch), request_body.session_id))
                logger.info(f"[Session API] Session parameters updated for {request_body.session_id}: {list(_session_param_patch.keys())}")
            except Exception as e:
                logger.error(f"[Session API] Error saving session parameters: {e}")
        
        if success:
            return {"success": True, "message": "Session metadata updated"}
        else:
            return {"success": False, "message": "Failed to update session metadata"}
            
    except Exception as e:
        logger.error(f"[Session API] Error updating session metadata: {e}")
        return {"success": False, "message": str(e)}


@router.post("/session/feedback")
async def submit_feedback_endpoint(request_body: FeedbackRequest, request: Request) -> Dict[str, Any]:
    """
    Submit feedback for a session.
    """
    try:
        current_user = _get_session_user(request)
        logger.info(f"[Session API] Submitting feedback for session {request_body.session_id}")
        
        success = save_session(
            session_id=request_body.session_id,
            feedback_rating=request_body.feedback_rating,
            feedback_comment=request_body.feedback_comment,
            feedback_request_followup=request_body.feedback_request_followup,
            created_by=current_user,
        )
        
        if success:
            return {"success": True, "message": "Feedback submitted"}
        else:
            return {"success": False, "message": "Failed to submit feedback"}
            
    except Exception as e:
        logger.error(f"[Session API] Error submitting feedback: {e}")
        return {"success": False, "message": str(e)}


class ChapterFeedbackRequest(BaseModel):
    """Request to submit thumbs up/down feedback for a completed chapter."""
    session_id: str = Field(..., description="Session ID")
    chapter_name: str = Field(..., description="Chapter name, e.g. 'Chapter 1', 'Foundation'")
    rating: str = Field(..., description="Feedback rating: 'up' or 'down'")


@router.post("/session/chapter-feedback")
async def submit_chapter_feedback_endpoint(request_body: ChapterFeedbackRequest, request: Request) -> Dict[str, Any]:
    """
    Submit thumbs up/down feedback for a completed chapter.
    Uses JSONB merge to store per-chapter feedback without affecting other chapters.
    """
    try:
        if request_body.rating not in ('up', 'down'):
            return {"success": False, "message": "Rating must be 'up' or 'down'"}
        
        logger.info(f"[Session API] Chapter feedback: session={request_body.session_id}, chapter={request_body.chapter_name}, rating={request_body.rating}")
        
        success = save_chapter_feedback(
            session_id=request_body.session_id,
            chapter_name=request_body.chapter_name,
            rating=request_body.rating,
        )
        
        if success:
            return {"success": True, "message": "Chapter feedback submitted"}
        else:
            return {"success": False, "message": "Failed to submit chapter feedback"}
            
    except Exception as e:
        logger.error(f"[Session API] Error submitting chapter feedback: {e}")
        return {"success": False, "message": str(e)}


@router.get("/session/user/list")
async def get_user_sessions_endpoint(request: Request) -> List[SessionListItem]:
    """
    Get list of SAVED sessions for the current user.
    Only returns sessions that have been explicitly saved with a name.
    Auto-tracked sessions without a name are not included.
    """
    try:
        current_user = _get_session_user(request)
        logger.info(f"[Session API] Fetching saved sessions for user {current_user}")
        
        # Only get saved sessions (sessions with a name)
        sessions = get_user_sessions(current_user, saved_only=True)
        
        return [SessionListItem(**session) for session in sessions]
            
    except Exception as e:
        logger.error(f"[Session API] Error getting user sessions: {e}")
        return []


@router.get("/session/status/lakebase")
async def session_lakebase_status():
    """Check if Lakebase is configured for session storage with detailed debug info"""
    import os
    configured = is_lakebase_configured()
    
    # Get environment variable info (masked for security)
    env_info = {
        "PGHOST": bool(os.getenv("PGHOST")),
        "PGDATABASE": bool(os.getenv("PGDATABASE")),
        "PGUSER": bool(os.getenv("PGUSER")),
        "PGPORT": os.getenv("PGPORT", "not set"),
        "PGSSLMODE": os.getenv("PGSSLMODE", "not set"),
        "LAKEBASE_HOST": bool(os.getenv("LAKEBASE_HOST")),
        "LAKEBASE_DATABASE": bool(os.getenv("LAKEBASE_DATABASE")),
        "LAKEBASE_SCHEMA": os.getenv("LAKEBASE_SCHEMA", "not set"),
        "DATABRICKS_TOKEN": bool(os.getenv("DATABRICKS_TOKEN")),
    }
    
    # Try to get connection info
    connection_test = None
    try:
        from src.backend.services.lakebase import get_connection, _get_config
        config = _get_config()
        connection_test = {
            "config_source": config.get("source", "unknown"),
            "host_set": bool(config.get("host")),
            "database_set": bool(config.get("database")),
            "schema": config.get("schema", "unknown"),
        }
    except Exception as e:
        connection_test = {"error": str(e)}
    
    return {
        "configured": configured,
        "mode": "lakebase" if configured else "disabled",
        "session_functions_available": SESSION_FUNCTIONS_AVAILABLE,
        "environment": env_info,
        "connection_test": connection_test,
    }


# ============================================================
# Leaderboard Endpoints
# ============================================================

class LeaderboardEntry(BaseModel):
    """Leaderboard entry with user score and progress details"""
    rank: int = Field(..., description="Position in leaderboard (1-10)")
    user_id: str = Field(..., description="User identifier for tracking changes")
    display_name: str = Field(..., description="Formatted display name (e.g., 'John D.')")
    avatar: str = Field(..., description="Emoji avatar for the user")
    score: int = Field(..., description="Total score based on completed steps")
    completed_steps: List[int] = Field(default_factory=list, description="List of completed step numbers")
    skipped_steps: List[int] = Field(default_factory=list, description="List of skipped step numbers")
    completed_chapters: List[str] = Field(default_factory=list, description="Fully completed chapters")
    in_progress_chapters: List[str] = Field(default_factory=list, description="Chapters with some progress")
    updated_at: Optional[str] = Field(None, description="Last update timestamp")
    workshop_level: Optional[str] = Field(None, description="Workshop path selected by the user")


_leaderboard_cache: Dict[str, Any] = {"data": None, "timestamp": 0}

@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard_endpoint(limit: int = 10) -> List[LeaderboardEntry]:
    """
    Get top performers leaderboard.
    
    Returns top 10 users ranked by workshop progress score.
    Uses a 30-second server-side cache to avoid repeated DB connections.
    
    Scoring system (points per step):
    - Foundation (steps 1-3): 10 points each
    - Chapter 1 (steps 4-5): 20 points each
    - Chapter 2 (steps 6-8): 30 points each
    - Chapter 3 (steps 9-14): 40 points each
    - Chapter 4 (steps 15-18): 50 points each
    - Refinement (steps 19-20): 60 points each
    
    Maximum possible score: 720 points
    
    Ties are broken by earliest completion time (first to reach score ranks higher).
    """
    import time as _time
    try:
        limit = min(limit, 100)
        
        now = _time.time()
        if _leaderboard_cache["data"] is not None and (now - _leaderboard_cache["timestamp"]) < 30:
            logger.info(f"[Leaderboard API] Returning cached result ({len(_leaderboard_cache['data'])} entries)")
            return _leaderboard_cache["data"]
        
        leaderboard = get_leaderboard(limit=limit)
        entries = [LeaderboardEntry(**entry) for entry in leaderboard]
        _leaderboard_cache["data"] = entries
        _leaderboard_cache["timestamp"] = now
        logger.info(f"[Leaderboard API] Fetched fresh data, returning {len(entries)} entries")
        
        return entries
        
    except Exception as e:
        logger.error(f"[Leaderboard API] Error: {e}", exc_info=True)
        return []


_workshop_users_cache: Dict[str, Any] = {"data": None, "timestamp": 0}


@router.get("/workshop-users")
async def get_workshop_users_endpoint() -> Dict[str, Any]:
    """Get all distinct workshop users with display names and emails."""
    import time as _time
    try:
        now = _time.time()
        if _workshop_users_cache["data"] is not None and (now - _workshop_users_cache["timestamp"]) < 60:
            return _workshop_users_cache["data"]

        from ..services.lakebase import get_workshop_users
        result = get_workshop_users()
        _workshop_users_cache["data"] = result
        _workshop_users_cache["timestamp"] = now
        return result

    except Exception as e:
        logger.error(f"[Workshop Users API] Error: {e}", exc_info=True)
        return {"total": 0, "users": []}


@router.post("/admin/cleanup-sessions")
async def cleanup_sessions_endpoint(request: Request) -> Dict[str, Any]:
    """
    Admin endpoint to clean up session data.
    
    Fixes:
    1. Replaces step 41 with step 4 in completed_steps arrays
    2. Updates current_step to match max(completed_steps) for each session
    
    Returns count of sessions fixed.
    """
    try:
        # Get current user for logging
        current_user = _get_session_user(request)
        logger.info(f"[Admin API] Session cleanup triggered by {current_user}")
        
        stats = cleanup_session_steps()
        
        logger.info(f"[Admin API] Cleanup complete: {stats}")
        return {
            "success": True,
            "message": f"Cleanup complete. Fixed {stats['sessions_fixed']} sessions, replaced step 41 in {stats['step_41_replaced']} sessions.",
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"[Admin API] Cleanup error: {e}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "stats": {'sessions_fixed': 0, 'step_41_replaced': 0}
        }


# ============================================================
# User Endpoints
# ============================================================

@router.get("/user/current")
async def get_current_user_endpoint(request: Request):
    """
    Get the current logged in user from the request headers or environment.
    Returns user email and display name.
    
    This uses Databricks App OAuth headers to determine the logged-in user.
    """
    # Use _get_session_user which properly extracts user from Databricks OAuth headers
    user = _get_session_user(request)
    
    # Convert email to display name (e.g., varunrao.bhamidimarri@databricks.com -> Varunrao Bhamidimarri)
    if user and "@" in user:
        display_name = user.split('@')[0].replace('.', ' ').title()
    else:
        display_name = user.title() if user else "Unknown User"
    
    logger.info(f"[User API] Current user: {user}, Display: {display_name}")
    
    return {
        "user": user,
        "display_name": display_name
    }


# ============================================================
# Section Image Upload Endpoints
# ============================================================

# Directory for storing uploaded images
UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads" / "section-images"

# Allowed image extensions
ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def ensure_uploads_dir():
    """Ensure the uploads directory exists."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def get_section_images(section_tag: str, field_type: str) -> List[Dict]:
    """Get images for a section from the database."""
    if not is_lakebase_configured():
        return []
    
    schema = get_schema()
    column = f"{field_type}_images"
    
    sql = f"""
        SELECT {column}
        FROM {schema}.section_input_prompts
        WHERE section_tag = %s AND is_active = TRUE
        ORDER BY version DESC
        LIMIT 1
    """
    
    result = execute_query(sql, (section_tag,))
    if result and result[0].get(column):
        images = result[0][column]
        # Handle both string (JSON) and already-parsed dict/list
        if isinstance(images, str):
            try:
                return json.loads(images)
            except json.JSONDecodeError:
                return []
        return images if isinstance(images, list) else []
    return []


def update_section_images(section_tag: str, field_type: str, images: List[Dict]) -> bool:
    """Update images for a section in the database."""
    if not is_lakebase_configured():
        return False
    
    schema = get_schema()
    column = f"{field_type}_images"
    
    # Update all active versions (they share the same images)
    sql = f"""
        UPDATE {schema}.section_input_prompts
        SET {column} = %s::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE section_tag = %s AND is_active = TRUE
    """
    
    return execute_insert(sql, (json.dumps(images), section_tag))


@router.post("/uploads/section-image", summary="Upload image for section")
async def upload_section_image(
    request: Request,
    file: UploadFile = File(...),
    section_tag: str = Form(...),
    field_type: str = Form(...)  # 'how_to_apply' or 'expected_output'
):
    """
    Upload an image for a section's How to Apply or Expected Output field.
    
    - Validates file type and size
    - Stores in workspace uploads directory
    - Updates database JSON array with image metadata
    - Returns the uploaded image metadata
    """
    # Validate field_type
    if field_type not in ('how_to_apply', 'expected_output'):
        raise HTTPException(status_code=400, detail="field_type must be 'how_to_apply' or 'expected_output'")
    
    # Validate file extension
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)}MB")
    
    # Get current images count
    current_images = get_section_images(section_tag, field_type)
    if len(current_images) >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images per section field")
    
    # Create unique filename
    image_id = str(uuid.uuid4())[:8]
    safe_filename = f"{image_id}_{filename.replace(' ', '_')}"
    
    # Ensure directory exists
    ensure_uploads_dir()
    section_dir = UPLOADS_DIR / section_tag
    section_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file
    file_path = section_dir / safe_filename
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Create metadata
    user = _get_session_user(request) if 'request' in dir() else None
    image_metadata = {
        "id": image_id,
        "filename": filename,
        "path": f"uploads/section-images/{section_tag}/{safe_filename}",
        "uploaded_at": datetime.utcnow().isoformat(),
        "uploaded_by": user
    }
    
    # Update database
    current_images.append(image_metadata)
    success = update_section_images(section_tag, field_type, current_images)
    
    if not success:
        # Clean up file if database update failed
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Failed to save image metadata")
    
    # Invalidate cache so workflow page sees new images immediately
    _invalidate_lakebase_cache()
    
    logger.info(f"[Upload] Image uploaded for {section_tag}/{field_type}: {safe_filename}")
    
    return {
        "success": True,
        "image": image_metadata,
        "total_images": len(current_images)
    }


@router.delete("/uploads/section-image/{image_id}", summary="Delete section image")
async def delete_section_image(
    image_id: str,
    section_tag: str,
    field_type: str
):
    """
    Delete an uploaded image from a section.
    
    - Removes file from workspace
    - Updates database JSON array
    """
    # Validate field_type
    if field_type not in ('how_to_apply', 'expected_output'):
        raise HTTPException(status_code=400, detail="field_type must be 'how_to_apply' or 'expected_output'")
    
    # Get current images
    current_images = get_section_images(section_tag, field_type)
    
    # Find the image to delete
    image_to_delete = None
    for img in current_images:
        if img.get('id') == image_id:
            image_to_delete = img
            break
    
    if not image_to_delete:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Remove from list
    current_images = [img for img in current_images if img.get('id') != image_id]
    
    # Update database
    success = update_section_images(section_tag, field_type, current_images)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update image metadata")
    
    # Delete file
    file_path = Path(__file__).resolve().parent.parent.parent.parent / image_to_delete['path']
    if file_path.exists():
        file_path.unlink()
        logger.info(f"[Upload] Deleted image file: {file_path}")
    
    # Invalidate cache so workflow page sees the change immediately
    _invalidate_lakebase_cache()
    
    logger.info(f"[Upload] Image deleted from {section_tag}/{field_type}: {image_id}")
    
    return {
        "success": True,
        "deleted_id": image_id,
        "remaining_images": len(current_images)
    }


@router.get("/uploads/section-images/{section_tag}/{field_type}", summary="List section images")
async def list_section_images(section_tag: str, field_type: str):
    """
    Get all images for a section field.
    """
    if field_type not in ('how_to_apply', 'expected_output'):
        raise HTTPException(status_code=400, detail="field_type must be 'how_to_apply' or 'expected_output'")
    
    images = get_section_images(section_tag, field_type)
    return {
        "section_tag": section_tag,
        "field_type": field_type,
        "images": images,
        "count": len(images)
    }


# =============================================================================
# BUILD YOUR USE CASE [BETA] ENDPOINTS
# =============================================================================
# All new endpoints are prefixed with /usecase-builder/ -- completely isolated
# from existing routes. No existing code is modified.
# =============================================================================

# Import CRUD functions for the new table
try:
    from src.backend.services.lakebase import (
        save_usecase_builder_description,
        get_all_saved_usecases,
        update_saved_usecase,
        delete_saved_usecase,
        _format_display_name as format_display_name,
    )
except ImportError:
    logger.warning("Use case builder CRUD functions not available")
    def save_usecase_builder_description(*args, **kwargs):
        return None
    def get_all_saved_usecases():
        return []
    def update_saved_usecase(*args, **kwargs):
        return False
    def delete_saved_usecase(*args, **kwargs):
        return False
    def format_display_name(email):
        return email


# Booking App structural template for guiding LLM output
BOOKING_APP_TEMPLATE = """Create a simple **consumer marketplace/booking application** similar to Airbnb.

## Application Type
Consumer-facing marketplace that connects **Guests/Customers** with **Hosts/Providers** to discover, search, and book accommodations.

## Key Personas
- **Guest/Customer**: End users who search, compare, book, and pay
- **Host/Provider**: Businesses or individuals who list offerings, manage availability, and fulfill bookings

## Core Features Required

### Discovery & Search (3 Search Types)

The application must support **three distinct search experiences**:

#### 1. Standard Search (Structured Filters)
Traditional filter-based search where users explicitly select:
- Location/destination
- Check-in and check-out dates
- Number of guests
- Price range, amenities, property type
- Results page with ranking, listing cards, map sync, filters, and pagination

#### 2. Natural Language Search (Text-to-Filters)
Free-text search that parses user queries into structured filters:
- Example: *"quiet 2-bedroom near downtown this weekend under $200/night with parking"*
- System translates natural language into filter parameters
- Combines with availability checking
- Returns same structured results as standard search

#### 3. Agent-Based Search (Intent & Context-Aware)
AI-powered search that interprets higher-level user intent:
- Example: *"I want to stay near the concert venue for the Taylor Swift show next month"*
- Agent understands context (event dates, venue location, typical needs)
- Proactively suggests options based on inferred preferences
- Uses additional contextual information to refine and rank results
- Can ask clarifying questions and iterate on search criteria

### Search Results & Details
- Results page with ranking, listing cards, map sync, filters, and pagination
- Detail page with content sections, media galleries, amenities, reviews summary

### Booking & Transactions
- All-in pricing display with taxes, fees, discounts, and coupons
- Booking confirmation and modification workflows

## Data Entities
Core entities: Users, Listings, Units/Rooms, Availability, Pricing, Fees/Taxes, Bookings, Payments, Refunds, Reviews, Wishlists, Messages

## Technical Considerations
- Web-first with mobile considerations
- Map integration for location-based search
- Payment gateway integration (Stripe, etc.)
- AI/LLM integration for natural language and agent-based search

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support the core search and booking features for **US listings with USD currency**. We do not need user registration, login, user management, host management, property management, or any additional functionality. This will be an **open, public site** where anyone can search for a listing and make a booking."""


USE_CASE_BUILDER_SYSTEM_PROMPT = f"""You are an expert product architect who creates detailed, well-structured use case descriptions for software applications. Your output must be professional, clear Markdown that follows a specific structural template.

Here is an EXAMPLE of a well-structured use case description (Booking App):

---
{BOOKING_APP_TEMPLATE}
---

Use the SAME structural sections (Application Type, Key Personas, Core Features Required, Data Entities, Technical Considerations, Scope Constraints) but adapt the content to the user's specific industry and use case.

IMPORTANT GUIDELINES:
1. Output MUST be valid Markdown with proper headers (##), bold (**), lists (-), and formatting
2. Be specific and detailed -- not generic boilerplate
3. Include realistic examples where appropriate
4. Scope Constraints should keep things simple and focused
5. Adapt the feature sections to match the use case (don't force search types if not applicable)
6. If images are provided, incorporate their context into the description
7. If hints are provided, use them to guide specific details
"""

USE_CASE_REFINE_SYSTEM_PROMPT = f"""You are an expert editor who refines and polishes use case descriptions into a professional, consistent format. You will receive a draft use case description and must improve it while preserving the user's intent.

Your output must follow this structural template (same sections as the example below):

---
{BOOKING_APP_TEMPLATE}
---

REFINEMENT GUIDELINES:
1. Preserve the user's core ideas and intent -- do NOT change the use case concept
2. Ensure all structural sections are present: Application Type, Key Personas, Core Features Required, Data Entities, Technical Considerations, Scope Constraints
3. Improve clarity, specificity, and professional tone
4. Fix any formatting issues (proper Markdown headers, lists, bold)
5. Add missing details where obvious
6. Keep Scope Constraints simple and focused
7. Output ONLY the refined use case description in Markdown -- no preamble or explanation
8. If the user provides specific refinement instructions, prioritize those changes above all else
9. When given feedback, make targeted improvements rather than rewriting the entire document -- preserve what already works
"""


class UseCaseGenerateRequest(BaseModel):
    """Request body for use case generation."""
    industry: Optional[str] = None
    use_case_name: Optional[str] = None
    hints: Optional[str] = None
    images: Optional[List[str]] = None  # base64 data-URL strings (images only)
    text_attachments: Optional[List[Dict[str, str]]] = None  # [{"name": str, "content": str}]
    pdf_attachments: Optional[List[Dict[str, str]]] = None  # [{"name": str, "data": str (base64 data-URL)}]
    current_draft: Optional[str] = None
    refinement_feedback: Optional[str] = None  # user's natural-language refinement instructions
    mode: str = "generate"  # "generate" or "refine"


class UseCaseSaveRequest(BaseModel):
    """Request body for saving a use case."""
    industry: str = ""
    use_case_name: str = ""
    description: str


class UseCaseUpdateRequest(BaseModel):
    """Request body for updating a saved use case."""
    industry: Optional[str] = None
    use_case_name: Optional[str] = None
    description: Optional[str] = None


SPARSE_TEXT_THRESHOLD = 50

def _process_pdf(data_url: str, max_pages: int = 5) -> dict:
    """Process a PDF with a text-first strategy to stay within the 4MB serving endpoint limit.

    Text is always extracted. Page images are only rendered for pages with sparse
    text (< SPARSE_TEXT_THRESHOLD chars), indicating scanned or image-heavy content.
    Images use 72 DPI / JPEG quality 60 to minimise base64 payload size.

    Returns {"images": [...], "text": str, "has_rich_text": bool}.
    """
    import base64 as b64_mod
    try:
        import pymupdf
    except ImportError:
        logger.warning("[UseCase Builder] PyMuPDF not installed -- cannot process PDF")
        return {"images": [], "text": "(PDF processing unavailable — PyMuPDF not installed)", "has_rich_text": False}

    try:
        raw = data_url
        if raw.startswith("data:"):
            raw = raw.split(",", 1)[1] if "," in raw else raw
        pdf_bytes = b64_mod.b64decode(raw)
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")

        page_images: list[str] = []
        text_parts: list[str] = []
        page_count = min(len(doc), max_pages)
        rich_text_pages = 0

        for i in range(page_count):
            page = doc[i]
            page_text = page.get_text() or ""
            if page_text.strip():
                text_parts.append(page_text.strip())

            if len(page_text.strip()) >= SPARSE_TEXT_THRESHOLD:
                rich_text_pages += 1
            else:
                pix = page.get_pixmap(dpi=72)
                img_bytes = pix.tobytes("jpeg", jpg_quality=60)
                b64_str = b64_mod.b64encode(img_bytes).decode("utf-8")
                page_images.append(f"data:image/jpeg;base64,{b64_str}")

        total_pages = len(doc)
        doc.close()

        combined_text = "\n\n".join(text_parts) if text_parts else ""
        if total_pages > max_pages:
            combined_text += f"\n\n(PDF truncated: processed {max_pages} of {total_pages} pages)"

        has_rich_text = rich_text_pages > 0
        logger.info(f"[UseCase Builder] PDF processed: {page_count} pages, {rich_text_pages} text-rich, {len(page_images)} rendered as images")
        return {"images": page_images, "text": combined_text, "has_rich_text": has_rich_text}
    except Exception as exc:
        logger.error(f"[UseCase Builder] PDF processing error: {exc}")
        return {"images": [], "text": f"(PDF processing failed: {exc})", "has_rich_text": False}


async def _stream_usecase_generation(
    request_body: UseCaseGenerateRequest,
) -> AsyncGenerator[str, None]:
    """Stream LLM response for use case generation/refinement."""
    # Get workspace client and endpoint
    client = get_workspace_client()
    endpoint = get_best_available_endpoint()
    
    if not client or not endpoint:
        yield f"data: {json.dumps({'type': 'error', 'error': 'LLM not available'})}\n\n"
        return
    
    # Choose system prompt based on mode
    if request_body.mode == "refine" and request_body.current_draft:
        system_prompt = USE_CASE_REFINE_SYSTEM_PROMPT
        # User message is the draft + optional refinement feedback
        user_text_parts = [
            "Here is the current use case description draft:\n\n" + request_body.current_draft
        ]
        if request_body.refinement_feedback:
            user_text_parts.append(
                "\n\n---\n**User's refinement instructions:**\n" + request_body.refinement_feedback
            )
        else:
            user_text_parts.append("\n\nPlease polish and improve this description.")
    else:
        system_prompt = USE_CASE_BUILDER_SYSTEM_PROMPT
        user_text_parts = []
        if request_body.industry:
            user_text_parts.append(f"**Industry**: {request_body.industry}")
        if request_body.use_case_name:
            user_text_parts.append(f"**Use Case**: {request_body.use_case_name}")
        if request_body.hints:
            user_text_parts.append(f"**Additional Details/Hints**: {request_body.hints}")
        if not user_text_parts:
            user_text_parts.append("Generate a general-purpose application use case description.")
        user_text_parts.insert(0, "Generate a detailed use case description for the following:\n")
    
    # Append text from text-file attachments
    MAX_ATTACHMENT_TEXT = 500_000  # ~500KB per attachment
    if request_body.text_attachments:
        for att in request_body.text_attachments[:5]:
            name = att.get("name", "file.txt")
            content = att.get("content", "")
            if len(content) > MAX_ATTACHMENT_TEXT:
                logger.warning(f"[UseCase Builder] Skipping oversized text attachment: {name} ({len(content)} chars)")
                continue
            user_text_parts.append(f"\n\n--- Attached File: {name} ---\n{content}")
    
    # Process PDF attachments: render pages as images + extract supplementary text
    pdf_page_images: List[str] = []
    if request_body.pdf_attachments:
        for att in request_body.pdf_attachments[:5]:
            name = att.get("name", "document.pdf")
            data = att.get("data", "")
            if not data:
                continue
            result = _process_pdf(data)
            pdf_page_images.extend(result["images"])
            if result["text"] and len(result["text"]) <= MAX_ATTACHMENT_TEXT:
                user_text_parts.append(f"\n\n--- Extracted text from PDF: {name} ---\n{result['text']}")
            elif result["text"]:
                logger.warning(f"[UseCase Builder] Skipping oversized PDF text: {name} ({len(result['text'])} chars)")
    
    user_text = "\n".join(user_text_parts)
    
    # Collect all images: user-uploaded images + rendered PDF pages
    all_images = list(request_body.images or [])[:5]
    all_images.extend(pdf_page_images[:10])
    
    # Enforce image payload budget (Databricks Foundation Model API has a 4MB hard limit)
    MAX_IMAGE_PAYLOAD_BYTES = 2_500_000
    total_img_size = sum(len(img.encode('utf-8')) for img in all_images)
    while all_images and total_img_size > MAX_IMAGE_PAYLOAD_BYTES:
        removed = all_images.pop()
        total_img_size -= len(removed.encode('utf-8'))
        logger.warning(f"[UseCase Builder] Dropped an image to stay within {MAX_IMAGE_PAYLOAD_BYTES} byte budget ({total_img_size} remaining)")
    
    # Build messages -- use multimodal when any images are present
    messages = [{"role": "system", "content": system_prompt}]
    
    if all_images:
        content_blocks: List[Dict[str, Any]] = [{"type": "text", "text": user_text}]
        for img_b64 in all_images:
            if img_b64.startswith("data:"):
                image_url = img_b64
            else:
                image_url = f"data:image/png;base64,{img_b64}"
            content_blocks.append({
                "type": "image_url",
                "image_url": {"url": image_url}
            })
        messages.append({"role": "user", "content": content_blocks})
    else:
        messages.append({"role": "user", "content": user_text})
    
    # Pre-flight size check: fall back to text-only if payload still exceeds safety margin
    import json as _json
    payload_estimate = len(_json.dumps(messages).encode('utf-8'))
    if payload_estimate > 3_800_000:
        logger.warning(f"[UseCase Builder] Payload {payload_estimate} bytes exceeds 3.8MB safety limit, falling back to text-only")
        messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_text}]
    
    # Build streaming request
    request_payload = {
        "messages": messages,
        "max_tokens": 4000,
        "stream": True,
    }
    if "mini" not in endpoint.lower():
        request_payload["temperature"] = 0.5
    
    try:
        yield f"data: {json.dumps({'type': 'start', 'model': endpoint})}\n\n"
        
        import httpx
        workspace_host = client.config.host.rstrip('/')
        
        headers = {"Content-Type": "application/json"}
        try:
            auth_header = client.config.authenticate()
            if auth_header:
                headers.update(auth_header)
        except Exception as auth_err:
            logger.warning(f"  [UseCase Builder] Could not get auth headers: {auth_err}")
        
        async with httpx.AsyncClient(timeout=120.0) as http_client:
            async with http_client.stream(
                "POST",
                f"{workspace_host}/serving-endpoints/{endpoint}/invocations",
                json=request_payload,
                headers=headers
            ) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    yield f"data: {json.dumps({'type': 'error', 'error': f'HTTP {response.status_code}: {error_body.decode()[:200]}'})}\n\n"
                    return
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            yield f"data: {json.dumps({'type': 'done'})}\n\n"
                        else:
                            try:
                                chunk = json.loads(data)
                                if "choices" in chunk and chunk["choices"]:
                                    delta = chunk["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                            except json.JSONDecodeError:
                                pass
    except Exception as e:
        logger.error(f"[UseCase Builder] Streaming error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"


@router.post("/usecase-builder/generate", summary="Generate use case description (streaming SSE)")
async def usecase_builder_generate(request_body: UseCaseGenerateRequest):
    """
    Stream a use case description from the LLM.
    Supports multimodal input (images) and refine mode.
    """
    # Validate at least one input is provided
    has_input = any([
        request_body.industry,
        request_body.use_case_name,
        request_body.hints,
        request_body.images,
        request_body.text_attachments,
        request_body.pdf_attachments,
        request_body.current_draft,
    ])
    if not has_input:
        raise HTTPException(status_code=400, detail="At least one input (industry, use_case_name, hints, images, or attachments) is required")
    
    logger.info(f"[UseCase Builder] Generate request: mode={request_body.mode}, industry={request_body.industry}, use_case={request_body.use_case_name}, images={len(request_body.images or [])}, text_attachments={len(request_body.text_attachments or [])}, pdf_attachments={len(request_body.pdf_attachments or [])}")
    
    return StreamingResponse(
        _stream_usecase_generation(request_body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/usecase-builder/save", summary="Save a use case description")
async def usecase_builder_save(request_body: UseCaseSaveRequest, request: Request):
    """Save a generated/edited use case description to the community library."""
    if not request_body.description.strip():
        raise HTTPException(status_code=400, detail="Description cannot be empty")
    
    user_email = _get_session_user(request)
    display_name = format_display_name(user_email)
    
    new_id = save_usecase_builder_description(
        created_by=user_email,
        display_name=display_name,
        industry=request_body.industry,
        use_case_name=request_body.use_case_name,
        description=request_body.description.strip(),
    )
    
    if new_id is None:
        raise HTTPException(status_code=500, detail="Failed to save use case description")
    
    logger.info(f"[UseCase Builder] Saved use case id={new_id} by {user_email}")
    return {"success": True, "id": new_id, "message": "Use case saved successfully"}


@router.get("/usecase-builder/list", summary="List all saved use cases (community library)")
async def usecase_builder_list():
    """Get all saved use case descriptions from all users (public community library)."""
    use_cases = get_all_saved_usecases()
    return {"use_cases": use_cases}


@router.put("/usecase-builder/{uc_id}", summary="Update a saved use case")
async def usecase_builder_update(uc_id: int, request_body: UseCaseUpdateRequest, request: Request):
    """Update a saved use case description. Any user can edit (collaborative)."""
    user_email = _get_session_user(request)
    
    success = update_saved_usecase(
        uc_id=uc_id,
        updated_by=user_email,
        industry=request_body.industry,
        use_case_name=request_body.use_case_name,
        description=request_body.description,
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Use case not found or update failed")
    
    logger.info(f"[UseCase Builder] Updated use case id={uc_id} by {user_email}")
    return {"success": True, "message": "Use case updated successfully"}


@router.delete("/usecase-builder/{uc_id}", summary="Delete a saved use case")
async def usecase_builder_delete(uc_id: int, request: Request):
    """Soft-delete a saved use case description."""
    user_email = _get_session_user(request)
    
    success = delete_saved_usecase(uc_id=uc_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Use case not found or delete failed")
    
    logger.info(f"[UseCase Builder] Deleted use case id={uc_id} by {user_email}")
    return {"success": True, "message": "Use case deleted successfully"}
