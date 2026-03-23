# Kai AI Assistant Integration

Patterns for embedding the Keboola AI Assistant (Kai) into data apps. Kai lets users ask natural-language questions about their Keboola project data.

---

## Architecture Overview

```
Browser ──POST──> Your Backend ──POST──> kai-assistant API
         <──SSE──              <──SSE──
```

Credentials (`x-storageapi-token`, `x-storageapi-url`) stay on the backend. The browser never sees them.

---

## For Next.js / React Apps

### Backend: Kai Proxy Routes (FastAPI)

Add to your `backend/main.py`:

```python
from fastapi import Request
from fastapi.responses import StreamingResponse
import json, uuid

# ─── Persistent HTTP client ─────────────────────────────────────────────────
# IMPORTANT: Reuse a single httpx.AsyncClient across requests.
# Creating a new client per request adds 500-1500ms (TCP + TLS handshake).
# A persistent client keeps connections alive and reuses them.
from contextlib import asynccontextmanager

_http_client: httpx.AsyncClient | None = None

@asynccontextmanager
async def lifespan(app):
    global _http_client
    _http_client = httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0))
    yield
    await _http_client.aclose()

# Add lifespan to your FastAPI app: app = FastAPI(lifespan=lifespan)

def _get_http_client() -> httpx.AsyncClient:
    assert _http_client is not None, "App not started — httpx client not initialized"
    return _http_client

# ─── Kai service discovery ───────────────────────────────────────────────────
_kai_url = None

async def discover_kai_url():
    global _kai_url
    if _kai_url:
        return _kai_url
    client = _get_http_client()
    resp = await client.get(
        f"{KBC_URL}/v2/storage",
        headers={"x-storageapi-token": KBC_TOKEN},
    )
    data = resp.json()
    svc = next((s for s in data.get("services", []) if s["id"] == "kai-assistant"), None)
    if not svc:
        raise HTTPException(500, "kai-assistant service not found")
    _kai_url = svc["url"].rstrip("/")
    return _kai_url

# ─── SSE proxy ───────────────────────────────────────────────────────────────
async def proxy_sse(payload: dict):
    kai_url = await discover_kai_url()
    client = _get_http_client()
    async with client.stream(
        "POST",
        f"{kai_url}/api/chat",
        headers={
            "Content-Type": "application/json",
            "x-storageapi-token": KBC_TOKEN,
            "x-storageapi-url": KBC_URL,
        },
        json=payload,
    ) as resp:
        async for chunk in resp.aiter_bytes():
            yield chunk

@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    return StreamingResponse(proxy_sse(body), media_type="text/event-stream",
                             headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})

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
    return StreamingResponse(proxy_sse(payload), media_type="text/event-stream",
                             headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})
```

### Frontend: KaiChat React Component

```typescript
// components/kai/KaiChat.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface PendingApproval {
  approvalId: string
  toolCallId: string
}

export default function KaiChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [chatId] = useState(() => crypto.randomUUID())
  const [isStreaming, setIsStreaming] = useState(false)
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(scrollToBottom, [messages, scrollToBottom])

  async function readSSEStream(
    url: string,
    options: RequestInit,
    onDelta: (text: string) => void,
    onToolApproval?: (approval: PendingApproval) => void,
  ) {
    const res = await fetch(url, options)
    if (!res.ok) throw new Error(await res.text())

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop()!

      for (const part of parts) {
        for (const line of part.split('\n')) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (raw === '[DONE]') continue
          try {
            const data = JSON.parse(raw)
            if (data.type === 'text-delta' && data.delta) {
              onDelta(data.delta)
            } else if (data.type === 'tool-approval-request' && onToolApproval) {
              onToolApproval({
                approvalId: data.approvalId,
                toolCallId: data.toolCallId,
              })
            }
          } catch {}
        }
      }
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)

    let accumulated = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      await readSSEStream(
        '/api/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: chatId,
            message: {
              id: crypto.randomUUID(),
              role: 'user',
              parts: [{ type: 'text', text }],
            },
            selectedChatModel: 'chat-model',
            selectedVisibilityType: 'private',
          }),
        },
        (delta) => {
          accumulated += delta
          setMessages(prev => {
            const next = [...prev]
            next[next.length - 1] = { role: 'assistant', content: accumulated }
            return next
          })
        },
        (approval) => setPendingApproval(approval),
      )
    } catch (err: any) {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: `Error: ${err.message}` }
        return next
      })
    }

    setIsStreaming(false)
  }

  async function handleApproval(approved: boolean) {
    if (!pendingApproval) return
    const { approvalId } = pendingApproval
    setPendingApproval(null)
    setIsStreaming(true)

    let accumulated = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    const action = approved ? 'approve' : 'reject'
    try {
      await readSSEStream(
        `/api/chat/${chatId}/${action}/${approvalId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        (delta) => {
          accumulated += delta
          setMessages(prev => {
            const next = [...prev]
            next[next.length - 1] = { role: 'assistant', content: accumulated }
            return next
          })
        },
      )
    } catch {}

    setIsStreaming(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'ml-auto bg-brand-primary/10 text-brand-secondary'
                : 'mr-auto bg-surface border border-border'
            }`}
          >
            {msg.content}
            {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && (
              <span className="inline-block w-0.5 h-4 bg-brand-primary animate-pulse ml-0.5" />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Tool Approval */}
      {pendingApproval && (
        <div className="mx-4 mb-2 p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center justify-between">
          <span className="text-sm">A tool requires your approval.</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleApproval(true)}
              className="px-3 py-1 text-sm font-medium bg-positive/10 text-positive rounded-md hover:bg-positive/20"
            >
              Approve
            </button>
            <button
              onClick={() => handleApproval(false)}
              className="px-3 py-1 text-sm font-medium bg-negative/10 text-negative rounded-md hover:bg-negative/20"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage(input) }}
        className="flex gap-2 px-4 py-3 border-t border-border"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Kai about your data..."
          disabled={isStreaming}
          className="flex-1 px-4 py-2 text-sm border border-border rounded-lg bg-white focus:border-brand-primary focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="px-4 py-2 text-sm font-semibold bg-brand-primary text-white rounded-lg hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  )
}
```

### Add as a Tab

In your `NavTabs` component, add an "AI Assistant" tab pointing to `/assistant`.

Create `app/assistant/page.tsx`:
```typescript
import KaiChat from '@/components/kai/KaiChat'
import Header from '@/components/layout/Header'
import NavTabs from '@/components/layout/NavTabs'

export default function AssistantPage() {
  return (
    <>
      <Header title="AI Assistant" />
      <NavTabs />
      <main className="relative z-1 pt-[100px]">
        <KaiChat />
      </main>
    </>
  )
}
```

### Nginx: SSE Support

In `keboola-config/nginx/sites/default.conf`, ensure the `/api/` location has:
```nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 600s;
```

---

## Production Enhancements (Next.js)

The basic integration above works but lacks polish. Apply these enhancements for a production-grade Kai experience.

### 1. Markdown Rendering

Install `react-markdown` and `remark-gfm` so Kai's responses render tables, code blocks, lists, and headings properly:

```bash
npm install react-markdown remark-gfm
```

In `KaiChat.tsx`, replace plain text rendering with:
```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// In the message bubble:
<div className="kai-prose">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
</div>
```

Add `kai-prose` CSS to `globals.css` for typographic styling:
```css
.kai-prose { font-size: 0.9rem; line-height: 1.7; color: #1e293b; }
.kai-prose h1, .kai-prose h2, .kai-prose h3 { font-weight: 700; margin: 1em 0 0.5em; color: #0f172a; }
.kai-prose h1 { font-size: 1.25rem; } .kai-prose h2 { font-size: 1.1rem; } .kai-prose h3 { font-size: 1rem; }
.kai-prose p { margin: 0.5em 0; }
.kai-prose code { font-family: var(--font-mono); font-size: 0.85em; background: #f1f5f9; padding: 0.15em 0.4em; border-radius: 4px; }
.kai-prose pre { background: #0f172a; color: #e2e8f0; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 0.75em 0; }
.kai-prose pre code { background: none; padding: 0; color: inherit; }
.kai-prose table { width: 100%; border-collapse: collapse; margin: 0.75em 0; font-size: 0.85rem; }
.kai-prose th { background: #f8fafc; font-weight: 600; text-align: left; padding: 0.5rem; border-bottom: 2px solid #e2e8f0; }
.kai-prose td { padding: 0.5rem; border-bottom: 1px solid #f1f5f9; }
.kai-prose ul, .kai-prose ol { margin: 0.5em 0; padding-left: 1.5em; }
.kai-prose li { margin: 0.25em 0; }
.kai-prose blockquote { border-left: 3px solid var(--color-brand-primary); padding-left: 1em; color: #475569; margin: 0.75em 0; }
.kai-prose a { color: var(--color-brand-primary); text-decoration: none; font-weight: 500; }
.kai-prose a:hover { text-decoration: underline; }
```

### 2. Dynamic System Context

Inject live app data into the first message so Kai knows the dashboard context:

```typescript
function buildSystemContext(kpis: KpiResponse, me: UserMeResponse, platform: PlatformInfo) {
  return `You are helping a user explore their Keboola data app.

Current dashboard KPIs:
- Total Revenue: ${formatCurrency(kpis.total_revenue)}
- Gross Margin: ${formatPercent(kpis.gp_margin_pct)}
- Revenue Delta YoY: ${formatDelta(kpis.delta_revenue_pct)}

User: ${me.email} (role: ${me.role})
Keboola stack: ${platform.connection_url}

When linking to accounts, use markdown: [Account Name](/account/{id})
When linking to groups, use: [Group Name](/group/{id})
When linking to Keboola resources, use full URLs: [Flow Name](${platform.connection_url}/...)`
}
```

Prepend this context to the first message's parts:
```typescript
parts: [
  { type: 'text', text: systemContext },  // hidden context
  { type: 'text', text: userMessage },    // visible message
]
```

### 3. Suggestion Chips

Show contextual suggestions in the empty state and after each response:

```typescript
// Empty state suggestions — built from live data
const emptySuggestions = useMemo(() => {
  const chips: string[] = []
  if (groups?.length) {
    chips.push(`How is ${groups[0].group_name} performing?`)
    chips.push(`Compare top ${groups.length > 3 ? 3 : groups.length} groups`)
  }
  if (me?.role === 'admin') chips.push('Show team performance summary')
  chips.push('What are the key trends this quarter?')
  return chips
}, [groups, me])

// Follow-up suggestions — generated after each response
const [followUps, setFollowUps] = useState<string[]>([])

// After streaming completes, set contextual follow-ups:
setFollowUps([
  'Break this down by profit line',
  'Which accounts are at risk?',
  'Show me the trend over time',
])
```

Render as animated pill buttons:
```typescript
{suggestions.map((text, i) => (
  <motion.button
    key={text}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.05 }}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={() => sendMessage(text)}
    className="px-3 py-1.5 text-sm bg-brand-primary/5 border border-brand-primary/20
               rounded-full hover:bg-brand-primary/10 transition-colors"
  >
    {text}
  </motion.button>
))}
```

### 4. Conversation Persistence

Save conversations to localStorage for history:

```typescript
// lib/chat-storage.ts
const STORAGE_KEY = 'kai-conversations'
const MAX_CONVERSATIONS = 50

interface StoredConversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export function saveConversation(conv: StoredConversation) {
  const all = loadConversations()
  const idx = all.findIndex(c => c.id === conv.id)
  if (idx >= 0) all[idx] = conv
  else all.unshift(conv)
  // Auto-prune oldest beyond cap
  while (all.length > MAX_CONVERSATIONS) all.pop()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function loadConversations(): StoredConversation[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

export function deriveTitle(messages: Message[]): string {
  const first = messages.find(m => m.role === 'user')
  return first?.content.slice(0, 60) || 'New conversation'
}
```

Save after each completed response using `requestAnimationFrame` to avoid blocking:
```typescript
requestAnimationFrame(() => {
  saveConversation({
    id: chatId,
    title: deriveTitle(messages),
    messages,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
})
```

### 5. rAF-Batched SSE Rendering

The basic SSE reader calls `setMessages` on every chunk, causing 50+ React re-renders per second. Batch with `requestAnimationFrame`:

```typescript
let pendingDelta = ''
let rafId: number | null = null

function flushDelta() {
  if (!pendingDelta) return
  const text = pendingDelta
  pendingDelta = ''
  accumulated += text
  setMessages(prev => {
    const next = [...prev]
    next[next.length - 1] = { role: 'assistant', content: accumulated }
    return next
  })
  rafId = null
}

// In the SSE onDelta callback:
onDelta: (delta) => {
  pendingDelta += delta
  if (!rafId) rafId = requestAnimationFrame(flushDelta)
}
```

This drops re-renders from 50+/sec to ~60/sec (once per frame).

Apply the same pattern to scrollIntoView:
```typescript
let scrollRaf: number | null = null
function scheduleScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    scrollRaf = null
  })
}
```

### 6. Backend: /api/platform Endpoint

Expose Keboola connection info so the frontend can build deep links:

```python
@app.get("/api/platform")
async def platform_info():
    return {
        "connection_url": KBC_URL,
        "project_id": os.environ.get("KBC_PROJECT_ID"),
        "bucket": os.environ.get("KBC_BUCKET", "out.c-analysis"),
    }
```

The frontend uses this for system context and to build Keboola links in Kai's responses.

### 7. Internal Link Rendering

When Kai outputs markdown links like `[Account Name](/account/123)`, render them as Next.js `<Link>` with branded pill styling:

```typescript
import Link from 'next/link'

// Custom link renderer for react-markdown:
components={{
  a: ({ href, children }) => {
    if (href?.startsWith('/')) {
      // Internal app link — pill badge style
      return (
        <Link href={href} className="inline-flex items-center gap-1 px-2 py-0.5
          bg-brand-primary/8 text-brand-primary font-medium rounded-md
          hover:bg-brand-primary/15 transition-colors text-[0.85em]">
          {children} <span className="text-[0.75em]">&rarr;</span>
        </Link>
      )
    }
    // External link — dashed underline with icon
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
         className="text-brand-primary underline decoration-dashed underline-offset-2
                    hover:decoration-solid">
        {children} <ExternalLink className="inline w-3 h-3 ml-0.5" />
      </a>
    )
  }
}}
```

---

## For Streamlit Apps

### Install

```bash
pip install kai-client python-dotenv
```

### Async Bridge

KaiClient is async. Streamlit is sync:

```python
import asyncio

def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
```

### Client Creation

**Always use `from_storage_api()`**:
```python
from kai_client import KaiClient

async def get_client():
    return await KaiClient.from_storage_api(
        storage_api_token=os.environ.get("KBC_TOKEN") or st.secrets.get("KBC_TOKEN"),
        storage_api_url=os.environ.get("KBC_URL") or st.secrets.get("KBC_URL"),
    )
```

### Streaming into Containers

```python
async def collect_chat_response(chat_id, text, container):
    accumulated = ""
    pending = None
    tool_names = {}
    text_placeholder = container.empty()
    client = await get_client()

    async with client:
        async for event in client.send_message(chat_id, text):
            if event.type == "text":
                accumulated += event.text
                text_placeholder.markdown(accumulated + "▌")
            elif event.type == "tool-call":
                call_id = getattr(event, "tool_call_id", "")
                name = getattr(event, "tool_name", None)
                state = getattr(event, "state", None)
                if name:
                    tool_names[call_id] = name
                display_name = name or tool_names.get(call_id, "tool")
                if state == "input-available":
                    text_placeholder.markdown(accumulated)
                    container.info(f"Calling **{display_name}**...")
                    text_placeholder = container.empty()
                elif state == "output-available":
                    text_placeholder.markdown(accumulated)
                    container.info(f"**{display_name}** completed.")
                    text_placeholder = container.empty()
            elif event.type == "tool-approval-request":
                pending = {"approval_id": event.approval_id, "tool_call_id": event.tool_call_id}

    text_placeholder.markdown(accumulated)
    return accumulated, pending
```

### Add as a Tab

In `streamlit_app.py`, add an "AI Assistant" tab or page:

```python
# page_modules/assistant.py
import streamlit as st
from kai_client import KaiClient

def create_assistant_page():
    st.title("AI Assistant")

    if "kai_messages" not in st.session_state:
        st.session_state.kai_messages = []
    if "kai_chat_id" not in st.session_state:
        st.session_state.kai_chat_id = KaiClient.new_chat_id()

    for msg in st.session_state.kai_messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    prompt = st.chat_input("Ask Kai about your data...")
    if prompt:
        st.session_state.kai_messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            container = st.container()
            result, pending = run_async(
                collect_chat_response(st.session_state.kai_chat_id, prompt, container)
            )
        st.session_state.kai_messages.append({"role": "assistant", "content": result})
        st.rerun()
```

---

## SSE Event Reference

| Event Type | Key Field | Action |
|------------|-----------|--------|
| `text-delta` | `delta` | Append to accumulated text |
| `tool-call` | `toolCallId`, `toolName`, `state` | Show tool indicators |
| `tool-approval-request` | `approvalId` | Show approve/deny UI |
| `finish` | `finishReason` | Stream complete |
| `error` | `message` | Show error |

**Gotcha**: `output-available` often has `toolName: null`. Cache from `input-available` using `toolCallId`.

## Credentials

Both frameworks use the same env vars:
- `STORAGE_API_TOKEN` / `KBC_TOKEN`
- `STORAGE_API_URL` / `KBC_URL`

**IMPORTANT**: `STORAGE_API_URL` / `KBC_URL` must match the user's Keboola stack:

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
