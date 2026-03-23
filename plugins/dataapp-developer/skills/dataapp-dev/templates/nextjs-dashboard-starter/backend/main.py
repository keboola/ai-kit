import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
import requests
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

# ─── Data loading ────────────────────────────────────────────────────────────

_tables: dict[str, pd.DataFrame] = {}


def _load_from_storage_api() -> dict[str, pd.DataFrame]:
    """Load CSV tables from Keboola Storage API."""
    token = os.environ["KBC_TOKEN"]
    url = os.environ["KBC_URL"].rstrip("/")
    # CUSTOMIZE: Replace with your actual table IDs from Keboola Storage
    table_ids = [
        # "out.c-my_bucket.my_table",
    ]
    frames: dict[str, pd.DataFrame] = {}
    for tid in table_ids:
        resp = requests.get(
            f"{url}/tables/{tid}/data",
            headers={"X-StorageApi-Token": token},
            timeout=120,
        )
        resp.raise_for_status()
        from io import StringIO
        df = pd.read_csv(StringIO(resp.text))
        short_name = tid.rsplit(".", 1)[-1]
        frames[short_name] = df
        logger.info("Loaded %s (%d rows)", tid, len(df))
    return frames


def _load_from_csv_dir(data_dir: Path) -> dict[str, pd.DataFrame]:
    """Load all CSV files from a local directory (dev fallback)."""
    frames: dict[str, pd.DataFrame] = {}
    for f in sorted(data_dir.glob("*.csv")):
        df = pd.read_csv(f)
        frames[f.stem] = df
        logger.info("Loaded %s (%d rows)", f.name, len(df))
    return frames


def init_data():
    """Load data from Keboola Storage API or local CSV fallback."""
    global _tables
    kbc_token = os.getenv("KBC_TOKEN", "").strip()
    kbc_url = os.getenv("KBC_URL", "").strip()
    data_dir = os.getenv("DATA_DIR", "").strip()

    if kbc_token and kbc_url:
        logger.info("Loading from Keboola Storage API...")
        _tables = _load_from_storage_api()
    elif data_dir:
        logger.info("Loading from DATA_DIR: %s", data_dir)
        _tables = _load_from_csv_dir(Path(data_dir))
    else:
        dev_dir = Path(__file__).parent / "data"
        if dev_dir.exists():
            logger.info("Loading from default dev directory: %s", dev_dir)
            _tables = _load_from_csv_dir(dev_dir)
        else:
            logger.warning(
                "No data source configured. "
                "Set KBC_TOKEN+KBC_URL or DATA_DIR, or place CSVs in backend/data/"
            )


# ─── App setup ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_data()
    yield


app = FastAPI(
    title="Keboola Dashboard API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ─── Core endpoints ─────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/platform")
def get_platform():
    """Expose Keboola connection URL and project ID for frontend links."""
    kbc_url = os.getenv("KBC_URL", "").strip().rstrip("/")
    kbc_project_id = os.getenv("KBC_PROJECTID", "").strip()
    connection_base = kbc_url.split("/v2/")[0] if "/v2/" in kbc_url else kbc_url
    if not connection_base:
        connection_base = "https://connection.europe-west3.gcp.keboola.com"
    return {
        "connection_url": connection_base,
        "project_id": kbc_project_id or None,
        # CUSTOMIZE: Replace with your Storage bucket name
        "bucket": "out.c-my_bucket",
    }


@app.get("/api/me")
def get_me(request: Request):
    """Return current user info from Keboola OIDC headers."""
    email = (
        request.headers.get("X-Kbc-User-Email")
        or request.headers.get("x-kbc-user-email")
        or "dev@localhost"
    )
    return {
        "email": email,
        "role": "admin",
        "is_admin": True,
    }


# ─── Example data endpoint ──────────────────────────────────────────────────
# CUSTOMIZE: Replace with your actual API endpoints

@app.get("/api/kpis")
def get_kpis(period: str = "l12m"):
    """Return KPI summary for the given period.

    CUSTOMIZE: Replace this placeholder with real calculations from your data.
    """
    # Placeholder response — the skill will replace this with real logic
    return {
        "total_revenue": 1_250_000,
        "growth_rate": 12.5,
        "active_users": 3_420,
        "conversion_rate": 4.8,
        "margin_pct": 62.3,
        "delta_revenue_pct": 8.2,
        "delta_growth_pct": 2.1,
        "delta_users_pct": 15.3,
        "delta_conversion_pct": -0.5,
    }


@app.get("/api/trends")
def get_trends(period: str = "l12m"):
    """Return time-series trend data.

    CUSTOMIZE: Replace with real calculations from your data tables.
    """
    return {
        "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        "values_current": [95, 105, 98, 112, 108, 120, 115, 125, 130, 128, 135, 142],
        "values_previous": [88, 92, 85, 95, 90, 102, 98, 108, 112, 110, 118, 125],
    }


@app.get("/api/items")
def get_items(period: str = "l12m"):
    """Return list items for the data table.

    CUSTOMIZE: Replace with real data from your Keboola tables.
    """
    return [
        {"id": "1", "name": "Product Alpha", "category": "Software", "value": 450000, "change_pct": 12.3, "count": 1250},
        {"id": "2", "name": "Product Beta", "category": "Services", "value": 320000, "change_pct": -3.1, "count": 890},
        {"id": "3", "name": "Product Gamma", "category": "Software", "value": 280000, "change_pct": 8.7, "count": 720},
        {"id": "4", "name": "Product Delta", "category": "Hardware", "value": 200000, "change_pct": 22.5, "count": 340},
    ]
