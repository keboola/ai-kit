# Kai Core — Architecture, Proxy & Credentials

Patterns for embedding the Keboola AI Assistant (Kai) into data apps. Kai lets users ask natural-language questions about their Keboola project data.

---

## Architecture Overview

```
Browser ──POST──> Your Backend ──POST──> kai-assistant API
         <──SSE──              <──SSE──
```

Credentials (`x-storageapi-token`, `x-storageapi-url`) stay on the backend. The browser never sees them.

---

## Backend: Kai Proxy Routes (FastAPI)

**Prerequisite:** `httpx>=0.27.0` must be in your `backend/pyproject.toml` dependencies.

Add to your `backend/main.py`:

### Pre-warm Kai URL Discovery

Add a `lifespan` handler so the first user message doesn't wait for Kai URL discovery:

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    try:
        await _discover_kai_url()  # pre-warm so first message is instant
    except Exception:
        pass  # will retry on first request
    yield

app = FastAPI(lifespan=lifespan)
```

### Proxy Implementation

```python
from fastapi import Request
from fastapi.responses import StreamingResponse, Response
from typing import AsyncIterator
import httpx, json, os, uuid

# ─── Credentials ─────────────────────────────────────────────────────────────
# KAI_TOKEN: A dedicated token with Kai permissions. Falls back to KBC_TOKEN.
# The auto-injected KBC_TOKEN may NOT have Kai assistant permissions (→ 401).
# Create a dedicated token in Keboola and add it as a Data App secret.
KBC_URL = os.environ.get("KBC_URL", "").strip().rstrip("/")
KBC_TOKEN = os.environ.get("KAI_TOKEN", "").strip() or os.environ.get("KBC_TOKEN", "").strip()

# ─── Kai service discovery ───────────────────────────────────────────────────
_kai_url: str | None = None

async def _discover_kai_url() -> str:
    global _kai_url
    if _kai_url:
        return _kai_url
    base = KBC_URL.split("/v2/")[0] if "/v2/" in KBC_URL else KBC_URL
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{base}/v2/storage",
            headers={"x-storageapi-token": KBC_TOKEN},
        )
        data = resp.json()
    svc = next((s for s in data.get("services", []) if s["id"] == "kai-assistant"), None)
    if not svc:
        raise HTTPException(500, "kai-assistant service not found")
    _kai_url = svc["url"].rstrip("/")
    return _kai_url

# ─── SSE proxy ───────────────────────────────────────────────────────────────
# IMPORTANT: Do NOT use `async with client.stream()` inside an async generator.
# In Keboola's production environment, the async generator gets garbage-collected
# before the httpx stream delivers data, resulting in content-length: 0 responses.
# Instead, create the client in the endpoint handler and return a StreamingResponse
# with a simple generator + finally cleanup.

async def _stream_kai(payload: dict):
    """Proxy a request to Kai and return a StreamingResponse."""
    kai_url = await _discover_kai_url()
    base = KBC_URL.split("/v2/")[0] if "/v2/" in KBC_URL else KBC_URL

    client = httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0))
    try:
        req = client.build_request(
            "POST",
            f"{kai_url}/api/chat",
            headers={
                "Content-Type": "application/json",
                "x-storageapi-token": KBC_TOKEN,
                "x-storageapi-url": base,
            },
            json=payload,
        )
        resp = await client.send(req, stream=True)

        if resp.status_code != 200:
            error_body = await resp.aread()
            await resp.aclose()
            await client.aclose()
            return Response(content=error_body, status_code=resp.status_code)

        async def stream_and_cleanup() -> AsyncIterator[bytes]:
            try:
                async for chunk in resp.aiter_bytes():
                    yield chunk
            finally:
                await resp.aclose()
                await client.aclose()

        return StreamingResponse(
            stream_and_cleanup(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no"},
        )
    except Exception:
        await client.aclose()
        raise

@app.post("/api/chat")
async def kai_chat(request: Request):
    body = await request.json()
    return await _stream_kai(body)

@app.post("/api/chat/{chat_id}/{action}/{approval_id}")
async def tool_approval(chat_id: str, action: str, approval_id: str):
    approved = action == "approve"
    payload = {
        "id": chat_id,
        "message": {
            "id": str(uuid.uuid4()),
            "role": "user",
            "parts": [{
                "type": "tool-approval-response",
                "approvalId": approval_id,
                "approved": approved,
                **({"reason": "User denied"} if not approved else {}),
            }],
        },
        "selectedChatModel": "chat-model",
        "selectedVisibilityType": "private",
    }
    return await _stream_kai(payload)
```

---

## Nginx: Health Probe + SSE Support

**CRITICAL:** The Keboola health probe (`POST /`) must be handled in `location = /` (exact root match only), NOT at the server level. A server-level `if ($request_method = POST) { return 200; }` intercepts ALL POST requests including `/api/chat`, causing Kai to return empty 200 responses.

In `keboola-config/nginx/sites/default.conf`:

```nginx
server {
    listen 8888;
    server_name _;

    # Health probe: POST to exact root only
    location = / {
        if ($request_method = POST) { return 200; }
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Kai SSE — MUST come BEFORE /api/ (more specific prefix first)
    location /api/chat {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
    }

    # Other API routes
    location /api/ {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Next.js frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Location ordering matters:** `/api/chat` must come before `/api/` — Nginx matches the most specific prefix first.

---

## SSE Event Reference

| Event Type | Key Fields | Action |
|------------|-----------|--------|
| `text-delta` | `delta` | Append to accumulated text |
| `tool-input-start` | `toolCallId`, `toolName` | Show thinking indicator: "Searching tables..." with tool name |
| `tool-input-available` | `toolCallId`, `toolName`, `input` | Update indicator: "Running SQL query..." with input detail |
| `tool-output-available` | `toolCallId` | Tool complete — clear thinking indicator |
| `tool-approval-request` | `approvalId`, `toolCallId` | Show approve/deny UI |
| `finish` | `finishReason` | Stream complete |
| `error` | `message` | Show error |

**Gotcha:** `tool-output-available` often has `toolName: null`. Cache the tool name from `tool-input-start` using `toolCallId` as key.

**Tool name → status label mapping (examples):**

| Tool Name | `tool-input-start` Label | `tool-input-available` Label |
|-----------|-------------------------|------------------------------|
| `get_tables` | "Searching tables..." | "Found tables" |
| `query_data` | "Preparing query..." | "Running SQL query..." |
| `search` | "Searching project..." | "Analyzing results..." |
| (default) | "Working..." | "Processing..." |

---

## Credentials

Both frameworks use the same env vars:
- `STORAGE_API_TOKEN` / `KBC_TOKEN` — Storage API token
- `STORAGE_API_URL` / `KBC_URL` — Keboola connection URL
- `KAI_TOKEN` (optional but recommended) — Dedicated token with Kai permissions

### KAI_TOKEN — Dedicated Kai Token

**IMPORTANT**: The auto-injected `KBC_TOKEN` in Keboola Data Apps is a Storage API token that may NOT have Kai assistant permissions. Sending it to the Kai service returns `401 Unauthorized`.

**Fix:** Create a dedicated token with Kai permissions:
1. In Keboola UI, go to Settings > API Tokens
2. Create a new token with Kai assistant permissions enabled
3. Add it as a Data App secret mapped to `KAI_TOKEN`
4. Backend code checks `KAI_TOKEN` first, falls back to `KBC_TOKEN`:

```python
KBC_TOKEN = os.environ.get("KAI_TOKEN", "").strip() or os.environ.get("KBC_TOKEN", "").strip()
```

### Keboola Stack URLs

`STORAGE_API_URL` / `KBC_URL` must match the user's Keboola stack:

| Stack | URL |
|-------|-----|
| AWS US | `https://connection.keboola.com` |
| AWS EU | `https://connection.eu-central-1.keboola.com` |
| Azure EU | `https://connection.north-europe.azure.keboola.com` |
| GCP EU Frankfurt | `https://connection.europe-west3.gcp.keboola.com` |
| GCP US Virginia | `https://connection.us-east4.gcp.keboola.com` |

This URL is used for:
- Kai service discovery (`GET {url}/v2/storage` → find `kai-assistant` service)
- Backend data proxy (workspace query API)
- `KaiClient.from_storage_api(storage_api_url=...)` in Streamlit

In Keboola production, these come from Data App secrets mapped to env vars. For local development, set them in `.env.local` or `.streamlit/secrets.toml`.

---

## Adding Kai Checklist

When adding Kai to an existing app, ensure:
- [ ] `httpx>=0.27.0` in `backend/pyproject.toml`
- [ ] `KAI_TOKEN` secret added to Data App (or confirmed `KBC_TOKEN` has Kai permissions)
- [ ] `KBC_URL` secret added to Data App
- [ ] Nginx `location = /` for health probe (not server-level `if`)
- [ ] Nginx `/api/chat` location BEFORE `/api/` with `proxy_buffering off`
- [ ] Backend uses `_stream_kai()` pattern (not async generator with nested context managers)
- [ ] KaiChatProvider wraps the app (see `references/kai-nextjs.md`)
- [ ] Floating widget renders on all pages except /assistant
- [ ] Thinking indicator shows during tool calls
- [ ] Abort button works during streaming
- [ ] Charts: "View as chart" appears on numeric tables (see `references/kai-charts.md`)
- [ ] Conversation persistence works across page navigation
- [ ] Context-aware suggestions change per page
