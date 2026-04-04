"""
Keboola Storage API data loader.

Production-grade pattern extracted from a real Keboola Data App deployment.
Loads tables at startup into pandas DataFrames for fast API responses.

DATA SOURCE PRIORITY:
  1. KBC_TOKEN + KBC_URL env vars → Keboola Storage API (production)
  2. backend/data/*.csv files → local dev fallback (no credentials needed)

HOW IT WORKS:
  - init_data() is called once during FastAPI startup (lifespan)
  - Downloads tables in parallel using ThreadPoolExecutor
  - Handles all Keboola cloud providers:
    * AWS (S3): single signed URL download
    * Azure (ABS): single signed URL download
    * GCP: sliced export → download manifest → download each slice → concat
  - Stores DataFrames in module-level _DATA dict
  - get_data() is a FastAPI dependency that returns the loaded data

CUSTOMIZE: Update TABLE_IDS with your Keboola table IDs.
"""
from __future__ import annotations

import concurrent.futures
import io
import logging
import os
import time
from pathlib import Path
from typing import Optional

import pandas as pd
import requests

logger = logging.getLogger(__name__)

# ─── CUSTOMIZE: Your Keboola table IDs ───────────────────────────────────────
# Map a short name to the full Keboola table ID.
# The short name becomes the key in get_data(), e.g., data["revenue"]
TABLE_IDS: dict[str, str] = {
    # "revenue":   "out.c-your_bucket.revenue",
    # "customers": "out.c-your_bucket.customers",
    # "events":    "out.c-your_bucket.events",
}

# Module-level data store — populated once by init_data(), read by get_data()
_DATA: dict[str, pd.DataFrame] = {}


# ─── Keboola Storage API helpers ─────────────────────────────────────────────

def _get_table_columns(table_id: str, base: str, headers: dict) -> list[str]:
    """Fetch column names from Keboola table metadata."""
    resp = requests.get(f"{base}/v2/storage/tables/{table_id}", headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()["columns"]


def _download_keboola_table(table_id: str, kbc_url: str, kbc_token: str) -> pd.DataFrame:
    """Download a table from Keboola Storage API via async export.

    Handles three cloud provider patterns:
      - AWS (S3): Single signed URL with CSV header row
      - Azure (ABS): Single signed URL with CSV header row
      - GCP: Sliced export → manifest with slice URLs → download each → concat
        GCP slices have NO header row — column names fetched from table metadata.
    """
    headers = {"X-StorageApi-Token": kbc_token}
    base = kbc_url.rstrip("/")

    # Fetch column metadata (needed for GCP sliced CSVs that lack headers)
    columns = _get_table_columns(table_id, base, headers)

    # Start async export job
    resp = requests.post(
        f"{base}/v2/storage/tables/{table_id}/export-async",
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    job_id = resp.json()["id"]

    # Poll until complete (max ~2 minutes)
    for _ in range(120):
        resp = requests.get(f"{base}/v2/storage/jobs/{job_id}", headers=headers, timeout=30)
        resp.raise_for_status()
        job = resp.json()
        status = job.get("status")
        if status == "success":
            break
        if status in ("error", "cancelled"):
            raise RuntimeError(f"Keboola export failed for {table_id}: {job.get('error', {})}")
        time.sleep(1)
    else:
        raise TimeoutError(f"Keboola export timed out for {table_id}")

    file_info = job["results"]["file"]

    # GCP returns minimal file info — fetch full details with federation token
    if set(file_info.keys()) == {"id"}:
        file_resp = requests.get(
            f"{base}/v2/storage/files/{file_info['id']}?federationToken=1",
            headers=headers,
            timeout=30,
        )
        file_resp.raise_for_status()
        file_info = file_resp.json()

    # Handle GCP sliced exports
    if file_info.get("isSliced"):
        manifest_resp = requests.get(file_info["url"], timeout=30)
        manifest_resp.raise_for_status()
        manifest = manifest_resp.json()

        gcs_token = file_info["gcsCredentials"]["access_token"]
        gcs_headers = {"Authorization": f"Bearer {gcs_token}"}
        bucket = file_info["gcsPath"]["bucket"]

        frames: list[pd.DataFrame] = []
        for entry in manifest["entries"]:
            gs_url = entry["url"]
            obj_path = gs_url.replace(f"gs://{bucket}/", "", 1)
            https_url = f"https://storage.googleapis.com/{bucket}/{obj_path}"
            part_resp = requests.get(https_url, headers=gcs_headers, timeout=120)
            part_resp.raise_for_status()
            # Sliced CSVs have no header — supply column names from metadata
            frames.append(pd.read_csv(
                io.StringIO(part_resp.text),
                names=columns,
                header=None,
                dtype=str,
            ))
        return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=columns)

    # Handle single-file exports (AWS S3 or Azure ABS)
    url = (
        file_info.get("url")
        or (file_info.get("absPath") or {}).get("signedUrl")
    )
    if not url:
        raise KeyError(f"No download URL in file info: {list(file_info.keys())}")
    data_resp = requests.get(url, timeout=120)
    data_resp.raise_for_status()
    return pd.read_csv(io.StringIO(data_resp.text), dtype=str)


def _load_local_csv(name: str) -> Optional[pd.DataFrame]:
    """Try to load a CSV from backend/data/ directory (local dev fallback)."""
    data_dir = Path(__file__).parent.parent / "data"
    csv_path = data_dir / f"{name}.csv"
    if csv_path.exists():
        logger.info("Loading local CSV: %s", csv_path)
        return pd.read_csv(csv_path, dtype=str)
    return None


# ─── Public API ──────────────────────────────────────────────────────────────

def init_data() -> None:
    """Load all configured tables. Called once during FastAPI startup.

    Priority: Keboola Storage API → local CSV fallback.
    Tables are downloaded in parallel for speed.
    """
    global _DATA

    if not TABLE_IDS:
        logger.warning("No TABLE_IDS configured — backend has no data to load.")
        logger.warning("Add your Keboola table IDs to services/data_loader.py TABLE_IDS dict.")
        return

    kbc_token = os.getenv("KBC_TOKEN", "").strip()
    kbc_url = os.getenv("KBC_URL", "").strip()

    if kbc_token and kbc_url:
        logger.info("Loading %d tables from Keboola Storage API...", len(TABLE_IDS))
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                name: executor.submit(_download_keboola_table, tid, kbc_url, kbc_token)
                for name, tid in TABLE_IDS.items()
            }
            for name, future in futures.items():
                try:
                    _DATA[name] = future.result()
                    logger.info("  ✓ %s: %d rows", name, len(_DATA[name]))
                except Exception as exc:
                    logger.error("  ✗ %s: %s", name, exc)
                    raise
    else:
        logger.info("No KBC_TOKEN/KBC_URL — loading from local CSVs...")
        for name in TABLE_IDS:
            df = _load_local_csv(name)
            if df is not None:
                _DATA[name] = df
                logger.info("  ✓ %s: %d rows (local)", name, len(df))
            else:
                logger.warning("  ✗ %s: no local CSV at backend/data/%s.csv", name, name)

    logger.info("Data loading complete. %d tables loaded.", len(_DATA))


def get_data() -> dict[str, pd.DataFrame]:
    """FastAPI dependency — returns the loaded DataFrames.

    Usage in a router:
        @router.get("/my-endpoint")
        def my_endpoint(data: dict = Depends(get_data)):
            df = data["revenue"]
            return {"total": float(df["amount"].sum())}
    """
    return _DATA
