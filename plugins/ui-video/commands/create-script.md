---
description: Generate a new video script from a feature description
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
argument-hint: <feature-description>
---

# Create Video Script

Generate a complete Remotion video script for a Keboola feature highlight.

## Steps

1. **Understand the feature**: If no feature description was provided as an argument, ask the user what Keboola feature to highlight.

2. **Read existing patterns**: Read the latest script for reference:
   - `apps/kai-video/src/data/revenueNarrativeConversation.ts` — conversation data format
   - `apps/kai-video/src/KaiVideoV9.tsx` — composition structure
   - `apps/kai-video/src/Root.tsx` — registration format

3. **Design the narrative arc**:
   - What problem does the user have?
   - How does Kai help solve it?
   - What is the visible outcome?
   - Plan 4-6 scenes fitting in 60 seconds (1800 frames at 30fps)

4. **Generate the conversation data file** at `apps/kai-video/src/data/<featureName>Conversation.ts`:
   - Define scene timing constants
   - Define viewport/card sizes and positions
   - Create the messages array with proper timing
   - Include tool calls with correct state transitions
   - Include suggested actions where appropriate
   - Set up input typing → send → bubble flow for user messages

5. **Generate the composition component** at `apps/kai-video/src/KaiVideo<Version>.tsx`:
   - Import required V9 components
   - Set up scene visibility flags
   - Calculate animated positions
   - Add cursor interactions for every button click
   - Add toast notifications and logo reveal

6. **Register in Root.tsx**: Add the new `<Composition>` entry.

7. **Validate timing**:
   - No frame gaps or overlaps between scenes
   - All frames within TOTAL_FRAMES
   - Input typing → send → bubble ordering
   - Tool call state transitions are sequential
   - Every clickable element has a cursor

8. **Print summary**: List created files, scene breakdown, and how to preview.

## Critical Rules

- User messages MUST type in input box first, then send, then appear as bubbles
- Every button click MUST have a visible CursorV8 with ripple effect
- Tool calls render inline in MessageBubble, NOT as toasts
- NO CSS transitions or useEffect — Remotion renders frames independently
- Use `transform: translateY` for scrolling, driven by frame calculations
- Wrap everything in ThemeProvider in Root.tsx
