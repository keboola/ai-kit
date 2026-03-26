# Kai for Next.js / React Apps

Frontend patterns for embedding Kai AI Assistant into Next.js data apps.

For backend proxy, SSE events, credentials, and Nginx config, see `references/kai-core.md`.
For production UX enhancements (thinking indicator, abort, conversation management, charts), see `references/kai-production-ux.md`.

---

## Architecture: KaiChatProvider

All Kai chat state lives in a single React Context. Both the floating widget and the full-page `/assistant` route consume the same context — no duplicate state.

```typescript
// contexts/KaiChatContext.tsx
'use client'

import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface PendingApproval {
  approvalId: string
  toolCallId: string
}

interface ToolStatus {
  toolName: string
  label: string
  startedAt: number
}

interface KaiChatContextValue {
  messages: Message[]
  chatId: string
  isStreaming: boolean
  isOpen: boolean
  toolStatus: ToolStatus | null
  pendingApproval: PendingApproval | null
  sendMessage: (text: string) => Promise<void>
  abort: () => void
  newChat: () => void
  setIsOpen: (open: boolean) => void
  loadConversation: (id: string) => void
}

const KaiChatContext = createContext<KaiChatContextValue | null>(null)

export function useKaiChat() {
  const ctx = useContext(KaiChatContext)
  if (!ctx) throw new Error('useKaiChat must be used within KaiChatProvider')
  return ctx
}

// SSE API base — bypass Next.js dev proxy which buffers SSE
const CHAT_API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8050' : ''

export function KaiChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [chatId, setChatId] = useState(() => crypto.randomUUID())
  const [isStreaming, setIsStreaming] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [toolStatus, setToolStatus] = useState<ToolStatus | null>(null)
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const toolNamesRef = useRef<Record<string, string>>({})

  // ─── SSE Stream Reader ──────────────────────────────────────────────
  const readSSEStream = useCallback(async (
    url: string,
    options: RequestInit,
    onDelta: (text: string) => void,
    onToolEvent?: (type: string, data: any) => void,
    onToolApproval?: (approval: PendingApproval) => void,
  ) => {
    const res = await fetch(url, options)
    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(
        res.status === 401 ? 'Your token may not have AI permissions. Check KAI_TOKEN in Data App secrets.' :
        res.status === 403 ? 'Access denied — check project permissions.' :
        res.status >= 500 ? 'Server error. Please try again in a moment.' :
        errorText
      )
    }

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
            } else if (data.type === 'tool-input-start' && onToolEvent) {
              onToolEvent('tool-input-start', data)
            } else if (data.type === 'tool-input-available' && onToolEvent) {
              onToolEvent('tool-input-available', data)
            } else if (data.type === 'tool-output-available' && onToolEvent) {
              onToolEvent('tool-output-available', data)
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
  }, [])

  // ─── Send Message ───────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)
    setToolStatus(null)

    const controller = new AbortController()
    abortRef.current = controller

    let accumulated = ''
    const assistantId = crypto.randomUUID()
    setMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', timestamp: Date.now(),
    }])

    // rAF-batched delta flushing
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

    try {
      await readSSEStream(
        `${CHAT_API_BASE}/api/chat`,
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
          signal: controller.signal,
        },
        // onDelta — rAF batched
        (delta) => {
          pendingDelta += delta
          if (!rafId) rafId = requestAnimationFrame(flushDelta)
        },
        // onToolEvent
        (type, data) => {
          const callId = data.toolCallId || ''
          const name = data.toolName || toolNamesRef.current[callId]
          if (data.toolName) toolNamesRef.current[callId] = data.toolName

          if (type === 'tool-input-start') {
            setToolStatus({ toolName: name || 'tool', label: `Searching ${name || ''}...`, startedAt: Date.now() })
          } else if (type === 'tool-input-available') {
            setToolStatus(prev => prev ? { ...prev, label: `Running ${name || 'query'}...` } : null)
          } else if (type === 'tool-output-available') {
            setToolStatus(null)
          }
        },
        // onToolApproval
        (approval) => setPendingApproval(approval),
      )
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        accumulated += accumulated ? `\n\n---\n\n${err.message}` : err.message
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], content: accumulated }
          return next
        })
      }
    } finally {
      // Flush remaining delta
      if (rafId) cancelAnimationFrame(rafId)
      if (pendingDelta) {
        accumulated += pendingDelta
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], content: accumulated }
          return next
        })
      }
      setIsStreaming(false)
      setToolStatus(null)
      abortRef.current = null
    }
  }, [chatId, isStreaming, readSSEStream])

  // ─── Abort ──────────────────────────────────────────────────────────
  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // ─── New Chat ───────────────────────────────────────────────────────
  const newChat = useCallback(() => {
    setChatId(crypto.randomUUID())
    setMessages([])
    setToolStatus(null)
    setPendingApproval(null)
    toolNamesRef.current = {}
  }, [])

  // ─── Load Conversation ──────────────────────────────────────────────
  const loadConversation = useCallback((id: string) => {
    // Implementation in kai-production-ux.md (conversation persistence)
    // This is the hook point — populate messages from localStorage
  }, [])

  return (
    <KaiChatContext.Provider value={{
      messages, chatId, isStreaming, isOpen, toolStatus, pendingApproval,
      sendMessage, abort, newChat, setIsOpen, loadConversation,
    }}>
      {children}
    </KaiChatContext.Provider>
  )
}
```

Add `KaiChatProvider` to your app's providers:
```typescript
// app/providers.tsx
import { KaiChatProvider } from '@/contexts/KaiChatContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <KaiChatProvider>
        {children}
      </KaiChatProvider>
    </QueryClientProvider>
  )
}
```

---

## Floating Chat Widget

Always-visible chat bubble in the bottom-right corner of every page (except `/assistant`). Portal-rendered so it floats above all app content.

```typescript
// components/kai/KaiWidget.tsx
'use client'

import { useKaiChat } from '@/contexts/KaiChatContext'
import { usePathname, useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import KaiChatPanel from './KaiChatPanel'

export default function KaiWidget() {
  const { isOpen, setIsOpen, isStreaming } = useKaiChat()
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Hide widget on full-page assistant route
  if (pathname === '/assistant') return null
  if (!mounted) return null

  return createPortal(
    <>
      {/* Floating bubble */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-[35] w-14 h-14 rounded-full
                       bg-brand-primary text-white shadow-lg shadow-brand-primary/25
                       flex items-center justify-center"
            aria-label="Open Kai AI Assistant"
          >
            {isStreaming ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed bottom-6 right-6 z-[35] w-[420px] h-[600px] max-h-[80vh]
                       rounded-2xl overflow-hidden shadow-2xl shadow-black/15
                       border border-border bg-white flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3
                            bg-brand-primary text-white">
              <span className="font-semibold text-sm">Kai AI Assistant</span>
              <div className="flex items-center gap-1">
                {/* Expand to full page */}
                <button
                  onClick={() => { setIsOpen(false); router.push('/assistant') }}
                  className="p-1.5 rounded-md hover:bg-white/15 transition-colors"
                  aria-label="Expand to full page"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                </button>
                {/* Close */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-md hover:bg-white/15 transition-colors"
                  aria-label="Close chat"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Chat content */}
            <KaiChatPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  )
}
```

Add the widget to your root layout so it appears on every page:
```typescript
// app/layout.tsx (inside Providers)
import KaiWidget from '@/components/kai/KaiWidget'

// Inside the body:
<Providers>
  {children}
  <KaiWidget />
</Providers>
```

---

## KaiChatPanel — Shared Chat UI

This component renders the actual chat interface. Used by both the floating widget and the full-page assistant.

```typescript
// components/kai/KaiChatPanel.tsx
'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useKaiChat } from '@/contexts/KaiChatContext'

// ─── Chat Message (memoized) ──────────────────────────────────────────
const ChatMessage = memo(function ChatMessage({
  message,
  isStreaming,
  isLastAssistant,
}: {
  message: { role: string; content: string }
  isStreaming: boolean
  isLastAssistant: boolean
}) {
  return (
    <div className={`flex flex-col gap-1 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
      {/* Sender label */}
      <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground/60 px-1">
        {message.role === 'user' ? 'YOU' : 'KAI'}
      </span>
      <div
        className={`max-w-[85%] px-4 py-3 rounded-xl text-sm leading-relaxed ${
          message.role === 'user'
            ? 'bg-brand-primary/10 text-brand-secondary'
            : 'bg-surface border border-border'
        }`}
      >
        {/* Content — for production, use ReactMarkdown (see kai-production-ux.md) */}
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.role === 'assistant' && isStreaming && isLastAssistant && (
          <span className="inline-block w-0.5 h-4 bg-brand-primary animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  )
}, (prev, next) => {
  if (prev.message.content !== next.message.content) return false
  if (prev.isStreaming !== next.isStreaming) return false
  if (prev.isLastAssistant !== next.isLastAssistant) return false
  return true
})

// ─── Chat Panel ───────────────────────────────────────────────────────
export default function KaiChatPanel() {
  const { messages, isStreaming, toolStatus, sendMessage, abort } = useKaiChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef<number | null>(null)

  // rAF-debounced scroll
  const scheduleScroll = useCallback(() => {
    if (scrollRafRef.current) return
    scrollRafRef.current = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      scrollRafRef.current = null
    })
  }, [])

  useEffect(scheduleScroll, [messages, scheduleScroll])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground/60 mt-8">
            Ask Kai anything about your data
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isStreaming={isStreaming}
            isLastAssistant={msg.role === 'assistant' && i === messages.length - 1}
          />
        ))}

        {/* Thinking indicator */}
        {toolStatus && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <span className="w-3 h-3 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
            <span>{toolStatus.label}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 px-4 py-3 border-t border-border">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Kai about your data..."
          disabled={isStreaming}
          className="flex-1 px-4 py-2 text-sm border border-border rounded-lg bg-white
                     focus:border-brand-primary focus:outline-none disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={abort}
            className="px-4 py-2 text-sm font-semibold bg-negative text-white rounded-lg hover:opacity-90"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 text-sm font-semibold bg-brand-primary text-white rounded-lg
                       hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        )}
      </form>
    </>
  )
}
```

---

## Full-Page Assistant Route

The `/assistant` page provides an expanded Kai experience. The widget's "expand" button navigates here.

```typescript
// app/assistant/page.tsx
'use client'

import Header from '@/components/layout/Header'
import NavTabs from '@/components/layout/NavTabs'
import KaiChatPanel from '@/components/kai/KaiChatPanel'

export default function AssistantPage() {
  return (
    <>
      <Header title="AI Assistant" />
      <NavTabs />
      <main className="relative z-1 pt-[100px] max-w-4xl mx-auto h-[calc(100vh-100px)] flex flex-col">
        <KaiChatPanel />
      </main>
    </>
  )
}
```

Add "AI Assistant" tab to your `NavTabs` component pointing to `/assistant`.

---

## Nginx Config

For the Nginx configuration required for SSE streaming, see `references/kai-core.md` > "Nginx: Health Probe + SSE Support". The key requirement is `proxy_buffering off` on the `/api/chat` location.
