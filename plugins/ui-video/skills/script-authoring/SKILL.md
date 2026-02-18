---
name: script-authoring
description: Use when user wants to create or modify a video script, define scenes and timing, write conversation data, or understand the script format. Covers the type system, timing math, conversation data format, tool calls, input flow, and critical rendering rules.
---

# Script Authoring Guide

A video script consists of three parts:

1. **Conversation data file** — messages, tool calls, timing constants, scene definitions
2. **Composition component** — React component that orchestrates scenes based on frame
3. **Root.tsx registration** — `<Composition>` entry for the new video

## Script Anatomy

### 1. Conversation Data File

Located at `src/data/<featureName>Conversation.ts`. Contains:

- **Extended types** (if the base types need new fields)
- **Scene timing constants** (frame ranges as a const object)
- **Card/viewport sizes** and positions
- **The conversation data** (messages array with timing)

### 2. Composition Component

Located at `src/KaiVideo<Version>.tsx`. Contains:

- Scene visibility flags based on frame
- Position calculations (animations, slide transitions)
- Component rendering with conditional display
- Cursor interactions for user clicks

### 3. Root Registration

Add a `<Composition>` in `Root.tsx` with the component, fps, frame count, and dimensions.

## The Type System

### Base Types (from `chatConversation.ts`)

```ts
type ChatMessage = {
  role: "user" | "assistant";
  text?: string;
  tasks?: ChatTask[];
  appearFrame: number;
  thinkingUntilFrame?: number;
  typewriter?: boolean;
  typewriterStartFrame?: number;
};

type ChatConversation = {
  messages: ChatMessage[];
  inputValue?: string;
  inputStatus?: "ready" | "typing" | "submitted" | "streaming" | "interrupted";
  inputTypingStartFrame?: number;
  inputFullMessage?: string;
  inputCharsPerFrame?: number;
};
```

### Extended Types (from `revenueNarrativeConversation.ts`)

```ts
type ToolCall = {
  tool: KeboolaTool;
  params?: Record<string, unknown>;
  state: "running" | "success" | "error";
  appearFrame: number;
  completeFrame?: number;
  resultSummary?: string;
  requiresConfirmation?: boolean;
  approvalButtonsAppearFrame?: number;
  approvedFrame?: number;
};

type SuggestedAction = { text: string };

type RevenueMessage = ChatMessage & {
  toolCalls?: ToolCall[];
  suggestedActions?: SuggestedAction[];
  suggestedActionsAppearFrame?: number;
  suggestedActionClickFrame?: number;
  suggestedActionClickedIndex?: number;
};

type RevenueConversation = Omit<ChatConversation, "messages"> & {
  messages: RevenueMessage[];
  inputSentFrame?: number;
};
```

See [references/type-reference.md](references/type-reference.md) for the complete type definitions.

## Timing Math

- **30 fps** — 1 second = 30 frames
- **60 seconds** = 1800 frames (typical video length)
- Scenes are defined as frame ranges in a const object

```ts
export const SCENES = {
  userQuery: {
    start: 0,
    chatEnter: 15, // Chat panel slides in
    userTypingStart: 45, // User starts typing in input
    userTypingEnd: 200, // User finishes typing
    end: 270, // 9 seconds
  },
  kaiResponse: {
    start: 270,
    thinkingStart: 275,
    tool1Start: 285,
    tool1Complete: 340,
    // ...
    end: 600, // 20 seconds
  },
};
```

See [references/timing-guide.md](references/timing-guide.md) for the timing cheat sheet.

## Critical Rules

### 1. User Messages MUST Type in Input First

User messages follow this flow:

1. Text appears character-by-character in the input box (`inputTypingStartFrame`)
2. Cursor moves to send button and clicks
3. Input clears (`inputSentFrame`)
4. Message appears as a chat bubble (`message.appearFrame`)

```ts
// In conversation data:
{
  inputTypingStartFrame: 45,    // Start typing in input
  inputSentFrame: 220,          // Input clears after send
  messages: [{
    role: 'user',
    text: "Can you forecast our Q1 revenue?",
    appearFrame: 220,            // Bubble appears AFTER send
    typewriter: false,           // Already typed in input, no typewriter in bubble
  }],
}
```

### 2. Every Button Click MUST Have a Visible Cursor

Use `CursorV8` for every interactive element:

- Send button clicks
- Suggested action selections
- Approval button clicks

The cursor must appear 30-60 frames before the click, move to the target, click with ripple, then disappear.

### 3. Tool Calls Render Inline, NOT as Toasts

Tool calls appear inside `MessageBubble` as `InlineTaskDisplay` components, showing:

- A spinning/check TaskIcon
- The tool name and parameters
- An EntityTag with the result summary
- Approval buttons for write tools (`requiresConfirmation: true`)

### 4. NO CSS Transitions or useEffect

**Remotion renders each frame independently.** There is no runtime between frames.

- `CSS transition` — DOES NOT WORK. Properties won't animate.
- `useEffect` + `scrollTop` — DOES NOT WORK. DOM mutations are lost between frames.
- `animate-*` Tailwind classes — DOES NOT WORK.

**Always use**: `transform: translateY(-${scrollOffset}px)` driven by frame-based calculations.

### 5. TypeScript `as const` Pitfall

`as const` produces literal types. If you declare a const and later reassign a `let` variable from `interpolate()`, TypeScript will complain.

```ts
// BAD: chatX gets literal type from V8_CHAT_POSITIONS
const chatX = V8_CHAT_POSITIONS.center.x; // type: 430 (literal)

// GOOD: Use `: number` annotation for variables that will be reassigned
let chatX: number = V8_CHAT_POSITIONS.center.x;
chatX = interpolate(...); // OK
```

### 6. Scroll Must Be Frame-Based

Use pure `transform: translateY(-${offset}px)` calculated from frame and content heights. The `calculateScrollOffset()` function in ChatPanelV9 shows the pattern.

## References

- [references/type-reference.md](references/type-reference.md) — Complete type definitions
- [references/timing-guide.md](references/timing-guide.md) — Frame calculation cheat sheet
- [references/example-revenue-script.md](references/example-revenue-script.md) — Annotated example
