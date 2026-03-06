---
name: video-components
description: Use when user needs to know which UI components are available for videos, their props, how to use them, or how to extend with new panel types. Covers V9 components, real production imports, layout helpers, cursor patterns, and extension guidelines.
---

# Video Components Guide

The V9 component system uses **real production components** from `@keboola/design` and `@kbc-ui` (via webpack alias), controlled by Remotion's frame-based timing.

## Available V9 Components

### ChatPanelV9

The main chat interface. Renders messages, tool calls, suggested actions, and the input field.

```tsx
import { ChatPanelV9 } from "./components/v9";

<ChatPanelV9
  conversation={myConversation} // RevenueConversation data
  width={560}
  height={620}
  topic="Revenue Forecasting" // Shown in header dropdown
/>;
```

Features:

- Real `MessageBubble` from `@keboola/design` for user/assistant messages
- Real `ThinkingIndicator` for loading state
- Real `TaskIcon` + `EntityTag` for tool call display
- Approval flow UI (Approve/Decline buttons) for write tools
- Input field with typewriter effect and send button
- Suggested action buttons after messages
- Frame-based scroll via `transform: translateY`

### TransformationEditorV9

SQL editor panel using real `SqlEditor` from `@keboola/design`.

```tsx
import { TransformationEditorV9 } from "./components/v9";

<TransformationEditorV9
  enterFrame={820}
  exitFrame={1270}
  sqlCode={sqlSnippets.revenueForecastShort}
  transformationName="Q1 Revenue Forecast"
  blockName="Calculate Forecast"
  typewriterStartFrame={1000}
  charsPerFrame={1.8}
  saveFrame={1160}
  width={700}
  height={400}
/>;
```

Features:

- Real `SqlEditor` with syntax highlighting
- Typewriter effect for SQL code
- Save button animation ("SAVE" → "SAVED")
- Spring entrance/exit animations

### FlowPreviewV9

Flow builder panel matching production flows-v2 layout.

```tsx
import { FlowPreviewV9 } from "./components/v9";

<FlowPreviewV9
  enterFrame={1480}
  newTaskFrame={1600}
  width={800}
  height={520}
  flowName="Revenue Analytics"
  flowType="Conditional Flows"
/>;
```

Features:

- Real `Icon`, `Button`, `Badge` from `@keboola/design`
- Phase containers with task boxes (304x70 production dimensions)
- Dot grid background
- "NEW" badge animation when task is added
- Tab bar matching production
- Zoom controls (visual)

### ToastV9

Toast notification matching production toast styling.

```tsx
import { ToastV9 } from "./components/v9";

<ToastV9
  enterFrame={1620}
  exitFrame={1685}
  message="Added to flow"
  details="Q1 Revenue Forecast added to Revenue Analytics"
  variant="success" // 'success' | 'error' | 'info' | 'warning'
  bottomOffset={50}
/>;
```

### CursorV8

Animated cursor for showing user interactions. Shows pointer movement, click, and ripple effect.

```tsx
import { CursorV8 } from "./components/v8";

<CursorV8
  appearFrame={180}
  clickFrame={220}
  disappearFrame={240}
  startPosition={{ x: 500, y: 150 }}
  endPosition={{ x: 388, y: 486 }} // Target button position
/>;
```

### Layout Components

**CenteredStage** — Full viewport background:

```tsx
<CenteredStage backgroundColor="#F3F0EB">{children}</CenteredStage>
```

**CenteredCard** — Centered container:

```tsx
<CenteredCard width={300} height={150}>
  <LogoReveal enterFrame={1750} />
</CenteredCard>
```

**ScaleIn** — Entrance animation wrapper:

```tsx
<ScaleIn enterFrame={15} direction="center">
  <ChatPanelV9 ... />
</ScaleIn>
```

**LogoReveal** — Keboola logo animation for end cards:

```tsx
<LogoReveal enterFrame={1750} />
```

## Real Component Imports

Components imported from production codebases:

```tsx
// From @keboola/design (npm package)
import {
  Card,
  Icon,
  Button,
  Badge,
  cn,
  Switch,
  Label,
  CodeEditor,
  SqlEditor,
  MessageBubble, // AIKit block
  ThinkingIndicator, // AIKit block
} from "@keboola/design";

// From kbc-ui (via @kbc-ui webpack alias)
import { TaskIcon } from "@kbc-ui/modules/chat/internal/components/message/inline-task/TaskIcon";
import { EntityTag } from "@kbc-ui/modules/chat/internal/components/message/inline-task/EntityTag";
```

**Note**: `MessageBubble` and `ThinkingIndicator` moved from `kbc-ui/chat/internal/` to `@keboola/design` (AIKit block) as of Feb 2026.

## Extending: Creating New Panel Types

To add a new panel type (e.g., a storage browser, data preview, or pipeline monitor):

1. Create `src/components/v9/NewPanelV9.tsx`
2. Use real `@keboola/design` components for authentic look
3. Accept `enterFrame`, `exitFrame`, width/height props
4. Use `spring()` for entrance/exit animations
5. Export from `src/components/v9/index.ts`

Template:

```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Card, Icon, cn } from "@keboola/design";

type Props = {
  enterFrame: number;
  exitFrame?: number;
  width?: number;
  height?: number;
};

export const NewPanelV9: React.FC<Props> = ({
  enterFrame,
  exitFrame,
  width = 700,
  height = 400,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (exitFrame && frame >= exitFrame) {
    /* exit animation */
  }
  const relativeFrame = frame - enterFrame;
  if (relativeFrame < 0) return null;

  const entrance = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 15, stiffness: 100, mass: 1 },
  });

  return (
    <Card
      padding="none"
      style={{
        width,
        height,
        opacity: entrance,
        transform: `translateX(${interpolate(entrance, [0, 1], [50, 0])}px)`,
      }}
    >
      {/* Panel content using real @keboola/design components */}
    </Card>
  );
};
```

## References

- [references/component-props.md](references/component-props.md) — Full props reference for each V9 component
- [references/cursor-patterns.md](references/cursor-patterns.md) — Cursor positioning and timing patterns
- [references/layout-constants.md](references/layout-constants.md) — Card dimensions, positions, chat layout
