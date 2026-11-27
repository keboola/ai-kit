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
- Pattern B — JS data-app embed (`KaiChat`)
- Pattern C — FastAPI backend relay
- Rendering Kai's answer
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
- The app has a workspace: `runtime.workspace.enabled: true`. For python-js apps that is `storage_access=True` — see [storage-access.md](storage-access.md) §Enabling Storage access on a deployed app.
- No row- or column-level security: `runtime.kai` cannot be combined with `runtime.workspace.rlsPolicies` or `runtime.workspace.clsPolicies`.
- A project member deploys it, with a role that can create Storage API tokens.
- The project has Kai (`agent-chat` feature); otherwise every Kai request is a 403.

Turning Kai on does not change a running app: **deploy the app again** after turning it on. On each new deployment by a user, the platform:
1. Creates a Storage API token for Kai, carrying the deploying user. It expires after 90 days, so an app not redeployed for that long loses Kai.
2. Puts it into the app as the env var `KAI_STORAGE_API_TOKEN`. Do not add a secret of that name yourself.
3. Sets `KAI_ENABLED=1`.

Apps without `runtime.kai` are unchanged. Like Storage access, the setting lives in the app's Storage configuration, so a draft and its prod app each need it.

### With kbagent

`config update --merge` deep-merges the JSON into the app's configuration, so one call maps the tables, turns on the workspace and turns on Kai. This body gives strict mode (see §What Kai can reach in the app):

```bash
kbagent config update --project P --component-id keboola.data-apps --config-id CONFIG_ID --merge \
  --change-description "Map the app's tables, enable Kai" \
  --configuration '{
    "storage": {"input": {"read_only_storage_access": false, "tables": [
      {"source": "in.c-sales.orders", "load_strategy": "direct-grant"}
    ]}},
    "runtime": {"workspace": {"enabled": true}, "kai": {"enabled": true}}
  }'
kbagent data-app deploy --project P --app-id APP_ID --wait
```

`CONFIG_ID` is in the output of `kbagent data-app detail --project P --app-id APP_ID`. After the deploy the app's environment has `KAI_ENABLED`, `KAI_STORAGE_API_TOKEN` and a new `WORKSPACE_ID`: a deploy can replace the workspace, so read `WORKSPACE_ID` from the environment and never store it.

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
3. `KAI_ENABLED` unset or off (an app without `runtime.kai`, or local dev) → `STORAGE_API_TOKEN`, a secret holding a project member's personal token. Kai then acts with that member's full access, writes included, for **every visitor** of the app: use it for local development, not in a deployed app.

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

Keep the token on the app's backend; it never reaches the browser.

## What Kai can reach in the app

The Kai token is read-only in both modes: it has `read` on buckets only, with no right to manage buckets and no access to components. Kai cannot create or change buckets, tables, configurations or jobs with it. The grants are fixed when the app is deployed: a bucket created later gets no grant until the app is deployed again.

What Kai reaches depends on the app's input mapping:

- **Direct-grant input mapping** (`storage.input.read_only_storage_access: false`) — Kai runs in strict mode:
  - It sees only the buckets of the tables named by `source` in the input mapping and `destination` in the output mapping that exist at deploy time, and queries only the tables mapped into the workspace. A table mapped with `source_search` and file input never get a grant. An app with no mapping gives Kai no data at all.
  - The grant is per bucket, not per table. Kai lists every table of such a bucket with its columns and row count, also the ones the app does not map, and the token itself can read their rows through the Storage API. Only Kai's SQL is limited to the mapped tables. Keep a table the app must not expose in a bucket the app does not map.
  - It gets only read tools: `query_data` (read-only SQL), `get_buckets`, `get_tables`, `get_project_info` and `docs_query`.
  - Kai can still ask the user a question (`AskUserQuestion`), which waits for a decision like a write (see §Tool approval).
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

JS apps use two packages: the Kai relay in `@keboola/api-client/sdk/dataAppServer` (`kbc.kai`, on the backend) and `@keboola/kai-app-chat` (`<KaiChat />` and the headless `useKaiChat()`, in the browser).

## Service discovery

The Kai service URL is stack-specific. Discover the `kai-agent` service from the Storage API services list rather than hard-coding it. Do not use `kai-assistant`: it is the legacy backend and does not apply the app's scoping.

```python
from kai_client import KaiClient

async def make_client() -> KaiClient:
    return await KaiClient.from_storage_api(**kai_credentials())  # discovers kai-agent
```

Cache the discovered URL after the first lookup — it doesn't change for the lifetime of the app.

## Pattern A — Streamlit embed

```python
import asyncio
import os
from contextlib import aclosing
import streamlit as st
from kai_client import KaiClient, KaiConfigurationError, KaiError, KaiNotFoundError

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

DENY_REASON = "This app cannot show approvals or questions to the user. Continue without them."

async def deny_approval(client, chat_id, tool_call_id):
    """Deny a waiting tool so the turn ends; retry once on 404 (see §Tool approval)."""
    try:
        await client.submit_approval(chat_id=chat_id, tool_use_id=tool_call_id, approved=False, reason=DENY_REASON)
    except KaiNotFoundError:
        await client.submit_approval(chat_id=chat_id, tool_use_id=tool_call_id, approved=False, reason=DENY_REASON)

async def stream_response(chat_id, prompt):
    client = await KaiClient.from_storage_api(**KAI_CREDENTIALS)
    # aclosing() closes the stream when the answer ends early or the consumer stops.
    async with client, aclosing(client.send_message(chat_id, prompt)) as events:
        async for event in events:
            if event.type == "text":
                yield event.text
            elif event.type == "tool-call" and event.state == "started":
                yield f"\n[Calling tool: {event.tool_name}]\n"
            elif event.type == "tool-approval-request":
                try:
                    await deny_approval(client, chat_id, event.tool_call_id)
                    yield "\n[Kai asked for an approval or an answer; this app declined it.]\n"
                except KaiError as e:
                    code = e.code or ""
                    if code.startswith("conflict") or code == "http:409":
                        continue  # already resolved, so Kai goes on
                    # Still waiting: the turn stays blocked until kai-agent times it out.
                    yield f"\n[Could not decline Kai's request, so Kai cannot go on: {e.message}]\n"
                    return
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
        # Also when st.write_stream stops early: close the generator on its own loop first.
        loop.run_until_complete(agen.aclose())
        loop.close()
```

Event types to handle:
- `text` — stream chunk; append to the active assistant message.
- `tool-call` — informational; one event per state (`started`, `input-available`, `output-available`) of the same `tool_call_id`, so show the tool name once.
- `tool-approval-request` — a tool (a write, or an interactive question such as `AskUserQuestion`) waits for a decision and the stream stays open until it gets one. Streamlit cannot ask in the middle of a streamed answer, so a Streamlit app denies every request and Kai continues without that tool. Strict mode does not remove interactive questions, so deny in strict mode too.
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

## Pattern B — JS data-app embed (`KaiChat`)

The backend mounts the Kai relay from `@keboola/api-client`, and the page renders `<KaiChat />` (or the headless `useKaiChat()`) from `@keboola/kai-app-chat`. The relay picks the token and sends the headers by §Token and headers, keeps each visitor's chats apart, and declines every approval.

```bash
npm i @keboola/kai-app-chat@^0.1.0 @keboola/api-client@^62   # the template's api-client predates kbc.kai
```

How to wire them, after the install (the installed version's own docs, so read them rather than guess):

- `node_modules/@keboola/kai-app-chat/README.md`: the server mount, the `styles.css` import, `<KaiChat />` props, `useKaiChat()`.
- `node_modules/@keboola/api-client/docs/query-service.md` §Kai for the app's visitors: the relay's routes, limits and errors.

What the package docs don't say:

- In `templates/react-vite-app`, mount the relay in `server/index.ts` on the `kbc` from `server/kbcQuery.ts`, before the `/api` 404 catch-all.
- In the Python+Node template Python owns `/api/*`, and `KaiChat` needs this relay; there relay Kai from Python (Pattern C) and draw your own chat (§Rendering Kai's answer).
- No nginx change: the relay turns off buffering for its stream.
- Local dev without `runtime.kai` may use a project member's token through the relay's personal-token option. Remove the option before you deploy (§Token and headers, rule 3).

## Pattern C — FastAPI backend relay

For an app with a Python backend (`templates/python-node-app/`), where `KaiChat` cannot be used (Pattern B). The backend passes Kai's stream to the browser unchanged, and the page draws its own chat (§Rendering Kai's answer). It needs `httpx` in the backend's dependencies. The relay also declines every tool that waits for a decision (see §Tool approval), so the browser needs no approval call. Unlike the JS relay it does not keep visitors' chats apart: keep each visitor's chat id in their own session (§What Kai can reach in the app).

```python
import json
import os
import uuid

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

router = APIRouter()  # in main.py: app.include_router(router)
DECLINE_REASON = "This app cannot show approvals or questions to the user. Continue without them."
_kai_url: str | None = None


def kai_headers() -> dict[str, str]:
    """Headers of a Kai request; raises RuntimeError when Kai is off in this run (see §Token and headers)."""
    token = os.environ.get("KAI_STORAGE_API_TOKEN")
    if not token:
        if os.environ.get("KAI_ENABLED", "").strip().lower() not in ("", "0", "false", "no", "off"):
            raise RuntimeError("Kai is not available in this run of the app.")
        token = os.environ.get("STORAGE_API_TOKEN")  # local development only
    url = os.environ.get("KBC_URL")
    if not token or not url:
        raise RuntimeError("Kai needs KBC_URL and KAI_STORAGE_API_TOKEN or STORAGE_API_TOKEN.")
    headers = {"x-storageapi-token": token, "x-storageapi-url": url}
    if os.environ.get("WORKSPACE_ID"):
        headers["x-workspace-id"] = os.environ["WORKSPACE_ID"]
    return headers


async def kai_url() -> str:
    global _kai_url
    if _kai_url is None:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{os.environ['KBC_URL'].rstrip('/')}/v2/storage")
            response.raise_for_status()
        services = {s["id"]: s["url"] for s in response.json().get("services", [])}
        _kai_url = services["kai-agent"].rstrip("/")  # KeyError: the stack has no kai-agent
    return _kai_url


async def decline(client: httpx.AsyncClient, url: str, headers: dict, chat_id: str, tool_call_id: str) -> None:
    """Decline a waiting tool so the turn goes on; one retry on 404 (see §Tool approval)."""
    body = {"toolUseId": tool_call_id, "approved": False, "reason": DECLINE_REASON}
    for _ in range(2):
        try:
            response = await client.post(f"{url}/api/chat/{chat_id}/approval", headers=headers, json=body, timeout=30)
        except httpx.HTTPError:
            return
        if response.status_code != 404:
            return


class ChatRequest(BaseModel):
    chatId: str = Field(pattern=r"^[0-9a-f-]{36}$")  # UUID, one per conversation
    text: str = Field(min_length=1, max_length=8000)


@router.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        headers = kai_headers()
    except RuntimeError as e:
        return JSONResponse({"error": str(e)}, status_code=503)  # Kai is off; the rest of the app runs
    try:
        url = await kai_url()
    except (httpx.HTTPError, KeyError) as e:
        return JSONResponse({"error": f"Kai service discovery failed: {e!r}"}, status_code=502)
    body = {
        "id": request.chatId,
        "message": {"id": str(uuid.uuid4()), "role": "user", "parts": [{"type": "text", "text": request.text}]},
        "selectedVisibilityType": "private",
        "supportsApprovalRequestedEvent": True,
        "client": "data-app",
    }
    client = httpx.AsyncClient(timeout=httpx.Timeout(600, connect=30))
    try:
        upstream = await client.send(client.build_request("POST", f"{url}/api/chat", headers=headers, json=body), stream=True)
    except httpx.HTTPError as e:
        await client.aclose()
        return JSONResponse({"error": f"Kai request failed: {e!r}"}, status_code=502)
    if upstream.status_code >= 300:
        text = (await upstream.aread()).decode(errors="replace")
        await upstream.aclose()
        await client.aclose()
        return JSONResponse({"error": text[:1000]}, status_code=upstream.status_code)

    async def relay():
        pending = b""
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk  # the browser gets Kai's SSE frames unchanged
                pending += chunk
                *lines, pending = pending.split(b"\n")
                for line in lines:
                    if not line.startswith(b"data:") or b"tool-approval-request" not in line:
                        continue
                    try:
                        event = json.loads(line[5:])
                    except ValueError:
                        continue
                    if event.get("type") == "tool-approval-request" and event.get("toolCallId"):
                        await decline(client, url, headers, request.chatId, event["toolCallId"])
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(relay(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
```

Disable nginx buffering for the route, or the answer arrives in one piece at the end: a `location /api/chat` block with the SSE snippet from [python-js-apps.md](python-js-apps.md) §Nginx and a long `proxy_read_timeout` (e.g. `600s`), before the general `location /api/`.

In the browser, read the stream and hand each event to the chat (§Rendering Kai's answer):

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

## Rendering Kai's answer

Kai's stream is more than text, and its text is more than plain markdown. Kai writes for the chat in the Keboola UI: an app that prints `text-delta` as it comes shows raw JSON blocks and `icon:` words to the user.

Events in the stream (`data: <json>` lines, the type inside the JSON):

| `type` | Fields | What to do |
|---|---|---|
| `text-start`, `text-delta`, `text-end` | `delta` | One text block per `text-start`. Kai writes several in one answer, with tool calls between them: start a new paragraph on `text-start`, or the blocks run together. |
| `tool-input-available` | `toolCallId`, `toolName`, `input` | A tool call. Keboola tools are named `mcp__keboola__<tool>`; `input` of `query_data` has `sql_query` and `query_name`. Show the name, and the SQL on demand. |
| `tool-output-available` | `toolCallId`, `output` | The tool finished. For a Keboola tool the result is in `output.structuredContent`; a declined tool has `output._declined: true`. |
| `tool-output-error` | `toolCallId`, `errorText` | The tool failed, e.g. Storage or the workspace refused the access. Kai goes on and explains it in the text. |
| `tool-approval-request` | `toolCallId` | A tool waits for a decision — see §Tool approval. |
| `error` | `errorText` | The turn is over. |
| `finish`, `start`, `tool-input-start`, `data-*` | | Ignore. `finish` also comes between the steps of one answer. |

Markup in the text, besides GitHub-flavoured markdown (tables included — use a renderer with GFM, e.g. `react-markdown` with `remark-gfm`):

- **```` ```next_actions ````** — the answer ends with a list of suggested follow-up prompts, one per `- ` line. Cut the block out of the text and show the lines as buttons that send the prompt.
- **```` ```flint ````** — a chart as JSON: `data.values` (rows), `chart_spec.chartType` (`Bar Chart`, `Grouped Bar Chart`, `Stacked Bar Chart`, `Line Chart`, `Area Chart`, `Scatter Plot`, `Pie Chart`, `Donut Chart`, `Histogram`, `Heatmap`) and `chart_spec.encodings.x.field` / `.y.field`, optionally `.color.field`. Draw it with the app's chart library, or cut it out: Kai always states the numbers in the text too.
- **```` ```mermaid ````** — a diagram. Render it with Mermaid or cut it out.
- **`icon:<name>`** — an inline icon (e.g. `icon:lock` before a refusal) from the Keboola UI's icon set. Remove the word, or map the few names the app cares about.
- Links to tables and buckets point into the Keboola UI, which a visitor of the app may have no access to.

While the answer streams, a block can be incomplete: hide a fenced block until its closing fence arrives.

## Tool approval

Most tools run without asking. A tool that changes something, or an interactive question Kai asks the user, waits for a decision, and on `kai-agent` the chat stream **stays open** meanwhile:

1. The stream emits `{ type: 'tool-approval-request', toolCallId, approvalId }` when the chat request sends `supportsApprovalRequestedEvent: true`.
2. Decline it, and tell the user what Kai wanted. **A data app never approves:** every visitor is the same Kai user, and kai-agent approves whatever tool is waiting, a write included, whatever `answers` the request carries. So the backend forwards only `approved: false`; in a JS app the relay enforces this (Pattern B). Kai's questions (`AskUserQuestion`) are declined too, as in Streamlit.
3. The backend (kai-client in Python, the relay in JS) POSTs the decision to `{kai}/api/chat/{chatId}/approval` with the same headers and `{ "toolUseId": "<toolCallId>", "approved": false, "reason": "<why>" }`.
4. The original stream continues with the tool's output.

Responses to the POST:
- **404** — the approval is not registered yet. kai-agent already waits 10 s for it before answering, so retry once. Answer only a tool announced by `tool-approval-request`: for any other tool the 404 does not go away.
- **409** — the decision can no longer apply (already resolved, timed out, chat stopped, Kai restarted); do not retry.
- A write left undecided is denied after 5 minutes; an interactive question waits indefinitely.

Python: from 0.14.0, kai-client's `send_message()` sends `supportsApprovalRequestedEvent: true`, so a waiting tool is announced by an event with `event.type == "tool-approval-request"`. Answer that event with `client.submit_approval(chat_id=..., tool_use_id=event.tool_call_id, approved=...)`, not every `tool-call` with `state == "input-available"`: every tool passes through that state, and answering one that does not wait ends in a 404. Streamlit cannot wait for a click in the middle of a streamed answer, so a Streamlit app denies every request with `approved=False` (Pattern A): an undenied interactive question would hold the stream open indefinitely, also in strict mode.

## Pre-built skills

This reference covers awareness + the minimum embed pattern. A JS app gets the full chat UI from `KaiChat` (Pattern B). For Streamlit beyond this sketch, see the `kai-client` plugin's `kai-streamlit` skill.

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
