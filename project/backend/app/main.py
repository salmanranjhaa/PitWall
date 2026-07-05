"""
Pitwall F1 Strategy Simulator API

FastAPI entry point that assembles all routers and configures CORS
for frontend communication.
"""

import sys
import os

# Ensure app package imports work regardless of execution context
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import race, strategy, weather, data, qualify, auth

# ---------------------------------------------------------------------------
# CORS — driven by environment variable for production safety
# ---------------------------------------------------------------------------
_DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
]

def _get_allowed_origins() -> list[str]:
    """
    Read comma-separated allowed origins from ALLOWED_ORIGINS env var.
    Falls back to localhost dev defaults if the variable is not set.

    Example .env:
        ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:3000
    """
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    if raw.strip():
        return [o.strip() for o in raw.split(",") if o.strip()]
    return _DEFAULT_ORIGINS

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Pitwall F1 Strategy Simulator API",
        description="ML-powered race strategy simulation backend with tire degradation models, "
                    "lap time prediction, Monte Carlo strategy optimization, and real-time race state management.",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS middleware — origins restricted via ALLOWED_ORIGINS env var
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Accept"],
    )

    # Register routers
    app.include_router(race.router)
    app.include_router(qualify.router)
    app.include_router(strategy.router)
    app.include_router(weather.router)
    app.include_router(data.router)
    app.include_router(auth.router)
    app.include_router(auth.profile_router)

    # Root endpoint
    @app.get("/", include_in_schema=False)
    def root():
        return {
            "service": "Pitwall F1 Strategy Simulator API",
            "version": "2.0.0",
            "docs": "/docs",
            "health": "/health",
        }

    # Health check
    @app.get("/health")
    def health_check():
        """Liveness probe for container orchestration."""
        return {"status": "ok", "version": "2.0.0"}

    return app


# ---------------------------------------------------------------------------
# Global app instance (used by ASGI servers)
# ---------------------------------------------------------------------------
app = create_app()

# ---------------------------------------------------------------------------
# Local development entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
