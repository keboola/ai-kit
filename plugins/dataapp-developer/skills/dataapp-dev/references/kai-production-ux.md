# Kai Production UX Enhancements

Universal production patterns for Kai-integrated Next.js apps. Apply these to every Kai integration — they are not optional.

For backend proxy and SSE events, see `references/kai-core.md`.
For base components (KaiChatProvider, widget, panel), see `references/kai-nextjs.md`.

---

## 1. Thinking Indicator with Elapsed Time

Shows what Kai is doing during tool calls with a live timer.

```typescript
// components/kai/ThinkingIndicator.tsx
'use client'

import { useState, useEffect, useRef } from 'react'

interface ThinkingIndicatorProps {
  toolStatus: { toolName: string; label: string; startedAt: number } | null
  isStreaming: boolean
  lastDeltaAt: number  // timestamp of last text-delta received
}

export default function ThinkingIndicator({ toolStatus, isStreaming, lastDeltaAt }: ThinkingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0)
  const [stalled, setStalled] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Live elapsed timer during tool calls
  useEffect(() => {
    if (!toolStatus) { setElapsed(0); return }
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - toolStatus.startedAt) / 1000))
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [toolStatus])

  // Stalled detection: 1.5s with no new text during streaming → show indicator
  useEffect(() => {
    if (!isStreaming || toolStatus) { setStalled(false); return }
    const timer = setTimeout(() => setStalled(true), 1500)
    return () => clearTimeout(timer)
  }, [lastDeltaAt, isStreaming, toolStatus])

  if (!toolStatus && !stalled) return null

  const label = toolStatus?.label || 'Thinking...'
  const showTimer = toolStatus && elapsed > 0

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground/70 px-1 py-2">
      <span className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      <span>{label}</span>
      {showTimer && (
        <span className="tabular-nums text-muted-foreground/50">{elapsed}s</span>
      )}
    </div>
  )
}
```

### Tool Name → Label Mapping

Map tool names to human-readable labels in your KaiChatProvider:

```typescript
function toolLabel(type: 'start' | 'input' | 'output', name: string): string {
  const labels: Record<string, [string, string]> = {
    get_tables:      ['Searching tables...', 'Found tables'],
    query_data:      ['Preparing query...', 'Running SQL query...'],
    search:          ['Searching project...', 'Analyzing results...'],
    get_buckets:     ['Listing buckets...', 'Processing buckets...'],
    get_table:       ['Loading table schema...', 'Schema loaded'],
  }
  const [startLabel, inputLabel] = labels[name] || [`Working on ${name}...`, `Processing ${name}...`]
  return type === 'start' ? startLabel : type === 'input' ? inputLabel : ''
}
```

---

## 2. Streaming Abort (Stop Button)

Already wired in `KaiChatProvider` (see `kai-nextjs.md`). The abort button:
- Appears as a red "Stop" button replacing "Send" during streaming
- Uses `AbortController` to cancel the SSE fetch
- Flushes any pending rAF delta before closing
- The interrupted message stays visible with whatever was accumulated

In `KaiChatPanel.tsx` (already included in `kai-nextjs.md`):
```typescript
{isStreaming ? (
  <button type="button" onClick={abort}
    className="px-4 py-2 text-sm font-semibold bg-negative text-white rounded-lg hover:opacity-90">
    Stop
  </button>
) : (
  <button type="submit" disabled={!input.trim()}
    className="px-4 py-2 text-sm font-semibold bg-brand-primary text-white rounded-lg hover:opacity-90 disabled:opacity-40">
    Send
  </button>
)}
```

---

## 3. Sender Labels

"YOU" / "KAI" labels above each message bubble (already in `KaiChatPanel` from `kai-nextjs.md`):
```typescript
<span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground/60 px-1">
  {message.role === 'user' ? 'YOU' : 'KAI'}
</span>
```

---

## 4. Copy-to-Clipboard

Hover button on assistant messages:

```typescript
// In ChatMessage component:
const [copied, setCopied] = useState(false)

async function handleCopy() {
  await navigator.clipboard.writeText(message.content)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}

// Add to the assistant message bubble wrapper:
{message.role === 'assistant' && (
  <button
    onClick={handleCopy}
    className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2
               p-1.5 rounded-md bg-white/80 hover:bg-white border border-border text-xs"
    aria-label="Copy message"
  >
    {copied ? '✓' : 'Copy'}
  </button>
)}
```

Make the message wrapper a `group` class: `className="relative group ..."`

---

## 5. Friendly Error Messages

Error mapping is built into `readSSEStream` in `KaiChatProvider` (see `kai-nextjs.md`):

```typescript
if (!res.ok) {
  const errorText = await res.text()
  throw new Error(
    res.status === 401 ? 'Your token may not have AI permissions. Check KAI_TOKEN in Data App secrets.' :
    res.status === 403 ? 'Access denied — check project permissions.' :
    res.status >= 500 ? 'Server error. Please try again in a moment.' :
    errorText
  )
}
```

Display errors inline in the assistant message. The error text is appended to the accumulated content in the catch block.

---

## 6. Markdown Rendering

Install dependencies:
```bash
npm install react-markdown remark-gfm
```

Replace plain text rendering in `ChatMessage` with:
```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// In the message bubble:
<div className="kai-prose">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
</div>
```

Add `kai-prose` CSS to `globals.css`:
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
.kai-prose img { max-width: 100%; border-radius: 8px; margin: 0.75em 0; }
```

---

## 7. Smart Link Rendering

Custom renderer for react-markdown that renders internal routes as Next.js `<Link>` pill badges and external links with icons:

```typescript
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

// Custom components for ReactMarkdown:
const markdownComponents = {
  a: ({ href, children }: { href?: string; children: React.ReactNode }) => {
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
  },
}

// Usage:
<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
  {message.content}
</ReactMarkdown>
```

---

## 8. Inline Image Rendering

Markdown images render with rounded corners (handled by the `.kai-prose img` CSS rule above):
```css
.kai-prose img { max-width: 100%; border-radius: 8px; margin: 0.75em 0; }
```

No additional component customization needed — react-markdown renders `<img>` tags natively.

---

## 9. Conversation Persistence

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
  while (all.length > MAX_CONVERSATIONS) all.pop()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  window.dispatchEvent(new CustomEvent('kai-conversations-changed'))
}

export function loadConversations(): StoredConversation[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

export function deleteConversation(id: string) {
  const all = loadConversations().filter(c => c.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  window.dispatchEvent(new CustomEvent('kai-conversations-changed'))
}

export function renameConversation(id: string, title: string) {
  const all = loadConversations()
  const conv = all.find(c => c.id === id)
  if (conv) conv.title = title
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  window.dispatchEvent(new CustomEvent('kai-conversations-changed'))
}

export function clearAllConversations() {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent('kai-conversations-changed'))
}

export function deriveTitle(messages: Message[]): string {
  const first = messages.find(m => m.role === 'user')
  return first?.content.slice(0, 60) || 'New conversation'
}

export function exportAsMarkdown(conv: StoredConversation): string {
  return conv.messages.map(m =>
    `### ${m.role === 'user' ? 'You' : 'Kai'}\n\n${m.content}\n`
  ).join('\n---\n\n')
}
```

Save after each completed response using `requestAnimationFrame` to avoid blocking:
```typescript
// In KaiChatProvider, after streaming completes:
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

---

## 10. Conversation Management

### Reactive Conversation List Hook

```typescript
// hooks/useConversationList.ts
import { useState, useEffect } from 'react'
import { loadConversations, type StoredConversation } from '@/lib/chat-storage'

export function useConversationList() {
  const [conversations, setConversations] = useState<StoredConversation[]>([])

  useEffect(() => {
    setConversations(loadConversations())
    const handler = () => setConversations(loadConversations())
    window.addEventListener('kai-conversations-changed', handler)
    return () => window.removeEventListener('kai-conversations-changed', handler)
  }, [])

  return conversations
}
```

### History Panel

Render as a slide-over portal with glassmorphism backdrop:

```typescript
// components/kai/ConversationHistory.tsx
'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useConversationList } from '@/hooks/useConversationList'
import { deleteConversation, renameConversation, clearAllConversations, exportAsMarkdown } from '@/lib/chat-storage'

interface Props {
  isOpen: boolean
  onClose: () => void
  onLoadConversation: (id: string) => void
}

export default function ConversationHistory({ isOpen, onClose, onLoadConversation }: Props) {
  const conversations = useConversationList()
  const [search, setSearch] = useState('')

  const filtered = search
    ? conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[36] bg-black/20 backdrop-blur-sm"
          />
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-[37] w-80 bg-white/95 backdrop-blur-lg
                       border-l border-border shadow-2xl flex flex-col"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm">Conversation History</h3>
              <button onClick={onClose} className="p-1 rounded hover:bg-surface">✕</button>
            </div>

            {/* Search (appears when >3 conversations) */}
            {conversations.length > 3 && (
              <div className="px-4 pt-3">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full px-3 py-1.5 text-sm border border-border rounded-lg"
                />
              </div>
            )}

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-2">
              {filtered.map(conv => (
                <div key={conv.id}
                  className="p-3 rounded-lg hover:bg-surface cursor-pointer group relative"
                  onClick={() => { onLoadConversation(conv.id); onClose() }}
                >
                  <div className="text-sm font-medium truncate">{conv.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(conv.updatedAt).toLocaleDateString()} · {conv.messages.length} messages
                  </div>
                  {/* Actions */}
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1">
                    <button onClick={e => { e.stopPropagation(); const blob = new Blob([exportAsMarkdown(conv)], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${conv.title}.md`; a.click() }}
                      className="p-1 text-xs rounded hover:bg-border" title="Export">↓</button>
                    <button onClick={e => { e.stopPropagation(); deleteConversation(conv.id) }}
                      className="p-1 text-xs rounded hover:bg-negative/10 text-negative" title="Delete">✕</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Clear all */}
            {conversations.length > 0 && (
              <div className="p-3 border-t border-border">
                <button onClick={clearAllConversations}
                  className="w-full text-xs text-negative/70 hover:text-negative py-1">
                  Clear all conversations
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
```

---

## 11. Response Caching

Cache identical questions within 5 minutes for instant responses:

```typescript
// lib/response-cache.ts
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes

interface CachedResponse {
  question: string
  response: string
  timestamp: number
}

const cache = new Map<string, CachedResponse>()

export function getCachedResponse(question: string): string | null {
  const key = question.trim().toLowerCase()
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.response
}

export function setCachedResponse(question: string, response: string) {
  const key = question.trim().toLowerCase()
  cache.set(key, { question, response, timestamp: Date.now() })
}
```

In `KaiChatProvider.sendMessage()`, check cache before streaming:
```typescript
const cached = getCachedResponse(text)
if (cached) {
  setMessages(prev => [...prev,
    { id: crypto.randomUUID(), role: 'assistant', content: cached, timestamp: Date.now() },
  ])
  // Show a "Refresh" button to re-ask
  return
}
// ... normal SSE streaming
// After streaming completes:
setCachedResponse(text, accumulated)
```

---

## 12. Context-Aware Widget

Detect the current page from the URL and inject relevant context:

```typescript
// hooks/usePageContext.ts
import { usePathname } from 'next/navigation'

export function usePageContext() {
  const pathname = usePathname()

  // CUSTOMIZE: Map your routes to context descriptions
  if (pathname.startsWith('/account/')) {
    const id = pathname.split('/')[2]
    return { page: 'account', entityId: id, placeholder: `Ask about this account...`, context: `User is viewing account ${id}.` }
  }
  if (pathname.startsWith('/group/')) {
    const id = pathname.split('/')[2]
    return { page: 'group', entityId: id, placeholder: `Ask about this group...`, context: `User is viewing group ${id}.` }
  }
  if (pathname === '/') {
    return { page: 'dashboard', entityId: null, placeholder: 'Ask about your KPIs and trends...', context: 'User is on the main dashboard.' }
  }
  return { page: 'general', entityId: null, placeholder: 'Ask Kai about your data...', context: '' }
}
```

Use in `KaiChatPanel.tsx` to customize the input placeholder and inject context into system message.

---

## 13. Context-Aware Suggestions

Empty state chips change based on the current page:

```typescript
// hooks/useContextSuggestions.ts
import { useMemo } from 'react'
import { usePageContext } from './usePageContext'

export function useContextSuggestions() {
  const { page, entityId } = usePageContext()

  return useMemo(() => {
    // CUSTOMIZE: Adapt suggestions to your app's data model
    switch (page) {
      case 'account':
        return [
          'How is this account performing?',
          'Show revenue trend for this account',
          'Compare with similar accounts',
        ]
      case 'group':
        return [
          'Summarize this group\'s performance',
          'Which accounts need attention?',
          'Show margin breakdown',
        ]
      case 'dashboard':
        return [
          'What are the key trends this quarter?',
          'Which groups are growing fastest?',
          'Show me accounts at risk',
        ]
      default:
        return [
          'What data is available?',
          'Show me an overview',
          'What are the key metrics?',
        ]
    }
  }, [page, entityId])
}
```

Render in the empty state of `KaiChatPanel`:
```typescript
import { useContextSuggestions } from '@/hooks/useContextSuggestions'
import { motion } from 'framer-motion'

const suggestions = useContextSuggestions()

// In the empty state:
{messages.length === 0 && (
  <div className="flex flex-wrap gap-2 mt-4 justify-center">
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
  </div>
)}
```

---

## 14. Follow-up Suggestions from Kai

### System Context Instruction

Add to the system context that gets prepended to the first message:

```typescript
const systemContext = `${pageContext} Respond helpfully. At the end of your response, include a code block labeled \`next_actions\` with 2-3 follow-up suggestions as a JSON array of strings. Example:\n\`\`\`next_actions\n["Show trend over time", "Break down by region", "Export this data"]\n\`\`\``
```

### Frontend Parser

Parse `next_actions` from the response and strip from display:

```typescript
// lib/parse-next-actions.ts
export function parseNextActions(content: string): { cleanContent: string; suggestions: string[] } {
  const regex = /```next_actions\n(\[[\s\S]*?\])\n```/
  const match = content.match(regex)

  if (match) {
    try {
      const suggestions = JSON.parse(match[1]) as string[]
      const cleanContent = content.replace(regex, '').trimEnd()
      return { cleanContent, suggestions }
    } catch {}
  }

  // Fallback: keyword-based suggestions
  return {
    cleanContent: content,
    suggestions: generateFallbackSuggestions(content),
  }
}

function generateFallbackSuggestions(content: string): string[] {
  const suggestions: string[] = []
  const lower = content.toLowerCase()
  if (lower.includes('revenue') || lower.includes('sales')) suggestions.push('Show trend over time')
  if (lower.includes('table') || lower.includes('data')) suggestions.push('Break this down further')
  if (lower.includes('group') || lower.includes('account')) suggestions.push('Compare with others')
  suggestions.push('Tell me more')
  return suggestions.slice(0, 3)
}
```

After streaming completes, parse and display:
```typescript
const { cleanContent, suggestions } = parseNextActions(accumulated)
// Update the message with clean content (stripped of next_actions block)
setMessages(prev => {
  const next = [...prev]
  next[next.length - 1] = { ...next[next.length - 1], content: cleanContent }
  return next
})
setFollowUps(suggestions)
```

Render follow-ups as animated pills below the last message (same pattern as suggestion chips in section 13).

---

## 15. SSE Streaming Performance

Three patterns that significantly improve perceived Kai response speed. All are already integrated into `KaiChatProvider` in `kai-nextjs.md`, but documented here for reference.

### a) rAF-Batched SSE Deltas

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
    next[next.length - 1] = { ...next[next.length - 1], content: accumulated }
    return next
  })
  rafId = null
}

// In the SSE onDelta callback:
pendingDelta += delta
if (!rafId) rafId = requestAnimationFrame(flushDelta)

// After the SSE loop ends — flush any remaining delta:
if (rafId) cancelAnimationFrame(rafId)
if (pendingDelta) { accumulated += pendingDelta; /* final setMessages */ }
```

### b) Bypass Next.js Dev Proxy for SSE

The Next.js `rewrites()` dev proxy buffers SSE responses. In dev mode, hit the backend directly:

```typescript
const CHAT_API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8050' : ''
```

### c) Memoize ChatMessage Component

Already in `KaiChatPanel` (see `kai-nextjs.md`). Custom comparator skips re-rendering old messages:

```typescript
const ChatMessage = memo(ChatMessageInner, (prev, next) => {
  if (prev.message.content !== next.message.content) return false
  if (prev.isStreaming !== next.isStreaming) return false
  if (prev.isLastAssistant !== next.isLastAssistant) return false
  return true
})
```

### d) rAF-Debounced Scroll

Also in `KaiChatPanel` — scrollIntoView fires at most once per frame:
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

### e) Backend Streaming Headers

Both chat endpoints must include these headers to prevent buffering at every layer:

```python
headers={"Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no"}
```

`X-Accel-Buffering: no` tells Nginx not to buffer. `Cache-Control: no-cache, no-store` prevents intermediate caches.

---

## 16. Dynamic System Context

**Keep system context concise (~200 chars max).** Large system contexts (2000+ chars) confuse Kai — it focuses on formatting instead of querying project data.

```typescript
// CUSTOMIZE: Build from your app's live data
function buildSystemContext(kpis: KpiResponse, me: UserMeResponse) {
  return `[Context: Revenue: ${formatCurrency(kpis.total_revenue)} (${formatDelta(kpis.delta_revenue_pct)} YoY), GP Margin: ${formatPercent(kpis.gp_margin_pct)}, ${groups?.length ?? 0} customer groups. User: ${me.role}. Use your tools to query the project data.]`
}
```

**What NOT to include:** full account/group ID lookup tables, Keboola URL templates, multi-line link formatting instructions, detailed role descriptions.

Prepend to the first message's parts:
```typescript
parts: [
  { type: 'text', text: systemContext },  // hidden context — ~200 chars
  { type: 'text', text: userMessage },    // visible message
]
```

---

## 17. Backend: /api/platform Endpoint

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
