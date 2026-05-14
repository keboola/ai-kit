# Kai Integration

**Use this when:** you want to embed a natural-language assistant inside the app, grounded in the project's data.

## When to add Kai

Optional integration. Use Kai when:
- The user benefits from natural-language Q&A over project data ("what was our revenue YTD?", "show me top customers by churn risk").
- The dashboard doesn't already answer the question by sight (Kai shines when the answer requires composing multiple metrics or freeform exploration).

Skip Kai when:
- The app is purely a static dashboard — users already know what they're looking at.
- The data domain is too narrow for natural language to add value.
- The app is internal and the team prefers raw SQL access.

## Library

[`keboola/kai-client`](https://github.com/keboola/kai-client) — Python async client with SSE streaming, session management, tool-approval flow, and a `kai` CLI.

JS apps don't need a separate JS package — they proxy HTTP requests to the same `/api/chat` endpoint Kai exposes and stream the SSE response straight back to the browser.

## Service discovery

The Kai service URL is project-specific. Discover it from the Storage API services list rather than hard-coding.

**Python:**
```python
from kai_client import KaiClient

client = await KaiClient.from_storage_api(
    storage_api_token=os.environ["KBC_TOKEN"],
    storage_api_url=os.environ["KBC_URL"],  # e.g. https://connection.us-east4.gcp.keboola.com
)
```

**JS:**
```javascript
async function discoverKaiUrl(storageApiUrl, storageApiToken) {
  const res = await fetch(`${storageApiUrl.replace(/\/$/, '')}/v2/storage`, {
    headers: { 'x-storageapi-token': storageApiToken },
  });
  if (!res.ok) throw new Error(`Storage API discovery failed: ${res.status}`);
  const data = await res.json();
  const kai = (data.services || []).find((s) => s.id === 'kai-assistant');
  if (!kai?.url) throw new Error('kai-assistant service not found');
  return kai.url.replace(/\/$/, '');
}
```

Cache the discovered URL after the first lookup — it doesn't change for the lifetime of the project.

## Authentication

Use the SAME Keboola Storage API token the app already has. Pass it on every Kai request:
- Header: `x-storageapi-token: <KBC_TOKEN>`
- Header: `x-storageapi-url: <KBC_URL>` (so Kai knows which project)

No separate Kai token. No OAuth flow on top. If your app authenticates the end user via OIDC (or whatever) you still use the project's Storage token for the Kai call — the end-user identity is conveyed via Kai's chat history association.

## Pattern A — Streamlit embed

Modeled on `kai-client/examples/streamlit_app.py`.

```python
import asyncio
import os
import streamlit as st
from kai_client import KaiClient

# Session state — one chat per Streamlit session
if "messages" not in st.session_state:
    st.session_state.messages = []
if "chat_id" not in st.session_state:
    st.session_state.chat_id = KaiClient.new_chat_id()

def run_async(coro):
    """Bridge from sync Streamlit to async KaiClient."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()

async def stream_response(chat_id, prompt):
    client = await KaiClient.from_storage_api(
        storage_api_token=os.environ["KBC_TOKEN"],
        storage_api_url=os.environ["KBC_URL"],
    )
    async with client:
        async for event in client.send_message(chat_id, prompt):
            if event.type == "text":
                yield event.text
            elif event.type == "tool-call":
                yield f"\n[Calling tool: {event.tool_name}]\n"
            elif event.type == "finish":
                return
            # event.type == "tool-approval-required" — see below
```

Event types to handle:
- `text` — stream chunk; append to the active assistant message.
- `tool-call` — informational; show the tool name in the chat UI.
- `finish` — terminate the stream.
- `tool-approval-required` — pause the loop, render Approve / Deny buttons, resume with the user's response.

Streamlit-specific gotchas:

- Streamlit reruns the whole script on every interaction. Persist chat history and the `chat_id` in `st.session_state` so the conversation survives reruns.
- The async client must not leak its event loop across reruns. Either construct a fresh loop per call (as above), or use `nest_asyncio` if you need to share a loop with other async code in the same script.
- Streaming output: use `st.write_stream(...)` (Streamlit >=1.31) to render text chunks as they arrive. The function consumes the generator and updates the placeholder incrementally — no manual `st.empty()` plumbing needed.
- Render the chat with `st.chat_message("user" | "assistant")` and capture input with `st.chat_input(...)`. Append each completed message to `st.session_state.messages` so the history re-renders on subsequent runs.

Minimal render loop sketch:

```python
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

if prompt := st.chat_input("Ask about your project data"):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)
    with st.chat_message("assistant"):
        full = st.write_stream(
            run_async(stream_response(st.session_state.chat_id, prompt))
        )
    st.session_state.messages.append({"role": "assistant", "content": full})
```

## Pattern B — JS data-app embed

Modeled on `kai-client/examples/js-dataapp/server.js`. Express backend proxies POST requests to Kai and streams the SSE response back to the browser unchanged.

```javascript
import express from 'express';
const app = express();
app.use(express.json());

let kaiBaseUrl = null;
async function getKaiUrl() {
  if (kaiBaseUrl) return kaiBaseUrl;
  kaiBaseUrl = await discoverKaiUrl(process.env.KBC_URL, process.env.KBC_TOKEN);
  return kaiBaseUrl;
}

async function proxySSE(payload, res) {
  const upstream = await fetch(`${await getKaiUrl()}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-storageapi-token': process.env.KBC_TOKEN,
      'x-storageapi-url': process.env.KBC_URL,
    },
    body: JSON.stringify(payload),
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
}

app.post('/api/chat', (req, res) => proxySSE(req.body, res));
app.post('/api/chat/:chatId/:action/:approvalId', (req, res) => {
  // Tool approval — forward to Kai with the approval response payload
  // See kai-client/examples/js-dataapp/server.js for the payload shape
  proxySSE(/* approval payload */, res);
});
```

The frontend reads the SSE stream (`new EventSource('/api/chat', ...)` or `fetch` with manual reader) and renders chunks progressively. A minimal browser-side reader:

```javascript
async function sendMessage(chatId, prompt, onEvent) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: prompt }),
  });
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
      if (!line) continue;
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

## Pre-built skills

The `kai-client` repo ships its own skill plugin: `plugins/kai-dataapp/skills/{kai-js, kai-streamlit}`. Point users there for deeper integration work — those skills cover the full chat UI, history management, voting, and tool-approval UX patterns.

What the dedicated skills add on top of the patterns above:
- Conversation history persistence (server-side via Kai's chat-id, plus client-side caching for fast re-render).
- Tool-approval modal UX — paired buttons, denial reasons, and resume-on-response.
- Vote-up / vote-down feedback wired to Kai's feedback endpoint.
- Suggested-prompt chips and follow-up suggestions extracted from Kai's response metadata.
- Error and reconnection handling for dropped SSE streams.

This reference here covers awareness + the minimum embed pattern. For production-quality integration, install the kai-client plugin and use its dedicated skills.

## DIY alternative — Anthropic SDK directly

When you want full control — custom tool catalog tied to app-specific data, no dependency on Kai's lifecycle — call the Anthropic API directly.

Reference: the FI app (`keboola-rnd/keboola-financial-intelligence-app`) uses a Vercel serverless function `api/chat` that calls the Anthropic SDK with tools scoped to its financial JSON files. Tools include `get_entities`, `get_pl_data`, `get_kpis`, etc., each reading from `public/data/*.json`.

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
