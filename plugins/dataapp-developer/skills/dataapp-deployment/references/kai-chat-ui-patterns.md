# Kai Chat UI Patterns (Optional Feature Catalog)

The infrastructure in `kai-deployment.md` provides a working Kai chat proxy. The UI can be as simple as a text input and message list. Below are production-tested UI patterns to adopt selectively based on the app's needs. Each pattern is self-contained — pick and choose independently.

---

## 1. Chat Entry Points

### a) Floating Widget (Bottom-Right Bubble)

A small circular button fixed to the bottom-right corner of every page, toggling a compact chat modal (~480x640px) without leaving the current page.

Key implementation details:
- Use `ReactDOM.createPortal(modal, document.body)` to avoid z-index/stacking issues — `transform`, `filter`, `will-change`, and `overflow:hidden` on parent elements all create new stacking contexts that break `z-index`
- z-index scale: widget button z-996, chat modal z-997
- Icon animates between MessageSquare (closed) and X (open)
- Header actions: History, New Chat, Expand to full page, Close
- Auto-detect page context from URL (e.g., viewing `/group/123?name=Acme` suggests "How is Acme performing?")
- Hide the widget on the dedicated full-page chat route to avoid duplication

### b) Full-Page Chat Route

A dedicated `/assistant` or `/chat` page with full viewport height. Better for long conversations, complex tool chains, and data exploration. Larger message area, more suggestion pills, bigger charts. Include a navigation header with back button to the main app.

### c) Responsive Behavior Between Modes

- **Compact mode:** smaller fonts/padding, max 3 suggestions, max 2 follow-ups
- **Full mode:** full viewport, larger typography, 6 suggestions, 4 follow-ups
- Share state via React Context — switching modes preserves the conversation

---

## 2. Message Display Patterns

### a) Message Bubbles with Role Distinction

- User messages: right-aligned or left-aligned with distinct background color
- Assistant messages: different background, wider max-width
- Sender label above each message ("You" / "Kai" / assistant name)
- Entry animation: fade + slide up + subtle scale (Framer Motion)

### b) Streaming Cursor

- Blinking text cursor (▌) at end of message while streaming
- Stalling detection: if no new content for 1.5s while streaming, show "Still thinking..." indicator
- Elapsed time display next to thinking indicator (e.g., "Working... 12s")

### c) Markdown Rendering

Use `react-markdown` with `remark-gfm` for GitHub-flavored markdown:
- **Internal links** (e.g., `/account/123`): use Next.js `Link` for SPA navigation
- **External URLs**: open in new tab with ExternalLink icon
- **Images**: clickable, opens full-size in new window
- **Tables**: wrap in scrollable container OR pipe to chart component (see section 3)

### d) Copy Button

- Appears on hover over assistant messages
- Click → copies markdown to clipboard → icon changes to checkmark (green) → resets after 2 seconds

---

## 3. Table-to-Chart Visualization

When Kai returns markdown tables, optionally render them as interactive charts.

**Auto-recommend chart type based on data shape:**
- Numeric + categories → Bar chart
- Time series → Line/Area chart
- Parts of whole → Pie chart
- Two numeric axes → Scatter
- Positive/negative values → Waterfall

**Features:**
- Parse markdown table headers and rows into structured data
- Chart type picker with "Recommended" badge on auto-detected type
- Toggle between table view and chart view
- CSV export button (download parsed data)
- "Pin to dashboard" button (app-specific)
- Fullscreen chart mode (portal to `document.body`, dark backdrop)

**Supported chart types:** Bar, Horizontal Bar, Line, Area, Pie, Stacked Bar, Radar, Scatter, Waterfall, Treemap

**Libraries:** `echarts-for-react` (or any charting library that accepts structured data)

---

## 4. Conversation History Panel

### a) Sidebar Modal

- Render as portal at z-999 with backdrop overlay at z-998
- Slide in from left with animation
- Show all saved conversations with: title, message count, relative time ("3m ago", "2w ago")

### b) Features

- Search conversations by title (appears when >3 conversations exist)
- Inline rename (click title → edit field → Enter to save, Escape to cancel)
- Delete with confirmation dialog
- "Clear all conversations" with confirmation
- Export conversation as markdown file download
- Disabled state while streaming (prevent switching mid-response)
- Keyboard: Escape closes panel

### c) Storage

- `localStorage` with key like `kai-conversations`
- Max 50 conversations (oldest auto-pruned)
- Each conversation stores: `id`, `chatId`, `title`, `messages[]`, `createdAt`, `updatedAt`
- Title auto-derived from first user message (first 50-60 chars, cleaned at word boundary)
- Cross-tab sync via `CustomEvent` on storage changes
- Use a custom React hook (`useConversationList`) that listens for storage events

---

## 5. Context-Aware Suggestions

### a) Initial Suggestions (Before First Message)

- Detect current page context from URL
- If viewing a specific entity: suggest questions about that entity ("How is {entity} performing?", "Show {entity} revenue trend")
- If on overview page: suggest high-level questions ("Top accounts by revenue", "Which profit line has best margin?")
- Personalize based on user role (admin sees team performance suggestions)

### b) Follow-Up Suggestions (After Each Response)

Kai can include a `next_actions` code block at the end of responses:

```text
```next_actions
Drill into [specific entity] performance
Compare [X] vs [Y] over time
Show margin breakdown by category
```​
```

The frontend parses and strips this code block from the displayed message, rendering the lines as clickable pills below the response. Fallback: keyword-based suggestions if no code block found (detect "revenue", "margin", "account" etc. in response → generate relevant follow-ups).

### c) UI

- Horizontal scrollable pill row
- Staggered entrance animation (50ms delay between pills)
- Click sends the suggestion text as a new message
- Max pills: 3 in compact mode, 6 in full mode

---

## 6. Tool Execution Progress

### a) Tool Steps Display

A collapsible section showing each tool Kai executes:
- Each step: icon (spinner while running, checkmark when done), friendly name, description
- Friendly name mapping:

| Tool Name | Friendly Label |
|---|---|
| `search` | Searching project items |
| `query_data` | Querying data |
| `get_tables` / `get_table` | Getting table detail |
| `get_buckets` | Browsing storage |
| `get_project_info` | Loading project info |

- Description sourced from `input.justification` field (Kai provides human-readable explanations), truncated at 120 chars
- Left border accent color on running steps

### b) Thinking Indicator

- Animated bouncing dots ("Kai is thinking...")
- Show elapsed time after a few seconds
- Replace tool status display when between tool calls

---

## 7. Tool Approval UI

When Kai needs permission to execute a sensitive operation:

- Yellow/amber warning bar appears above the input area
- Text: "Kai wants to run a tool. Allow?"
- Two buttons: **Approve** (green) and **Deny** (red)
- Input disabled while approval pending
- Streaming paused until user responds
- On approve: send `tool-approval-response` via WebSocket, streaming resumes
- On deny: send denial with reason, Kai acknowledges and continues without the tool

---

## 8. Instant Preview (Dashboard Data)

While waiting for Kai's first response:
- Match entity names in the user's question against cached dashboard data
- If matched: immediately show a quick summary table (Revenue, GP, Margin, etc.)
- Render as markdown table that Kai's response will append to or replace
- Show italic note: "*Querying project data for deeper analysis...*"
- Provides instant feedback before Kai's slower analysis completes

---

## 9. Response Caching

- Cache Kai responses for 5 minutes, keyed by lowercased query text
- On cache hit: show response instantly with "Cached response" badge
- Badge includes refresh button to bypass cache and re-query
- Useful for repeated questions during a session
- Cache is in-memory only (not persisted across page reloads)

---

## 10. Animation & Polish Recommendations

| Element | Animation | Library |
|---|---|---|
| Message entrance | Fade + slide up + subtle scale | Framer Motion |
| Suggestion pills | Staggered appearance (50ms delay each) | Framer Motion |
| Tool step spinner | Continuous rotation (0.8s, linear) | CSS keyframes |
| Thinking dots | Vertical bounce (custom keyframe) | CSS keyframes |
| Streaming cursor | Blink (opacity toggle) | CSS keyframes |
| History panel | Slide from left | CSS transform + transition |
| Widget button | Scale on hover, rotation on open/close | Framer Motion |
| Chart toggle | Height collapse/expand | CSS transition |

---

## 11. Accessibility Baseline

- All interactive elements keyboard-accessible (buttons, input, pills)
- Modal/panel: trap focus, Escape to close
- Tool approval buttons: clear labels, keyboard operable
- Screen reader: `role="status"` on streaming indicator
- Input: `aria-label`, auto-focus on open
- Messages: appropriate ARIA landmarks

---

## 12. Portal & z-Index Strategy

All floating UI must use `ReactDOM.createPortal` to `document.body`. This prevents z-index wars with parent stacking contexts (`transform`, `filter`, `will-change`, `overflow:hidden` all create new stacking contexts).

**z-index scale:**

| Layer | z-index |
|---|---|
| Widget button | 996 |
| Chat modal | 997 |
| Backdrop overlay | 998 |
| History panel | 999 |
| Toast notifications | 1000 |
