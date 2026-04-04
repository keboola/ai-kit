# AI Assistant Integration (KAI)

The **full implementation guide** (frontend + architecture) is fetched at runtime by the frontend agent from:

```
https://raw.githubusercontent.com/keboola/kai-client/main/KAI_IMPLEMENTATION_GUIDE.md
```

The custom dashboard frontend (pinning KAI chat charts to My Dashboards) is documented in `my-dashboards.md` — see the "KAI Chat Integration" section for `KaiTableChart` and the `markdownComponents` pattern.

---

## Architecture: Polling Proxy (NOT SSE)

Keboola's edge proxy enforces a ~20-30s request timeout that kills long-lived SSE streams. KAI uses a **polling proxy** instead:

1. Frontend sends `POST /api/chat` → backend returns `{ stream_id }`
2. Backend opens long-lived SSE to KAI service, buffers events in memory
3. Frontend polls `GET /api/chat/{stream_id}/poll?cursor=N` every 500-1500ms

---

## Required Secrets

| Variable | Required | Description |
|----------|----------|-------------|
| `KBC_TOKEN` | Yes | Keboola Storage API token |
| `KBC_URL` | Yes | Keboola Storage API URL |
| `KAI_TOKEN` | Optional | Dedicated KAI-enabled token (falls back to `KBC_TOKEN`) |

Configure in Keboola UI → Data App → Secrets.

---

## Nginx

The `/api/chat` endpoint needs special Nginx settings (`proxy_buffering off`, `tcp_nodelay on`, etc.). See `deployment.md` for the complete Nginx location block — it must appear **before** the generic `/api/` block.

---

## Critical Rules — DO NOT DEVIATE

1. **KAI endpoint URL** is `{kai_url}/api/chat` — NOT `/chat`, NOT `{kai_url}/chat`
2. **Base URL extraction**: always `kbc_url.split("/v2/")[0]` before calling `/v2/storage` — KBC_URL often already contains `/v2/storage`
3. **SSE parsing**: read raw bytes via `aiter_bytes()`, split on `\n\n`, append the **full event string** including `data:` prefix lines — the frontend needs `data:` to parse events
4. **Use `asyncio.create_task()`** for stream consumers — NOT `BackgroundTasks.add_task()`
5. **Tool approval** must construct a `tool-approval-response` message, start a **new KAI stream**, and return `{stream_id}` for polling — NOT a raw proxy

---

## Backend KAI Code (copy exactly)

Add all of the following to `backend/main.py`. Adapt only the imports and app variable name to match the existing file.

### Module-level imports (add to existing)

```python
import asyncio
import uuid
import httpx
```

### Module-level state

```python
_http_client: httpx.AsyncClient | None = None
_kai_url: str | None = None
_streams: dict[str, dict] = {}
```

### Lifespan additions

Add inside the existing `lifespan()` async context manager, **before** `yield`:

```python
global _http_client
# Persistent connection pool — avoids TCP+TLS handshake per KAI request
_http_client = httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0))
# Pre-warm KAI service URL discovery so first chat is instant
try:
    await _discover_kai_url()
except Exception as e:
    logger.warning("KAI pre-warm failed (will retry on first request): %s", e)
```

Add **after** `yield`:

```python
await _http_client.aclose()
_http_client = None
```

### Service discovery

```python
def _kbc_base_url() -> str:
    """Extract base connection URL from KBC_URL, stripping /v2/storage if present."""
    kbc_url = os.getenv("KBC_URL", "").strip().rstrip("/")
    return kbc_url.split("/v2/")[0] if "/v2/" in kbc_url else kbc_url


async def _discover_kai_url() -> str:
    """Discover KAI assistant URL from Keboola Storage API services list. Caches result."""
    global _kai_url
    if _kai_url:
        return _kai_url
    kbc_token = os.getenv("KBC_TOKEN", "").strip()
    base = _kbc_base_url()
    if not kbc_token or not base:
        raise HTTPException(500, "KBC_TOKEN / KBC_URL not configured")
    assert _http_client is not None
    resp = await _http_client.get(
        f"{base}/v2/storage",
        headers={"x-storageapi-token": kbc_token},
        timeout=30.0,
    )
    data = resp.json()
    services = data.get("services", [])
    svc = next((s for s in services if s["id"] == "kai-assistant"), None)
    if not svc:
        service_ids = [s.get("id") for s in services]
        raise HTTPException(500, f"kai-assistant not found. Available: {service_ids}")
    _kai_url = svc["url"].rstrip("/")
    logger.info("Discovered KAI URL: %s", _kai_url)
    return _kai_url


def _kai_headers() -> tuple[str, str, dict]:
    """Return (base_url, token, headers) for KAI requests."""
    kai_token = os.getenv("KAI_TOKEN", "").strip() or os.getenv("KBC_TOKEN", "").strip()
    base = _kbc_base_url()
    return base, kai_token, {
        "Content-Type": "application/json",
        "x-storageapi-token": kai_token,
        "x-storageapi-url": base,
    }
```

### Stream buffer + consumer

```python
async def _kai_stream_consumer(stream_id: str, resp: httpx.Response, client: httpx.AsyncClient) -> None:
    """Background task: read KAI SSE stream and buffer raw event strings."""
    buf = _streams[stream_id]
    try:
        raw = b""
        async for chunk in resp.aiter_bytes():
            raw += chunk
            while b"\n\n" in raw:
                event_bytes, raw = raw.split(b"\n\n", 1)
                event_str = event_bytes.decode("utf-8", errors="replace").strip()
                if event_str:
                    buf["events"].append(event_str)
        # Handle any trailing data
        if raw.strip():
            buffer["events"].append(raw.decode("utf-8", errors="replace").strip())
    except Exception as exc:
        logger.warning("KAI stream %s error: %s", stream_id, exc)
        buf["error"] = str(exc)
    finally:
        buf["done"] = True
        await resp.aclose()
        await client.aclose()


async def _start_kai_stream(kai_url: str, headers: dict, body: dict) -> str:
    """Start a background KAI stream and return its stream_id."""
    stream_id = str(uuid.uuid4())
    client = httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0))
    req = client.build_request("POST", f"{kai_url}/api/chat", headers=headers, json=body)
    resp = await client.send(req, stream=True)

    if resp.status_code != 200:
        error_body = await resp.aread()
        await resp.aclose()
        await client.aclose()
        _streams[stream_id] = {"events": [], "done": True, "error": f"KAI returned {resp.status_code}: {error_body.decode()[:200]}"}
        return stream_id

    _streams[stream_id] = {"events": [], "done": False, "error": None}
    asyncio.create_task(_kai_stream_consumer(stream_id, resp, client))
    return stream_id
```

### Endpoints

```python
@app.post("/api/chat")
async def kai_chat(request: Request):
    kai_url = await _discover_kai_url()
    _base, _token, headers = _kai_headers()
    body = await request.json()
    stream_id = await _start_kai_stream(kai_url, headers, body)
    return {"stream_id": stream_id}


@app.get("/api/chat/{stream_id}/poll")
async def kai_poll(stream_id: str, cursor: int = 0):
    buf = _streams.get(stream_id)
    if not buf:
        raise HTTPException(404, "Stream not found or expired")
    events = buf["events"][cursor:]
    new_cursor = cursor + len(events)
    done = buf["done"]
    error = buf["error"]
    # Clean up completed streams after all events are consumed
    if done and new_cursor >= len(buf["events"]):
        _streams.pop(stream_id, None)
    return {
        "events": events,
        "cursor": new_cursor,
        "done": done,
        "error": error,
    }


@app.post("/api/chat/{chat_id}/{action}/{approval_id}")
async def kai_tool_approval(chat_id: str, action: str, approval_id: str):
    kai_url = await _discover_kai_url()
    _base, _token, headers = _kai_headers()
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
    stream_id = await _start_kai_stream(kai_url, headers, payload)
    return {"stream_id": stream_id}
```

### Frontend KAI Components

The complete set of KAI frontend components (20+ files) is available in the kai-client
repository under `kai-nextjs/`. The frontend agent should:
1. Fetch the KAI_IMPLEMENTATION_GUIDE.md from kai-client for architecture understanding
2. Copy component files from `kai-nextjs/components/kai/`, `kai-nextjs/lib/`, and
   `kai-nextjs/custom-dashboard/` into the app
3. Only modify lines marked `// CUSTOMIZE:` — see Section 9 of the guide for details
