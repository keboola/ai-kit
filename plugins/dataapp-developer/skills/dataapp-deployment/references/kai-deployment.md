# Kai AI Assistant Deployment

Complete infrastructure guide for deploying Keboola's Kai AI Assistant service into a Data App. The Data App backend acts as a proxy between the frontend and Keboola's hosted Kai service. Credentials never reach the browser.

For frontend component code and UX patterns, see the `dataapp-dev` skill's `references/kai-integration.md`.

---

## Architecture Overview

```text
Browser (React / Next.js / any frontend)
  ↓ WebSocket /api/chat/ws  (primary)
  ↓ POST /api/chat           (polling fallback)

Docker Container (Keboola Data App)
  ├── Nginx :8888  (public-facing, routes traffic)
  │     ├── /api/chat/ws  → FastAPI :8050  (WebSocket upgrade, 24h timeout)
  │     ├── /api/chat     → FastAPI :8050  (SSE polling, buffering disabled)
  │     ├── /api/*        → FastAPI :8050  (regular REST API)
  │     └── /*            → Next.js :3000  (frontend static + SSR)
  ├── FastAPI :8050  (backend — Kai proxy + business logic)
  │     ├── Discovers Kai service URL from Keboola Storage API
  │     ├── Authenticates with KBC_TOKEN / KAI_TOKEN
  │     ├── Opens SSE stream to Kai, forwards events to client
  │     └── Handles tool approval flow
  └── Next.js :3000  (frontend — chat UI, streaming client)
        ├── WebSocket client for zero-latency streaming
        ├── SSE event parser (text-delta, tool-call, tool-approval-request, etc.)
        └── Tool approval UI (approve / deny)
```

**Key facts:**
- Kai is a Keboola-hosted service (not a direct LLM call). The Data App proxies to it.
- The backend keeps KBC_TOKEN server-side. The frontend never sees credentials.
- Two streaming modes: WebSocket (preferred, zero-latency) and polling (fallback for edge proxies with ~20-30s timeout).
- Kai uses SSE (Server-Sent Events) format internally. The WebSocket mode wraps SSE events over WebSocket frames.

---

## Backend: Kai Proxy (FastAPI)

### Service Discovery

Discover the Kai service URL at startup by querying the Keboola Storage API:

```python
import os, httpx
from fastapi import HTTPException

KBC_URL = os.environ["KBC_URL"]       # e.g. https://connection.europe-west3.gcp.keboola.com/v2/storage
KBC_TOKEN = os.environ["KBC_TOKEN"]

_kai_url: str | None = None

async def discover_kai_url() -> str:
    global _kai_url
    if _kai_url:
        return _kai_url
    client = _get_http_client()
    # Strip /v2/storage suffix if present to get base URL
    base = KBC_URL.rstrip("/").removesuffix("/v2/storage")
    resp = await client.get(
        f"{base}/v2/storage",
        headers={"x-storageapi-token": KBC_TOKEN},
    )
    data = resp.json()
    svc = next((s for s in data.get("services", []) if s["id"] == "kai-assistant"), None)
    if not svc:
        raise HTTPException(500, "kai-assistant service not found — verify Kai is enabled for this project")
    _kai_url = svc["url"].rstrip("/")
    return _kai_url
```

Pre-warm the URL on app startup (lifespan) for instant first-chat performance. If pre-warming fails, retry on the first chat request.

### Authentication Headers

```python
def _kai_headers() -> dict:
    # Use KAI_TOKEN if set (dedicated Kai-enabled token), fall back to KBC_TOKEN
    token = os.environ.get("KAI_TOKEN") or KBC_TOKEN
    base_url = KBC_URL.rstrip("/").removesuffix("/v2/storage")
    return {
        "Content-Type": "application/json",
        "x-storageapi-token": token,
        "x-storageapi-url": f"{base_url}/v2/storage",
    }
```

KAI_TOKEN is optional. If not set, KBC_TOKEN is used. Some Keboola projects require a dedicated Kai-enabled token.

### WebSocket Proxy (Primary Streaming Mode)

```python
from fastapi import WebSocket

@app.websocket("/api/chat/ws")
async def kai_ws(websocket: WebSocket):
    await websocket.accept()
    body = await websocket.receive_json()   # Chat request from frontend

    kai_url = await discover_kai_url()
    client = _get_http_client()
    try:
        async with client.stream(
            "POST", f"{kai_url}/api/chat",
            headers=_kai_headers(), json=body,
        ) as resp:
            async for chunk in resp.aiter_bytes():
                text = chunk.decode("utf-8", errors="replace")
                # Forward raw SSE event lines to WebSocket
                for line in text.split("\n"):
                    stripped = line.strip()
                    if stripped:
                        await websocket.send_text(stripped)
        # Signal stream complete
        await websocket.send_json({"done": True})
    except Exception as e:
        await websocket.send_json({"error": str(e)})
    finally:
        await websocket.close()
```

**Critical:** Use `httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0))` — Kai streams can run for minutes during complex tool chains.

### Polling Fallback (for Edge Proxy Timeouts)

Keboola's edge proxy has a hard ~20-30s request timeout that kills long-lived SSE streams. The polling mode buffers events server-side:

```python
import asyncio, uuid

_streams: dict[str, dict] = {}   # stream_id → {events: list, done: bool, error: str|None}
_STREAM_TTL = 600                # seconds

@app.post("/api/chat")
async def chat_start(request: Request):
    body = await request.json()
    stream_id = str(uuid.uuid4())
    _streams[stream_id] = {"events": [], "done": False, "error": None}
    # Start background consumer
    asyncio.create_task(_kai_stream_consumer(stream_id, body))
    return {"stream_id": stream_id}

@app.get("/api/chat/{stream_id}/poll")
async def chat_poll(stream_id: str, cursor: int = 0):
    stream = _streams.get(stream_id)
    if not stream:
        raise HTTPException(404, "Stream not found")
    events = stream["events"][cursor:]
    return {
        "events": events,
        "cursor": cursor + len(events),
        "done": stream["done"],
        "error": stream["error"],
    }

async def _kai_stream_consumer(stream_id: str, payload: dict):
    """Background task: read Kai SSE stream, append events to buffer."""
    kai_url = await discover_kai_url()
    client = _get_http_client()
    stream = _streams[stream_id]
    try:
        async with client.stream(
            "POST", f"{kai_url}/api/chat",
            headers=_kai_headers(), json=payload,
        ) as resp:
            async for chunk in resp.aiter_bytes():
                text = chunk.decode("utf-8", errors="replace")
                for line in text.split("\n"):
                    stripped = line.strip()
                    if stripped:
                        stream["events"].append(stripped)
    except Exception as e:
        stream["error"] = str(e)
    finally:
        stream["done"] = True
        # Schedule cleanup after TTL
        await asyncio.sleep(_STREAM_TTL)
        _streams.pop(stream_id, None)
```

### Tool Approval Endpoint

```python
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
    # Return a new stream for the Kai continuation response
    stream_id = str(uuid.uuid4())
    _streams[stream_id] = {"events": [], "done": False, "error": None}
    asyncio.create_task(_kai_stream_consumer(stream_id, payload))
    return {"stream_id": stream_id}
```

### Persistent HTTP Client

Use a single `httpx.AsyncClient` created in FastAPI lifespan to avoid TCP+TLS handshake per request (saves 500-1500ms per chat):

```python
from contextlib import asynccontextmanager

_http_client: httpx.AsyncClient | None = None

@asynccontextmanager
async def lifespan(app):
    global _http_client
    _http_client = httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0))
    # Pre-warm Kai URL discovery
    try:
        await discover_kai_url()
    except Exception:
        pass  # Retry on first request
    yield
    await _http_client.aclose()

app = FastAPI(lifespan=lifespan)

def _get_http_client() -> httpx.AsyncClient:
    assert _http_client is not None, "App not started — httpx client not initialized"
    return _http_client
```

### Chat Request Payload Format

Messages sent to Kai follow this structure:

```json
{
  "id": "<chat_id (UUID, persists across a conversation)>",
  "message": {
    "id": "<message_id (UUID, unique per message)>",
    "role": "user",
    "parts": [{"type": "text", "text": "<user message with optional system context>"}]
  },
  "selectedChatModel": "chat-model",
  "selectedVisibilityType": "private"
}
```

---

## Nginx Configuration for Kai

Three separate location blocks handle Kai chat traffic. Order matters — place `/api/chat/ws` before `/api/chat` (Nginx matches most specific prefix first, but explicit ordering makes intent clear).

### Full Production Config

```nginx
server {
    listen 8888;
    server_name _;

    # Keboola health probe: POST to root must return 200
    location = / {
        if ($request_method = POST) { return 200; }
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 1. WebSocket proxy for Kai — zero-latency streaming
    location /api/chat/ws {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;   # 24 hours for persistent WS connections
    }

    # 2. Polling fallback + tool approval endpoints — SSE with buffering disabled
    location /api/chat {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection '';       # empty — HTTP/1.1 persistent
        proxy_buffering off;                  # CRITICAL for SSE streaming
        proxy_cache off;
        proxy_read_timeout 600s;              # 10 min for long polls
        gzip off;                             # do not compress streaming
        tcp_nodelay on;                       # low-latency TCP
        add_header X-Accel-Buffering no;      # disable upstream proxy buffering
    }

    # 3. Regular API routes (business logic, data endpoints)
    location /api/ {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend catch-all (Next.js with WebSocket support for HMR)
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

### Critical Details

- **`proxy_read_timeout 86400`** on WebSocket allows 24-hour persistent connections
- **`proxy_buffering off` + `proxy_cache off` + `gzip off`** on the polling endpoint — without these, Nginx buffers the entire SSE response and the client sees nothing until the stream ends
- **`add_header X-Accel-Buffering no`** prevents upstream proxy buffering
- **`Connection "upgrade"`** on WebSocket vs **`Connection ''`** on polling — do not mix these up
- The `location = /` exact match with POST health check must remain for Keboola's startup probe

---

## Frontend: WebSocket Streaming Client

### Protocol Negotiation

```typescript
const CHAT_API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8050' : ''

// In production: empty string → relative URL → Nginx handles routing
// Protocol: http → ws, https → wss
const wsBase = CHAT_API_BASE
  ? CHAT_API_BASE.replace(/^http/, 'ws')
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`

const ws = new WebSocket(`${wsBase}/api/chat/ws`)
ws.onopen = () => ws.send(JSON.stringify(chatPayload))
```

### SSE Event Types (Received from Kai via WebSocket)

Each WebSocket message is a raw SSE event string. Parse `data:` lines:

| Event Type | Payload | Action |
|---|---|---|
| `text-delta` | `{delta: "text chunk"}` | Append text to assistant message |
| `tool-input-start` | `{toolCallId, toolName}` | Show tool execution starting |
| `tool-input-available` | `{toolCallId, toolName, input: {...}}` | Tool input ready (has justification, query) |
| `tool-output-available` | `{toolCallId}` | Mark tool step as completed |
| `tool-call` | `{toolCallId, toolName, state}` | Tool state change |
| `tool-approval-request` | `{approvalId, toolCallId}` | Show approve/deny UI to user |

### Control Messages

| Message | Meaning |
|---|---|
| `{"done": true}` | Stream complete, close WebSocket |
| `{"error": "..."}` | Error occurred, display to user |
| `data: [DONE]` | SSE sentinel (also signals end) |

### Abort Handling

Use `AbortController`. On abort: close the WebSocket, reject the promise with `DOMException('Aborted', 'AbortError')`. Keep partial content in the UI — do not discard already-streamed text.

### Tool Approval Response (Sent Back via POST or WebSocket)

```json
{
  "id": "<chatId>",
  "message": {
    "id": "<new UUID>",
    "role": "user",
    "parts": [{
      "type": "tool-approval-response",
      "approvalId": "<from approval request>",
      "approved": true,
      "reason": "User denied"
    }]
  },
  "selectedChatModel": "chat-model",
  "selectedVisibilityType": "private"
}
```

The `reason` field is only included when `approved` is `false`.

### Tool Step Display

Map tool names to friendly labels for the UI:

```typescript
const friendlyNames: Record<string, string> = {
  search: 'Searching project items',
  get_tables: 'Getting table detail',
  get_table: 'Getting table detail',
  query_data: 'Querying data',
  get_buckets: 'Browsing storage',
  get_project_info: 'Loading project info',
}
```

Track steps via SSE events: `tool-input-start` or `tool-input-available` → add "running" step. `tool-output-available` → mark as "completed". Display description from `input.justification` field (truncated at 120 chars).

---

## System Context Injection

On the first message of each conversation, prepend rich context to speed up Kai responses (prevents table discovery tool calls):

```text
[Context: {App name}. Revenue: $X (±Y% YoY), GM: Z%, N groups. User: email (role).]

DATA SCHEMA — query these tables directly, do NOT search first:
- "bucket"."TABLE_NAME" — Description. Cols: COL1 (type), COL2 (type), ...
- (repeat for each table)

Links: [Name](/route/{id}?period=l12m)
Project: {keboola_connection_url}

IMPORTANT: Skip table search/discovery — query directly using the schema above.
```

Build this dynamically at runtime using env vars (KBC_URL, KBC_PROJECTID) and cached dashboard KPI data. Inject only on the first message; subsequent messages in the same conversation do not repeat the context.

---

## Environment Variables for Kai

| Secret Key (dataApp.secrets) | Env Var | Required | Purpose |
|---|---|---|---|
| `#KBC_TOKEN` | `KBC_TOKEN` | Yes | Storage API token for Kai discovery and auth |
| `#KBC_URL` | `KBC_URL` | Yes | Storage API URL (e.g., `https://connection.europe-west3.gcp.keboola.com/v2/storage`) |
| `#KAI_TOKEN` | `KAI_TOKEN` | No | Dedicated Kai-enabled token (falls back to KBC_TOKEN) |
| `#KBC_PROJECTID` | `KBC_PROJECTID` | No | Project ID for building Keboola UI links in Kai responses |

Ensure KBC_URL matches the correct Keboola stack. Common stacks:
- EU: `https://connection.europe-west3.gcp.keboola.com/v2/storage`
- US: `https://connection.us-east4.gcp.keboola.com/v2/storage`

---

## Supervisord for Multi-Server Kai App

When running both a Python backend and Node.js frontend, create separate Supervisord configs:

### keboola-config/supervisord/services/python.conf

```ini
[program:python-api]
command=uv run uvicorn main:app --host 127.0.0.1 --port 8050
directory=/app/backend
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

### keboola-config/supervisord/services/node.conf

```ini
[program:node-frontend]
command=node /app/frontend/.next/standalone/server.js
environment=PORT=3000,HOSTNAME=127.0.0.1
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

### Next.js Standalone Build

For Next.js, set `output: 'standalone'` in `next.config.ts`. Pre-build and commit the standalone bundle:

```bash
cd frontend
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
# Commit .next/standalone/ to git
```

Supervisord runs `server.js` directly — no `npm start` or build step at container startup.

### setup.sh for Multi-Server

```bash
#!/bin/bash
set -Eeuo pipefail
cd /app/backend && uv sync
# Next.js is pre-built — no npm install needed at runtime
```

If the frontend is NOT pre-built, install both in parallel:

```bash
#!/bin/bash
set -Eeuo pipefail
cd /app/backend && uv sync &
cd /app/frontend && npm install && npm run build &
wait
```

---

## Next.js Dev Proxy

In local development, Next.js handles API proxying (Nginx is not present):

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:8050/api/:path*' }]
  },
}
```

### Local OIDC Simulation

Keboola injects `X-Kbc-User-Email` via OIDC in production. Simulate this locally with Next.js middleware:

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

const LOCAL_OIDC_EMAIL = process.env.LOCAL_OIDC_EMAIL

export function middleware(request: NextRequest) {
  if (!LOCAL_OIDC_EMAIL) return NextResponse.next()
  const headers = new Headers(request.headers)
  headers.set('X-Kbc-User-Email', LOCAL_OIDC_EMAIL)
  return NextResponse.next({ request: { headers } })
}

export const config = { matcher: '/api/:path*' }
```

Set `LOCAL_OIDC_EMAIL` in `frontend/.env.local` (never commit this file).

---

## Kai-Specific Errors

| Error | Cause | Fix |
|---|---|---|
| `kai-assistant not found` on startup | Kai not enabled for the project, or KBC_TOKEN lacks Kai access | Verify Kai is enabled with Keboola support. Try a dedicated KAI_TOKEN. |
| WebSocket 502 on `/api/chat/ws` | Missing WebSocket upgrade headers in Nginx, or backend not running | Add `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` to the `/api/chat/ws` location block. |
| Chat stream arrives all at once | Nginx buffering enabled on the chat endpoint | Add `proxy_buffering off; proxy_cache off; gzip off; add_header X-Accel-Buffering no;` to the `/api/chat` location block. |
| Kai stream timeout after 20-30s | Keboola edge proxy kills long-lived HTTP connections | Use WebSocket mode (bypasses edge proxy). If WebSocket unavailable, use polling architecture with server-side event buffering. |
| Tool approval never resolves | Approval response sent to wrong endpoint, or chatId/approvalId mismatch | Ensure the approval response uses the same chatId from the conversation and the approvalId from the `tool-approval-request` event. |
| `wss://` fails in production, `ws://` works locally | Protocol mismatch — production uses HTTPS (wss://), dev uses HTTP (ws://) | Use dynamic protocol detection: `window.location.protocol === 'https:' ? 'wss:' : 'ws:'` |

---

## Kai Deployment Checklist

- [ ] KBC_TOKEN (or KAI_TOKEN) has Kai access enabled in Keboola
- [ ] KBC_URL matches the correct Keboola stack
- [ ] Kai service discovery succeeds (GET /v2/storage returns `kai-assistant` service)
- [ ] Nginx has separate location blocks for `/api/chat/ws` (WebSocket) and `/api/chat` (polling)
- [ ] WebSocket location has `proxy_read_timeout 86400` and upgrade headers
- [ ] Polling location has `proxy_buffering off`, `gzip off`, `tcp_nodelay on`
- [ ] Backend uses persistent `httpx.AsyncClient` (not created per-request)
- [ ] Backend pre-warms Kai URL discovery on startup (lifespan)
- [ ] Frontend uses `wss://` in production, `ws://` in dev (dynamic detection)
- [ ] System context includes data schema to skip table discovery
- [ ] Tool approval flow works end-to-end (request → UI → response → continuation)
- [ ] Supervisord has separate configs for Python backend and Node.js frontend
- [ ] Next.js built with `output: 'standalone'` and static assets copied
