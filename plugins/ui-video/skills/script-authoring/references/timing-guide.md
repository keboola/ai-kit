# Timing Guide

## Frame Math Cheat Sheet

| Duration | Frames (30fps) |
| -------- | -------------- |
| 0.5s     | 15             |
| 1s       | 30             |
| 2s       | 60             |
| 3s       | 90             |
| 5s       | 150            |
| 10s      | 300            |
| 15s      | 450            |
| 20s      | 600            |
| 30s      | 900            |
| 60s      | 1800           |

## Common Duration Patterns

### Entrance Animations

- Chat panel enter: ~15 frames (spring)
- Side panel slide in: ~25 frames (quartOut easing)
- Toast notification: ~15 frames (spring)

### User Interactions

- Input typing: 1.5 chars/frame = ~100 frames for a sentence
- Cursor appear → click: 30-40 frames
- Cursor click ripple: 20 frames
- Cursor disappear after click: 15-20 frames

### Tool Calls

- Read-only tool (query_data): 50-60 frames (appear → complete)
- Write tool approval flow:
  - appear → approval buttons: 20 frames
  - approval buttons visible: 70 frames (cursor movement)
  - approved → complete: 60 frames
- Gap between sequential tool calls: 10 frames

### Message Display

- Thinking indicator: 10-15 frames visible
- Typewriter text: 2.5 chars/frame (assistant messages)
- Gap between messages: 30-60 frames

### Scene Transitions

- Chat slide left/right: 25 frames (quartOut)
- Panel fade out: 15-25 frames
- Logo reveal: 30 frames

## Pacing Guidelines

### 6-Scene Structure (60s total)

| Scene                | Duration | Frames    | Purpose                 |
| -------------------- | -------- | --------- | ----------------------- |
| 1. User Query        | 9s       | 0-270     | Input typing + send     |
| 2. Kai Response      | 11s      | 270-600   | Tool calls + forecast   |
| 3. Suggested Action  | 6s       | 600-780   | Button selection        |
| 4. Deep Work         | 16s      | 780-1260  | Editor/panel + approval |
| 5. Follow-up         | 6s       | 1260-1440 | Second action           |
| 6. Resolution + Logo | 12s      | 1440-1800 | Final result + branding |

### Timing Validation Rules

1. **No gaps**: Every frame must be owned by a scene (next scene starts where previous ends)
2. **No overlaps**: Two scenes should not claim the same frames
3. **Input before message**: `inputTypingStartFrame` < `inputSentFrame` < user message `appearFrame`
4. **Tool timing**: `appearFrame` < `approvalButtonsAppearFrame` < `approvedFrame` < `completeFrame`
5. **Cursor before click**: Cursor `appearFrame` < `clickFrame` < `disappearFrame`
6. **Total frames**: All scenes must fit within `TOTAL_FRAMES` (typically 1800)

## Scene Duration Guidelines

- **Minimum scene duration**: 3s (90 frames) — shorter feels rushed
- **Maximum scene duration**: 20s (600 frames) — longer loses attention
- **Logo reveal**: At least 2s (60 frames) at the end
- **First visible content**: Within 1s (30 frames) of video start
