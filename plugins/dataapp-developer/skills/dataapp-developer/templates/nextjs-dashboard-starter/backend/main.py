"""
FastAPI backend for Keboola Data App.

ARCHITECTURE:
  - Data loaded once at startup from Keboola Storage API (or local CSVs)
  - Endpoints serve pre-computed results from in-memory DataFrames
  - User context read from Keboola OIDC headers (x-kbc-user-email)

HOW TO ADD AN ENDPOINT:
  1. Create a router file: backend/routers/my_feature.py
  2. Use get_data() dependency to access loaded DataFrames
  3. Use get_user_context() dependency for user info
  4. Register the router below
  5. Add matching types + hook in frontend (lib/types.ts + lib/api.ts)

See routers/__init__.py for a detailed example.
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.data_loader import init_data
from services.user_context import UserContext, get_user_context

logger = logging.getLogger(__name__)

# Load .env for local dev (no-op in production where env vars are injected)
load_dotenv(Path(__file__).parent / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all Keboola tables into memory at startup."""
    try:
        init_data()
    except Exception:
        logger.error("Data loading failed — app cannot start", exc_info=True)
        raise
    yield


app = FastAPI(title="Keboola Data App", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # Local dev only — in production, Nginx proxies same-origin so CORS is irrelevant.
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    """Health check — frontend uses this to confirm backend is reachable."""
    return {"status": "ok"}


@app.get("/api/platform")
def platform():
    """Keboola connection info for the frontend."""
    kbc_url = os.getenv("KBC_URL", "").strip().rstrip("/")
    kbc_project_id = os.getenv("KBC_PROJECTID", "").strip()
    if not kbc_project_id:
        kbc_token = os.getenv("KBC_TOKEN", "")
        if "-" in kbc_token:
            kbc_project_id = kbc_token.split("-", 1)[0]
    connection_base = kbc_url.split("/v2/")[0] if "/v2/" in kbc_url else kbc_url
    return {
        "connection_url": connection_base or None,
        "project_id": kbc_project_id or None,
    }


@app.get("/api/me")
def me(user: UserContext = Depends(get_user_context)):
    """Current user info from Keboola OIDC."""
    return {
        "email": user.email or "demo@localhost",
        "role": user.role,
        "is_authenticated": user.is_authenticated,
    }


# CUSTOMIZE: Register your routers
# from routers import kpis
# app.include_router(kpis.router, prefix="/api")
