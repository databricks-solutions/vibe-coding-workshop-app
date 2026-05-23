#!/usr/bin/env python3
"""
Databricks Apps Entry Point - FastAPI Application
Serves both the React frontend and API endpoints.
"""

import logging
import os
import sys
import time
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

# Add the src/backend directory to the Python path
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# Import the API router
from src.backend.api.routes import router as api_router
from src.backend.lakebase_host_resolver import resolve_and_export_lakebase_host
from src.backend.migrations import MigrationResult, apply_pending_migrations

logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan hook -- runs once per worker on startup.

    With the May 2026 Apps + Lakebase release, the bundle's
    `apps.<name>.resources[].database` binding causes the platform to
    auto-inject PGHOST/PGUSER/PGDATABASE/PGPORT/PGSSLMODE -- so the legacy
    `lakebase_host_resolver` SDK lookup is now a fallback for installs that
    predate the binding. After resolving connection details, this hook also
    applies any unapplied DDL + seed SQL via the `<schema>._migrations`
    ledger, retiring the previous `databricks bundle run post_deploy`
    follow-up step.

    Both phases are intentionally non-fatal: the /health endpoint stays
    green for the Apps platform health check, and /health/lakebase reports
    data-tier readiness separately so the React shell can show a
    "waiting for Lakebase bootstrap" message during the rare cold-start
    window where the postgres binding is still attaching.
    """
    # Phase 1: ensure LAKEBASE_HOST is populated. On modern installs PGHOST
    # is already injected by the resource binding, so the resolver is a
    # no-op. Legacy installs without the binding fall through to the SDK
    # lookup based on ENDPOINT_NAME.
    if not os.environ.get("PGHOST", "").strip():
        try:
            resolve_and_export_lakebase_host()
        except Exception:
            logger.exception("Lakebase host resolution failed; continuing startup")

    # Phase 2: apply DDL/seed migrations idempotently. This replaces the old
    # `databricks bundle run post_deploy` step.
    try:
        result: MigrationResult = apply_pending_migrations()
    except Exception as exc:
        logger.exception("apply_pending_migrations raised unexpectedly")
        result = MigrationResult(
            ready=False, applied=[], skipped=[], failed=[],
            reason=f"unexpected error: {exc}",
        )

    app.state.lakebase_ready = result.ready
    app.state.lakebase_migrations = result
    if result.ready:
        logger.info(
            "Lakebase ready (applied=%d skipped=%d)",
            len(result.applied), len(result.skipped),
        )
    else:
        logger.warning(
            "Lakebase not ready: %s (applied=%d skipped=%d failed=%d)",
            result.reason, len(result.applied), len(result.skipped), len(result.failed),
        )
    yield

# Get the directory where this script is located
BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"
UPLOADS_DIR = BASE_DIR / "uploads"

# Create FastAPI app
app = FastAPI(
    title="Vibe Coding Workshop API",
    description="AI-Powered Development Workflow Application - All UI data served from backend",
    version="2.0.0",
    lifespan=lifespan,
)

# ============== Security Configuration ==============
# All values below are env-tunable so prod can override without code changes.
# Defaults chosen to be safe for the current Databricks Apps (same-origin) deployment.

ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()
]
MAX_REQUEST_BYTES = int(os.environ.get("MAX_REQUEST_BYTES", 50 * 1024 * 1024))
RATE_LIMIT_PER_MIN = int(os.environ.get("RATE_LIMIT_PER_MIN", 1000))  # 0 disables
_RATE_BUCKETS: dict[str, deque] = {}


def _client_key(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    """Request-time security checks: size cap, rate limit, origin guard.
    Safe response headers are appended after the endpoint runs.
    """
    if request.url.path.startswith("/api/"):
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > MAX_REQUEST_BYTES:
            return JSONResponse({"error": "request too large"}, status_code=413)

        if RATE_LIMIT_PER_MIN > 0:
            now = time.monotonic()
            key = _client_key(request)
            bucket = _RATE_BUCKETS.setdefault(key, deque())
            cutoff = now - 60.0
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= RATE_LIMIT_PER_MIN:
                return JSONResponse({"error": "rate limit exceeded"}, status_code=429)
            bucket.append(now)

        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            origin = request.headers.get("origin") or request.headers.get("referer")
            if origin:
                expected_host = request.headers.get("x-forwarded-host") or request.url.netloc
                if urlparse(origin).netloc != expected_host:
                    return JSONResponse(
                        {"error": "cross-origin request blocked"}, status_code=403
                    )

    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
    )
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Include the API router with /api prefix
app.include_router(api_router, prefix="/api", tags=["API"])


# ============== Health Check ==============

@app.get("/health")
async def health_check():
    """Process-level health check for the Databricks Apps platform.

    Always returns 200 once the FastAPI process is up so the Apps UI marks the
    app RUNNING. Lakebase readiness is reported separately via
    /health/lakebase so platform health and data-tier health can diverge
    during the UI-first install flow.
    """
    return {
        "status": "healthy",
        "app": "Vibe Coding Workshop",
        "version": "2.0.0",
        "lakebase_ready": bool(getattr(app.state, "lakebase_ready", False)),
        "features": [
            "Industries API",
            "Use Cases API",
            "Prompt Generation API",
            "Workflow Steps API",
            "Prerequisites API",
        ],
    }


@app.get("/health/lakebase")
async def lakebase_health():
    """Reports whether Lakebase is provisioned, reachable, and migrated.

    The lifespan hook applies DDL + seed migrations on startup and stores a
    structured ``MigrationResult`` on ``app.state``. This endpoint surfaces
    that result -- including the per-file applied / skipped / failed lists --
    so attendees and operators can tell at a glance whether the data tier is
    ready, and if not, why.

    Returns 200 with ``ready: false`` (rather than a 5xx) so the React shell
    can poll it without triggering platform-level alerts during the rare
    cold-start window where the postgres binding is still attaching.
    """
    ready = bool(getattr(app.state, "lakebase_ready", False))
    result = getattr(app.state, "lakebase_migrations", None)
    payload = {
        "ready": ready,
        "endpoint_name": os.environ.get("ENDPOINT_NAME", ""),
        "message": (
            "Lakebase is provisioned and reachable; migrations are up to date."
            if ready
            else "Lakebase is not ready. The /api endpoints will fail until the "
                 "`apps.<name>.resources[].database` binding finishes attaching "
                 "and the lifespan migration step succeeds."
        ),
    }
    if result is not None:
        payload["applied"] = result.applied
        payload["skipped"] = result.skipped
        payload["failed"] = result.failed
        if result.reason:
            payload["reason"] = result.reason
    return payload


# ============== Static File Serving ==============

# Mount static assets (JS, CSS, images)
if DIST_DIR.exists():
    # Mount the assets directory
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
    
    # Serve vite.svg
    @app.get("/vite.svg")
    async def vite_svg():
        svg_path = DIST_DIR / "vite.svg"
        if svg_path.exists():
            return FileResponse(str(svg_path), media_type="image/svg+xml")
        return JSONResponse({"error": "Not found"}, status_code=404)


# Mount uploads directory for serving uploaded images
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


# Catch-all route for React SPA - must be LAST
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve the React SPA for all non-API routes."""
    # Don't serve index.html for API routes
    if full_path.startswith("api/") or full_path == "health" or full_path == "docs" or full_path == "openapi.json":
        return JSONResponse({"error": "Not found"}, status_code=404)
    
    # Serve static files from dist/ if they exist (e.g. brand-config.json)
    if full_path and DIST_DIR.exists():
        file_path = DIST_DIR / full_path
        if file_path.is_file() and file_path.resolve().is_relative_to(DIST_DIR.resolve()):
            return FileResponse(str(file_path))
    
    # Serve index.html for the SPA
    index_path = DIST_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path), media_type="text/html")
    
    # Fallback if dist doesn't exist
    return JSONResponse({
        "message": "Vibe Coding Workshop API",
        "version": "2.0.0",
        "api_docs": "/docs",
        "endpoints": {
            "industries": "/api/industries",
            "use_cases": "/api/use-cases/{industry_id}",
            "generate_prompt": "/api/generate-prompt",
            "workflow_steps": "/api/workflow-steps",
            "prerequisites": "/api/prerequisites",
            "all_data": "/api/all-data"
        }
    })


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
