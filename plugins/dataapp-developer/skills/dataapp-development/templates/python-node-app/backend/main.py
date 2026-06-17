"""FastAPI backend for combined Python + Node app — serves /api/* endpoints."""
import os
from fastapi import FastAPI

app = FastAPI(title="Keboola Data App Backend")


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "kbc_url": bool(os.environ.get("KBC_URL")),
        "kbc_token": bool(os.environ.get("KBC_TOKEN")),
    }


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI backend"}
