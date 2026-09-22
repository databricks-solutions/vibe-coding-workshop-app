#!/usr/bin/env python3
"""
Databricks Apps Entry Point - FastAPI Application
Serves both the React frontend and API endpoints.
"""

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
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# Import the API router
from src.backend.api.hackathon import router as hackathon_router
from src.backend.api.routes import router as api_router

MCP_MOUNT_ENABLED = os.environ.get("MCP_MOUNT_ENABLED", "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


if MCP_MOUNT_ENABLED:
    from src.backend.mcp_server import mcp_app

    @asynccontextmanager
    async def mcp_lifespan(_app):
        async with mcp_app.router.lifespan_context(mcp_app):
            yield


    app_lifespan = mcp_lifespan
else:
    app_lifespan = None


_MCP_DUAL_ACCEPT = b"application/json, text/event-stream"

_MCP_METHOD_NOT_ALLOWED_BODY = (
    b'{"jsonrpc":"2.0","error":{"code":-32000,'
    b'"message":"Method not allowed (stateless server)."},"id":null}'
)


async def _mcp_method_not_allowed(send):
    """Send a 405 JSON-RPC error (CORS headers are added by CORSMiddleware)."""
    await send({
        "type": "http.response.start",
        "status": 405,
        "headers": [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(_MCP_METHOD_NOT_ALLOWED_BODY)).encode()),
        ],
    })
    await send({"type": "http.response.body", "body": _MCP_METHOD_NOT_ALLOWED_BODY})


def _normalize_mcp_accept(headers):
    """Widen a JSON-only / wildcard / empty Accept to the dual MCP value.

    The Streamable HTTP transport's POST handler returns 406 unless Accept lists
    BOTH application/json and text/event-stream. Genie Code's browser save-time
    validation (and gateway probes) send Accept: application/json or */*, so the
    handshake 406s and the "Add MCP server" entry silently fails to persist.
    Since the server runs with json_response=True, replying with plain JSON is
    always valid, so widening the Accept is safe. A client that already lists
    text/event-stream is left untouched. Ref:
    https://docs.databricks.com/aws/en/genie-code/mcp
    """
    result = []
    seen = False
    for name, value in headers:
        if name == b"accept":
            seen = True
            lower = value.lower()
            has_json = b"application/json" in lower or b"*/*" in lower
            has_event_stream = b"text/event-stream" in lower
            if not (has_json and has_event_stream):
                value = _MCP_DUAL_ACCEPT
        result.append((name, value))
    if not seen:
        result.append((b"accept", _MCP_DUAL_ACCEPT))
    return result


class _MCPPathRewrite:
    """Rewrite the exact MCP path + normalize Accept before Starlette routes."""

    def __init__(self, app):
        # Param MUST be named `app`: Starlette instantiates middleware as
        # cls(app=app, ...) (by keyword), so a different name (e.g. asgi_app)
        # raises TypeError at middleware-stack build time and 500s every route.
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "") if scope["type"] == "http" else ""
        if path == "/mcp" or path.startswith("/mcp/"):
            if scope.get("method") in {"GET", "DELETE"}:
                # Stateless server: there is no standalone server->client SSE
                # stream and no session to tear down. FastMCP answers GET with a
                # 200 text/event-stream that hangs forever (no data). Genie Code
                # opens that stream during "Add MCP server" validation and stalls
                # waiting on it, so the entry never persists. Match the proven
                # Genie Code reference (register-mcp.ts) and reject GET/DELETE
                # with 405 so the client proceeds instead of waiting.
                await _mcp_method_not_allowed(send)
                return
            scope = dict(scope)
            if path == "/mcp":
                scope["path"] = "/mcp/"
                # Deterministic + idempotent: we only reach here when
                # path == "/mcp", so the rewritten raw_path is unambiguously
                # b"/mcp/". Appending would double-slash if this ran twice.
                scope["raw_path"] = b"/mcp/"
            # Clear the transport's 406 Accept gate for JSON-only/`*/*` clients.
            scope["headers"] = _normalize_mcp_accept(scope.get("headers", []))
        await self.app(scope, receive, send)

# Get the directory where this script is located
BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"
UPLOADS_DIR = BASE_DIR / "uploads"

# Create FastAPI app
app = FastAPI(
    title="Vibe Coding Workshop API",
    description="AI-Powered Development Workflow Application - All UI data served from backend",
    version="2.0.0",
    lifespan=app_lifespan,
)
if MCP_MOUNT_ENABLED:
    app.add_middleware(_MCPPathRewrite)

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
                origin_netloc = urlparse(origin).netloc
                # Allow same-origin (prod, Databricks Apps) OR any origin explicitly
                # listed in ALLOWED_ORIGINS (e.g. the Vite dev server in local
                # two-server dev: ALLOWED_ORIGINS=http://localhost:5174).
                allowed = origin_netloc == expected_host or origin in ALLOWED_ORIGINS or any(
                    origin_netloc == urlparse(o).netloc for o in ALLOWED_ORIGINS
                )
                if not allowed:
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
    # Genie Code connects to /mcp cross-origin (workspace origin -> app origin)
    # with credentials. Browsers require an explicit origin (never "*") together
    # with credentials, and the MCP client must be able to read mcp-session-id.
    # ALLOWED_ORIGINS carries the workspace URL. Ref:
    # https://docs.databricks.com/aws/en/genie-code/mcp
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["mcp-session-id", "mcp-protocol-version"],
)

# Include the API router with /api prefix
app.include_router(api_router, prefix="/api", tags=["API"])
app.include_router(hackathon_router, prefix="/api", tags=["Hackathons"])


# ============== Health Check ==============

@app.get("/health")
async def health_check():
    """Health check endpoint for Databricks Apps."""
    return {
        "status": "healthy",
        "app": "Vibe Coding Workshop",
        "version": "2.0.0",
        "features": [
            "Industries API",
            "Use Cases API", 
            "Prompt Generation API",
            "Workflow Steps API",
            "Prerequisites API"
        ]
    }


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


if MCP_MOUNT_ENABLED:
    app.mount("/mcp", mcp_app, name="mcp")


# Catch-all route for React SPA - must be LAST
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve the React SPA for all non-API routes."""
    # Don't serve index.html for API routes
    if (
        full_path.startswith("api/")
        or full_path == "health"
        or full_path == "docs"
        or full_path == "openapi.json"
        or (MCP_MOUNT_ENABLED and (full_path == "mcp" or full_path.startswith("mcp/")))
    ):
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
