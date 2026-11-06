# Kai Integration

**Use this when:** you want to embed a natural-language assistant inside the app, grounded in the project's data.

## Contents
- When to add Kai
- Turn Kai on for the app (`runtime.kai.enabled`)
- Token and headers
- What Kai can reach in the app
- Library
- Service discovery
- Pattern A — Streamlit embed
- Pattern B — JS data-app embed
- Tool approval
- Pre-built skills
- DIY alternative — Anthropic SDK directly

## When to add Kai

Optional integration. Use Kai when:
- The user benefits from natural-language Q&A over project data ("what was our revenue YTD?", "show me top customers by churn risk").
- The dashboard doesn't already answer the question by sight (Kai shines when the answer requires composing multiple metrics or freeform exploration).

Skip Kai when:
- The app is purely a static dashboard — users already know what they're looking at.
- The data domain is too narrow for natural language to add value.
- The app is internal and the team prefers raw SQL access.

## Turn Kai on for the app (`runtime.kai.enabled`)

Kai in an app is a platform feature. In the Keboola UI it is the **Kai in the app** switch in the Data App's settings: it shows only in a project with the `data-apps-kai` feature and can be turned on only while **Storage access** is on. The switch writes this to the app's configuration, which is what to set when you configure the app through the API or MCP:

```json
{
  "runtime": {
    "workspace": { "enabled": true },
    "kai": { "enabled": true }
  }
}
```

Requirements — the deploy is refused without them, except the last one, which Kai itself checks:
- The project has the `data-apps-kai` feature.
- The app has a workspace: `runtime.workspace.enabled: true`, which needs the `data-apps-storage-workspace` feature. For python-js apps that is `storage_access=True` — see [storage-access.md](storage-access.md) §Enabling Storage access on a deployed app; on a project without the feature it falls back to the deprecated `WORKSPACE_ID` secret, and Kai cannot be turned on.
- No row- or column-level security: `runtime.kai` cannot be combined with `runtime.workspace.rlsPolicies` or `runtime.workspace.clsPolicies`.
- A project member deploys it, with a role that can create Storage API tokens.
- The project has Kai (`agent-chat` feature); otherwise every Kai request is a 403.

Turning Kai on does not change a running app: **deploy the app again** after turning it on. On each new deployment by a user, the platform:
1. Creates a Storage API token for Kai, carrying the deploying user. It expires after 90 days, so an app not redeployed for that long loses Kai.
2. Puts it into the app as the env var `KAI_STORAGE_API_TOKEN`. Do not add a secret of that name yourself.
3. Sets `KAI_ENABLED=1`.

Apps without `runtime.kai` are unchanged. Like Storage access, the setting lives in the app's Storage configuration, so a draft and its prod app each need it.

## Token and headers

Every Kai request sends three headers:

| Header | Value |
|---|---|
| `x-storageapi-token` | the Kai token — see the rules below |
| `x-storageapi-url` | `KBC_URL` |
| `x-workspace-id` | `WORKSPACE_ID` — the app's own workspace |

Pick the token in this order:
1. `KAI_STORAGE_API_TOKEN` is set → use it.
2. `KAI_ENABLED` set (the platform sets `1`; any value except `""`, `0`, `false`, `no` and `off` counts) but no `KAI_STORAGE_API_TOKEN` → Kai is unavailable in this run (the app was started without a user). Say so in the UI and keep the rest of the app working; do **not** fall back to another token. A new deployment by a user restores it.
3. `KAI_ENABLED` unset or off (an app without `runtime.kai`, or local dev) → `STORAGE_API_TOKEN`, a secret holding a project member's personal token. Kai then acts with that member's full access.

**Never use `KBC_TOKEN` for Kai.** It is the app's own token with no Keboola user behind it, and Kai refuses it with 403 `Storage token has no associated Keboola user`. The reverse holds too: use the Kai token for Kai only — the app's own queries keep `KBC_TOKEN` (see [storage-access.md](storage-access.md)).

**Send `x-workspace-id` on every Kai request** (omit it only outside a Data App, e.g. local dev without a workspace). With the Kai token it is required: a missing header, or a workspace that is not this app's, is a 403. Pass `WORKSPACE_ID` unchanged: it is the numeric workspace ID. Never strip a `WORKSPACE_` prefix — the number in a `WORKSPACE_<n>` schema name is a different number and can pin the wrong workspace. Kai rejects a non-numeric value with a 400; fix the value at its source (see [troubleshooting.md](troubleshooting.md)).

In Python, kai-client's `resolve_storage_api_token()` applies this order and raises `KaiConfigurationError` in case 2:

```python
import os
from kai_client import resolve_storage_api_token

def kai_credentials(environ=os.environ) -> dict[str, str | None]:
    """Keyword arguments for KaiClient.from_storage_api; raises when Kai is off in this run."""
    token = resolve_storage_api_token(environ=environ)  # KaiConfigurationError: Kai is off in this run
    url = environ.get("KBC_URL")
    if not (token and url):
        raise RuntimeError("Kai needs KBC_URL and KAI_STORAGE_API_TOKEN or STORAGE_API_TOKEN.")
    return {"storage_api_token": token, "storage_api_url": url, "workspace_id": environ.get("WORKSPACE_ID") or None}
```

```javascript
function isKaiEnabled() {
  const value = (process.env.KAI_ENABLED || '').trim().toLowerCase();
  return !['', '0', 'false', 'no', 'off'].includes(value);
}

function kaiCredentials() {
  let token = process.env.KAI_STORAGE_API_TOKEN;
  if (!token) {
    if (isKaiEnabled()) throw new Error('Kai is not available in this run of the app.');
    token = process.env.STORAGE_API_TOKEN;
  }
  const url = process.env.KBC_URL;
  if (!token || !url) throw new Error('Kai needs KBC_URL and KAI_STORAGE_API_TOKEN or STORAGE_API_TOKEN.');
  return { token, url, workspaceId: process.env.WORKSPACE_ID };
}

function kaiHeaders({ token, url, workspaceId }) {
  return {
    'x-storageapi-token': token,
    'x-storageapi-url': url,
    ...(workspaceId && { 'x-workspace-id': workspaceId }),
  };
}
```

Keep the token on the app's backend; it never reaches the browser.

## What Kai can reach in the app

The Kai token is read-only in both modes: it has `read` on buckets only, with no right to manage buckets and no access to components. Kai cannot create or change buckets, tables, configurations or jobs with it. The grants are fixed when the app is deployed: a bucket created later gets no grant until the app is deployed again.

What Kai reaches depends on the app's input mapping:

- **Direct-grant input mapping** (`storage.input.read_only_storage_access: false`) — Kai runs in strict mode:
  - It sees only the buckets of the tables named by `source` in the input mapping and `destination` in the output mapping that exist at deploy time, and queries only the tables mapped into the workspace. A table mapped with `source_search` and file input never get a grant. An app with no mapping gives Kai no data at all.
  - It gets only read tools: `query_data` (read-only SQL), `get_buckets`, `get_tables`, `get_project_info` and `docs_query`.
- **Read-only Storage access** (the default) — Kai's token reads every bucket that exists in the app's branch at deploy time, and its queries run in the app's workspace, which reads the whole project's Storage (also a bucket created after the deploy, which Kai's token does not list). Kai is still offered its write tools, which ask for approval (see §Tool approval), but Storage refuses them. Use strict mode to keep Kai to the app's own data and to the read tools.

In both cases Kai works as the deploying user, in a separate identity per app. Its chats are kept apart from that user's own Kai chats and do not show in the Keboola UI, but **every visitor of the app shares that identity**:
- Keep each visitor's chat id in their own session, and do not offer a chat-history list — it would show every visitor's conversations.
- Anyone who knows a chat id can open that chat.
- Kai's memory is shared by all visitors of the app.

## Library

`kai-client` — Python async client with SSE streaming, session management, tool-approval flow, and a `kai` CLI.

It needs **kai-client 0.14.0 or later**, which this reference describes:
- 0.13.0 targets `kai-agent` by default and accepts `workspace_id`. Older releases talk to the legacy `kai-assistant` backend and fail with `TypeError` on `workspace_id`.
- 0.14.0 adds `resolve_storage_api_token()` and `KaiConfigurationError`, reads kai-agent's error text, and asks for `tool-approval-request` events (see §Tool approval).

If 0.14.0 is not on PyPI yet, install its tag from GitHub: `uv add "kai-client @ git+https://github.com/keboola/kai-client@v0.14.0"`.

JS apps don't need a separate JS package — they proxy HTTP requests to the same `/api/chat` endpoint Kai exposes and stream the SSE response straight back to the browser.

## Service discovery

The Kai service URL is stack-specific. Discover the `kai-agent` service from the Storage API services list rather than hard-coding it. Do not use `kai-assistant`: it is the legacy backend and does not apply the app's scoping.

**Python:**
```python
from kai_client import KaiClient

async def make_client() -> KaiClient:
    return await KaiClient.from_storage_api(**kai_credentials())  # discovers kai-agent
```

**JS:**
```javascript
async function discoverKaiUrl(storageApiUrl, storageApiToken) {
  const res = await fetch(`${storageApiUrl.replace(/\/$/, '')}/v2/storage`, {
    headers: { 'x-storageapi-token': storageApiToken },
  });
  if (!res.ok) throw new Error(`Storage API discovery failed: ${res.status}`);
  const data = await res.json();
  const kai = (data.services || []).find((s) => s.id === 'kai-agent');
  if (!kai?.url) throw new Error('kai-agent service not found');
  return kai.url.replace(/\/$/, '');
}
```

Cache the discovered URL after the first lookup — it doesn't change for the lifetime of the app.

## Pattern A — Streamlit embed

```python
import asyncio
import os
import streamlit as st
from kai_client import KaiClient, KaiConfigurationError

def app_env() -> dict:
    """Env vars in Keboola; locally, top-level values from `.streamlit/secrets.toml` fill the gaps."""
    try:
        secrets = {k: str(v) for k, v in st.secrets.items() if isinstance(v, (str, int, float, bool))}
    except FileNotFoundError:  # no secrets.toml
        secrets = {}
    return {**secrets, **os.environ}

try:
    KAI_CREDENTIALS = kai_credentials(app_env())
except (KaiConfigurationError, RuntimeError):
    KAI_CREDENTIALS = None  # Kai is off in this run; the rest of the app keeps working

# Session state — one chat per Streamlit session
if "messages" not in st.session_state:
    st.session_state.messages = []
if "chat_id" not in st.session_state:
    st.session_state.chat_id = KaiClient.new_chat_id()

async def stream_response(chat_id, prompt):
    client = await KaiClient.from_storage_api(**KAI_CREDENTIALS)
    async with client:
        async for event in client.send_message(chat_id, prompt):
            if event.type == "text":
                yield event.text
            elif event.type == "tool-call" and event.state == "started":
                yield f"\n[Calling tool: {event.tool_name}]\n"
            elif event.type == "tool-approval-request":
                yield "\n[Kai is waiting for an approval this app cannot give.]\n"
            elif event.type == "error":
                yield f"\n[Kai could not finish this answer: {event.message}]\n"

def iterate_sync(agen):
    """Bridge an async generator to the sync iterator `st.write_stream` expects."""
    loop = asyncio.new_event_loop()
    try:
        while True:
            try:
                yield loop.run_until_complete(agen.__anext__())
            except StopAsyncIteration:
                return
    finally:
        loop.close()
```

Event types to handle:
- `text` — stream chunk; append to the active assistant message.
- `tool-call` — informational; one event per state (`started`, `input-available`, `output-available`) of the same `tool_call_id`, so show the tool name once.
- `tool-approval-request` — a tool waits for a decision and the stream stays open until it gets one (see §Tool approval for timeouts). Streamlit cannot ask in the middle of a streamed answer: use strict mode, where Kai has no write tools.
- `error` — the turn is over; `event.message` holds kai-agent's `errorText` (kai-client 0.14.0 and later; older releases give `"Unknown error"`).
- `finish` — also emitted after each step of a multi-step answer, so do not stop on it: the loop ends when Kai closes the stream.

Streamlit-specific gotchas:

- Streamlit reruns the whole script on every interaction. Persist chat history and the `chat_id` in `st.session_state` so the conversation survives reruns.
- The async client must not leak its event loop across reruns. Run each answer on its own loop (as `iterate_sync` does), or use `nest_asyncio` if you need to share a loop with other async code in the same script.
- Streaming output: use `st.write_stream(...)` (Streamlit >=1.31) to render text chunks as they arrive. It takes a sync iterator, hence `iterate_sync`.
- Render the chat with `st.chat_message("user" | "assistant")` and capture input with `st.chat_input(...)`. Append each completed message to `st.session_state.messages` so the history re-renders on subsequent runs.
- When Kai is unavailable, `kai_credentials` raises (`KaiConfigurationError` or `RuntimeError`): catch it once at the top of the script and show `st.info(...)` instead of the chat input.

Minimal render loop sketch:

```python
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

if KAI_CREDENTIALS is None:
    st.info("Kai is not available in this run of the app.")
elif prompt := st.chat_input("Ask about your project data"):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)
    with st.chat_message("assistant"):
        full = st.write_stream(
            iterate_sync(stream_response(st.session_state.chat_id, prompt))
        )
    st.session_state.messages.append({"role": "assistant", "content": full})
```

## Pattern B — JS data-app embed

Express backend proxies POST requests to Kai and streams the SSE response back to the browser unchanged. The backend adds the headers; the browser sends only the chat id and the text.

```javascript
import express from 'express';
const app = express();
app.use(express.json());

let kaiBaseUrl = null;
async function getKaiUrl(creds) {
  if (kaiBaseUrl) return kaiBaseUrl;
  kaiBaseUrl = await discoverKaiUrl(creds.url, creds.token);
  return kaiBaseUrl;
}

app.post('/api/chat', async (req, res) => {
  let creds;
  try {
    creds = kaiCredentials();
  } catch (err) {
    return res.status(503).json({ error: err.message }); // Kai is off; the rest of the app runs
  }
  try {
    const { chatId, text } = req.body;
    const upstream = await fetch(`${await getKaiUrl(creds)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...kaiHeaders(creds) },
      body: JSON.stringify({
        id: chatId, // UUID, one per conversation
        message: { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] },
        selectedVisibilityType: 'private',
        supportsApprovalRequestedEvent: true,
      }),
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: await upstream.text() });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (err) {
    if (res.headersSent) return res.end();
    res.status(502).json({ error: String(err) });
  }
});

// Tool approval: a plain JSON call. The chat stream from /api/chat stays open and
// continues with the tool output once Kai gets the decision (see §Tool approval).
app.post('/api/chat/:chatId/approval', async (req, res) => {
  let creds;
  try {
    creds = kaiCredentials();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }
  const { toolUseId, approved, reason } = req.body;
  const chatId = encodeURIComponent(req.params.chatId);
  const upstream = await fetch(`${await getKaiUrl(creds)}/api/chat/${chatId}/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...kaiHeaders(creds) },
    body: JSON.stringify({ toolUseId, approved, ...(reason && { reason }) }),
  });
  res.status(upstream.status).json(await upstream.json().catch(() => ({})));
});
```

The frontend reads the SSE stream with `fetch` and a manual reader (`EventSource` supports only GET). Kai's frames are `data: <json>` lines with the event type inside the JSON, ending with `data: [DONE]`:

```javascript
async function sendMessage(chatId, text, onEvent) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, text }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by a blank line; each frame is "data: <json>\n"
    const frames = buffer.split('\n\n');
    buffer = frames.pop();
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data: '));
      if (!line || line === 'data: [DONE]') continue;
      // e.g. { type: 'text-delta', delta }, { type: 'error', errorText }
      onEvent(JSON.parse(line.slice(6)));
    }
  }
}
```

**Important:** disable nginx buffering for `/api/chat` in `keboola-config/nginx/sites/default.conf` or the response arrives all at once:

```nginx
location /api/chat {
    proxy_pass http://127.0.0.1:3000;
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Host $host;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
}
```

## Tool approval

Most tools run without asking. A tool that changes something, or an interactive question Kai asks the user, waits for a decision, and on `kai-agent` the chat stream **stays open** meanwhile:

1. The stream emits `{ type: 'tool-approval-request', toolCallId, approvalId }` (JS: send `supportsApprovalRequestedEvent: true` in the chat request, as above).
2. Show the user what Kai wants to do and let them decide. Never approve automatically.
3. The backend POSTs the decision to `{kai}/api/chat/{chatId}/approval` with the same headers and `{ "toolUseId": "<toolCallId>", "approved": true }` (add `"reason"` when denying).
4. The original stream continues with the tool's output.

Responses to the POST:
- **404** — the approval is not registered yet; retry for a few seconds. Answer only a tool announced by `tool-approval-request`: for any other tool the 404 does not go away.
- **409** — the decision can no longer apply (already resolved, timed out, chat stopped, Kai restarted); do not retry.
- A write left undecided is denied after 5 minutes; an interactive question waits indefinitely.

Python: from 0.14.0, kai-client's `send_message()` sends `supportsApprovalRequestedEvent: true`, so a waiting tool is announced by an event with `event.type == "tool-approval-request"`. Answer that event with `client.submit_approval(chat_id=..., tool_use_id=event.tool_call_id, approved=...)`, not every `tool-call` with `state == "input-available"`: every tool passes through that state, and answering one that does not wait ends in a 404. Streamlit cannot wait for a click in the middle of a streamed answer, so a Streamlit app should use strict mode, where Kai has no write tools.

## Pre-built skills

This reference covers awareness + the minimum embed pattern. For production-quality integration (full chat UI, history, voting, tool-approval UX, SSE reconnection), install the `kai-client` plugin's dedicated `kai-streamlit` / `kai-js` skills.

## DIY alternative — Anthropic SDK directly

When you want full control — custom tool catalog tied to app-specific data, no dependency on Kai's lifecycle — call the Anthropic API directly.

An alternative DIY pattern: a serverless function (e.g. Vercel) that calls the Anthropic SDK with tools scoped to app-specific data files. Tools like `get_entities`, `get_pl_data`, `get_kpis`, etc., each read from JSON files committed alongside the app.

Trade-offs vs Kai:
| Aspect | Kai | Anthropic SDK direct |
|---|---|---|
| Model selection | Managed by Kai | You pick |
| Prompt engineering | Managed by Kai | You write |
| Tool catalog | Keboola-grounded by default | You define |
| Project data context | Available out of the box | You provide via tools |
| Operational complexity | Low (auto-discovered service) | Higher (own API key, own infra) |
| Lock-in | To Kai | To Anthropic |

Pick the SDK path when the app's domain is narrow enough that you can hand-craft a small tool catalog AND you want behavioral control. Pick Kai for everything else.
