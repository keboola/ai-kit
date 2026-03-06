# Component Props Reference

## ChatPanelV9

```ts
type ChatPanelV9Props = {
  /** The conversation data with messages, tool calls, timing */
  conversation: RevenueConversation;
  /** Panel width in pixels (default: 560) */
  width?: number;
  /** Panel height in pixels (default: 620) */
  height?: number;
  /** Show the header with topic dropdown (default: true) */
  showHeader?: boolean;
  /** Show the input area (default: true) */
  showInput?: boolean;
  /** Additional CSS styles */
  style?: React.CSSProperties;
  /** Topic name shown in header dropdown (default: "Revenue Forecasting") */
  topic?: string;
};
```

Internal sub-components:

- `ChatHeader` — topic dropdown, new/expand/close buttons
- `InlineTaskDisplay` — renders a single tool call with TaskIcon, EntityTag, approval buttons
- `MessageText` — typewriter text renderer with markdown (bold) support
- `SuggestedActions` — action buttons with selection animation

## TransformationEditorV9

```ts
type TransformationEditorV9Props = {
  /** Frame when editor enters (spring animation) */
  enterFrame: number;
  /** Frame when editor exits (slide out) */
  exitFrame?: number;
  /** SQL code to display/type */
  sqlCode: string;
  /** Name shown in header */
  transformationName: string;
  /** Frame when SQL typewriter starts */
  typewriterStartFrame: number;
  /** Characters per frame for typewriter (default: 2) */
  charsPerFrame?: number;
  /** Frame when save animation triggers */
  saveFrame?: number;
  /** Panel width (default: 700) */
  width?: number;
  /** Panel height (default: 400) */
  height?: number;
  /** Additional CSS classes */
  className?: string;
  /** Code block name shown in toolbar (default: "Calculate Forecast") */
  blockName?: string;
};
```

## FlowPreviewV9

```ts
type FlowPreviewV9Props = {
  /** Frame when flow panel enters */
  enterFrame: number;
  /** Frame when new task highlights (with ring + "NEW" badge) */
  newTaskFrame?: number;
  /** Frame when panel exits */
  exitFrame?: number;
  /** Panel width (default: 800) */
  width?: number;
  /** Panel height (default: 520) */
  height?: number;
  /** Additional CSS classes */
  className?: string;
  /** Flow name in header (default: "Revenue Analytics") */
  flowName?: string;
  /** Flow type breadcrumb (default: "Conditional Flows") */
  flowType?: string;
};
```

Internal types:

```ts
type PhaseTask = {
  name: string;
  type: "extractor" | "transformation" | "application";
  subType: string;
  isNew?: boolean; // Highlights with ring when true
};
```

## ToastV9

```ts
type ToastV9Props = {
  /** Frame when toast enters (spring from bottom) */
  enterFrame: number;
  /** Frame when toast exits (fade down) */
  exitFrame?: number;
  /** Main toast message */
  message: React.ReactNode;
  /** Secondary details text */
  details?: string;
  /** Color variant (default: "info") */
  variant?: "success" | "error" | "info" | "warning";
  /** Distance from bottom edge in pixels (default: 24) */
  bottomOffset?: number;
};
```

## CursorV8

```ts
type CursorV8Props = {
  /** Frame when cursor fades in */
  appearFrame: number;
  /** Frame when cursor "clicks" (scale + ripple) */
  clickFrame: number;
  /** Frame when cursor fades out (optional) */
  disappearFrame?: number;
  /** Starting position {x, y} */
  startPosition: { x: number; y: number };
  /** Target position {x, y} — cursor moves here via spring */
  endPosition: { x: number; y: number };
};
```

## ScaleIn

```ts
type ScaleInProps = {
  /** Frame to start the entrance animation */
  enterFrame: number;
  /** Direction of scale */
  direction?: "center" | "left" | "right";
  children: React.ReactNode;
};
```

## LogoReveal

```ts
type LogoRevealProps = {
  /** Frame when logo starts animating in */
  enterFrame: number;
};
```
