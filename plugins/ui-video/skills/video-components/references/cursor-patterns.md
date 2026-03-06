# Cursor Patterns

## Cursor Timing

The cursor (`CursorV8`) creates the illusion of user interaction. Every clickable element needs a cursor.

### Timing Formula

```
appearFrame  = targetEvent - 40    (appear 30-60 frames before click)
clickFrame   = targetEvent         (the moment of interaction)
disappearFrame = targetEvent + 20  (fade out 15-20 frames after click)
```

### Example: Send Button Click

```tsx
<CursorV8
  appearFrame={180} // 40 frames before click
  clickFrame={220} // Click send button
  disappearFrame={240} // Disappear 20 frames after
  startPosition={cursorStart} // Off-screen right
  endPosition={targets.sendButton}
/>
```

### Example: Approval Button Click

```tsx
<CursorV8
  appearFrame={SCENES.createTransformation.approvalButtonsAppear + 30}
  clickFrame={SCENES.createTransformation.approvalClick}
  disappearFrame={SCENES.createTransformation.approvalClick + 20}
  startPosition={cursorStart}
  endPosition={targets.approveButton}
/>
```

## Cursor Positioning

### Start Position

Cursors should appear from outside the main UI, typically to the right:

```ts
const cursorStart = {
  x: chatX + chatWidth + 40, // Right of chat panel
  y: chatY + 150, // Upper portion
};
```

### Target Calculation

Use the `getCursorTargets()` helper to calculate button positions based on chat panel layout:

```ts
const getCursorTargets = (chatX, chatY, chatWidth, chatHeight) => ({
  sendButton: {
    x: chatX + chatWidth - 12 - 16 - 16, // Right edge - padding - button center
    y: chatY + chatHeight - 12 - 24, // Bottom edge - padding - center
  },
  suggestedAction1: {
    x: chatX + chatWidth / 2,
    y: chatY + 44 + 16 + 320, // header + padding + content offset
  },
  approveButton: {
    x: chatX + 16 + 100, // Left padding + button offset
    y: chatY + 44 + 16 + 220, // header + padding + content offset
  },
});
```

### Chat Layout Constants

These define the internal structure of ChatPanelV9 for cursor targeting:

```ts
const CHAT_LAYOUT = {
  headerHeight: 44,
  inputOuterPadding: 12, // tw-p-3
  inputInnerPaddingX: 16, // tw-px-4
  inputInnerPaddingY: 12, // tw-py-3
  inputInnerHeight: 48,
  sendButtonSize: 32, // tw-w-8
  messagesPadding: 16, // tw-p-4
};
```

## Conditional Rendering

Only render cursor when it's visible (saves render cycles):

```tsx
{
  frame >= 180 && frame < 240 && (
    <CursorV8
      appearFrame={180}
      clickFrame={220}
      disappearFrame={240}
      startPosition={cursorStart}
      endPosition={targets.sendButton}
    />
  );
}
```

## Cursor Animation Details

The `CursorV8` internally handles:

- **Fade in**: 10 frames opacity 0→1
- **Movement**: Spring animation from start to end position
- **Click**: Scale 1→0.85→1 over 10 frames
- **Ripple**: Expanding circle (scale 0.5→2, opacity 0.6→0) over 20 frames
- **Fade out**: 15 frames before `disappearFrame`

The cursor SVG tip is offset by `(5.5, 3)` so the pointer tip lands exactly on target coordinates.
