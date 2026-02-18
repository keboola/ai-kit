# Type Reference

Complete type definitions for the video script system.

## Base Types (`chatConversation.ts`)

```ts
/** A task displayed inline in a message */
type ChatTask = {
  label: string;
  entities?: string[];
  state?: "processing" | "done" | "error";
  justification?: string;
  appearFrame?: number;
  completeFrame?: number;
};

/** A single chat message */
type ChatMessage = {
  role: "user" | "assistant";
  text?: string;
  tasks?: ChatTask[];
  /** Frame when this message appears in the chat */
  appearFrame: number;
  /** Frame until which the thinking indicator is shown */
  thinkingUntilFrame?: number;
  /** Whether to use typewriter effect for the text */
  typewriter?: boolean;
  /** Frame when typewriter starts (defaults to appearFrame) */
  typewriterStartFrame?: number;
};

/** The full conversation state */
type ChatConversation = {
  messages: ChatMessage[];
  inputValue?: string;
  inputStatus?: "ready" | "typing" | "submitted" | "streaming" | "interrupted";
  /** Frame when user starts typing in the input box */
  inputTypingStartFrame?: number;
  /** The full text that will be typed */
  inputFullMessage?: string;
  /** Characters revealed per frame (default: 1.5) */
  inputCharsPerFrame?: number;
};
```

## Extended Types (`revenueNarrativeConversation.ts`)

### Tool Names

```ts
/** Valid Keboola MCP tool names */
type KeboolaTool =
  | "query_data"
  | "get_tables"
  | "get_buckets"
  | "run_job"
  | "create_sql_transformation"
  | "modify_flow"
  | "get_configs"
  | "create_config";
```

### Tool Call

```ts
type ToolCallState = "running" | "success" | "error";

type ToolCall = {
  /** The MCP tool being called */
  tool: KeboolaTool;
  /** Tool parameters (displayed in collapsed details) */
  params?: Record<string, unknown>;
  /** Current state of the tool call */
  state: ToolCallState;
  /** Frame when tool call appears */
  appearFrame: number;
  /** Frame when tool call completes */
  completeFrame?: number;
  /** Summary of the result */
  resultSummary?: string;
  /** Whether results are collapsed */
  isCollapsed?: boolean;
  /** Whether this tool requires user confirmation (write tools) */
  requiresConfirmation?: boolean;
  /** Frame when approval buttons appear */
  approvalButtonsAppearFrame?: number;
  /** Frame when user approves (clicks Approve) */
  approvedFrame?: number;
};
```

### Suggested Action

```ts
type SuggestedAction = {
  text: string;
};
```

### Extended Message

```ts
type RevenueMessage = ChatMessage & {
  /** Tool calls for this message (replaces generic tasks) */
  toolCalls?: ToolCall[];
  /** Suggested action buttons to display after message */
  suggestedActions?: SuggestedAction[];
  /** Frame when suggested actions appear */
  suggestedActionsAppearFrame?: number;
  /** Frame when a suggested action is clicked */
  suggestedActionClickFrame?: number;
  /** Index of clicked suggested action */
  suggestedActionClickedIndex?: number;
};
```

### Extended Conversation

```ts
type RevenueConversation = Omit<ChatConversation, "messages"> & {
  messages: RevenueMessage[];
  /** Frame when the input message is "sent" and clears */
  inputSentFrame?: number;
};
```

## Scene Constants

Scene timing is defined as a nested const object:

```ts
const SCENES = {
  sceneName: {
    start: number;      // First frame of scene
    // ... scene-specific events
    end: number;        // Last frame of scene
  },
};
```

## Viewport & Layout Constants

```ts
const VIEWPORT = { width: 1280, height: 720, centerX: 640, centerY: 360 };

const CARD_SIZES = {
  chat: { width: 560, height: 620 },
  chatExpanded: { width: 440, height: 620 },
  flowPanel: { width: 800, height: 520 },
  transformationEditor: { width: 700, height: 400 },
  logo: { width: 300, height: 150 },
};
```

These can be adjusted per video. The `chatExpanded` size is used when the chat slides left to make room for a side panel.
