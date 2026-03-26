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

**Prerequisite:** `httpx>=0.27.0` must be in your `backend/pyproject.toml` dependencies.

Add to your `backend/main.py`:

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

### Nginx: Health Probe + SSE Support

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

**Keep system context concise (~200 chars max).** Large system contexts (2000+ chars with lookup tables, URL templates, and detailed formatting instructions) confuse Kai — it focuses on formatting instead of querying project data.

```typescript
function buildSystemContext(kpis: KpiResponse, me: UserMeResponse) {
  return `[Context: Revenue: ${formatCurrency(kpis.total_revenue)} (${formatDelta(kpis.delta_revenue_pct)} YoY), GP Margin: ${formatPercent(kpis.gp_margin_pct)}, ${groups?.length ?? 0} customer groups. User: ${me.role}. Use your tools to query the Keboola project data.]`
}
```

**What NOT to include:** full account/group ID lookup tables, Keboola URL templates, multi-line link formatting instructions, detailed role descriptions. Keep link formatting to one line at most.

Prepend this context to the first message's parts:
```typescript
parts: [
  { type: 'text', text: systemContext },  // hidden context — ~200 chars
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

#### Production Conversation UX

For a production-grade conversation experience, add these patterns:

**Reactive conversation list** — use a `useConversationList()` hook with `CustomEvent` sync so multiple components stay in sync (follows the same pattern as settings.ts):
```typescript
// Dispatch after save:
window.dispatchEvent(new CustomEvent('kai-conversations-changed'))

// In useConversationList():
useEffect(() => {
  const handler = () => setConversations(loadConversations())
  window.addEventListener('kai-conversations-changed', handler)
  return () => window.removeEventListener('kai-conversations-changed', handler)
}, [])
```

**Conversation panel** — render as a slide-over portal (not a sidebar — the app likely has no sidebar pattern). Use `createPortal` to mount on `document.body` with a glass-style backdrop.

**Per-message copy** — add a copy-to-clipboard button on each assistant message bubble (appears on hover).

**Follow-up suggestion chips** — after each assistant response, show 2-3 contextual follow-ups based on the response content.

**Export as Markdown** — add a download button per conversation that exports messages as a `.md` file with user/assistant labels.

### 5. SSE Streaming Performance

Three patterns that significantly improve perceived Kai response speed:

#### a) rAF-Batched SSE Deltas

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

// After the SSE loop ends — flush any remaining delta:
if (rafId) cancelAnimationFrame(rafId)
if (pendingDelta) { accumulated += pendingDelta; /* final setMessages */ }
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

#### b) Bypass Next.js Dev Proxy for SSE

The Next.js `rewrites()` dev proxy buffers SSE responses — chunks arrive all at once after the stream completes. In dev mode, hit the backend directly:

```typescript
const CHAT_API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8050' : ''

// In sendMessage:
await readSSEStream(`${CHAT_API_BASE}/api/chat`, ...)
```

In production (Nginx), relative `/api/chat` works fine because Nginx proxies with `proxy_buffering off`.

#### c) Memoize ChatMessage Component

Prevents re-rendering old messages during streaming — only the actively streaming message updates:

```typescript
const ChatMessage = memo(ChatMessageInner, (prev, next) => {
  if (prev.message.content !== next.message.content) return false
  if (prev.isStreaming !== next.isStreaming) return false
  if (prev.isWaiting !== next.isWaiting) return false
  if (prev.isLastAssistant !== next.isLastAssistant) return false
  return true
})
```

#### d) Backend Streaming Headers

Both chat endpoints must include these headers to prevent buffering at every layer:

```python
headers={"Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no"}
```

`X-Accel-Buffering: no` tells Nginx not to buffer. `Cache-Control: no-cache, no-store` prevents intermediate caches from holding the stream.

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

### Adding Kai Checklist

When adding Kai to an existing app, ensure:
- [ ] `httpx>=0.27.0` in `backend/pyproject.toml`
- [ ] `KAI_TOKEN` secret added to Data App (or confirmed `KBC_TOKEN` has Kai permissions)
- [ ] `KBC_URL` secret added to Data App
- [ ] Nginx `location = /` for health probe (not server-level `if`)
- [ ] Nginx `/api/chat` location BEFORE `/api/` with `proxy_buffering off`
- [ ] Backend uses `_stream_kai()` pattern (not async generator with nested context managers)
