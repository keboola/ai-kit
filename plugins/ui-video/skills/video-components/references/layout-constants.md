# Layout Constants

## Viewport

```ts
const VIEWPORT = {
  width: 1280,
  height: 720,
  centerX: 640,
  centerY: 360,
};
```

## Card Sizes

```ts
const CARD_SIZES = {
  // Main chat panel (centered state)
  chat: { width: 560, height: 620 },

  // Chat when slid left (narrower to make room for side panel)
  chatExpanded: { width: 440, height: 620 },

  // Flow builder panel
  flowPanel: { width: 800, height: 520 },

  // SQL transformation editor
  transformationEditor: { width: 700, height: 400 },

  // End-card logo
  logo: { width: 300, height: 150 },
};
```

## Chat Positions

```ts
const CHAT_POSITIONS = {
  // Centered on screen
  center: {
    x: 640 - 560 / 2, // = 360
    y: 360 - 620 / 2 + 20, // = 70
  },
  // Slid left for side panel
  left: {
    x: 40,
    y: 360 - 620 / 2 + 20, // = 70
  },
};
```

## Panel Positions

```ts
// Transformation editor: right side, vertically centered
const TRANSFORMATION_EDITOR_POSITION = {
  x: 1280 - 700 - 30, // = 550
  y: 360 - 400 / 2 + 20, // = 180
};

// Flow panel: right side, vertically centered
const FLOW_PANEL_POSITION = {
  x: 1280 - 800 - 20, // = 460
  y: 360 - 520 / 2 + 20, // = 120
};
```

## Chat Panel Internal Layout

Used for cursor targeting and scroll calculations:

```ts
const CHAT_LAYOUT = {
  // Header
  headerHeight: 44,

  // Input area
  inputOuterPadding: 12, // tw-p-3
  inputInnerPaddingX: 16, // tw-px-4
  inputInnerPaddingY: 12, // tw-py-3
  inputInnerHeight: 48,
  sendButtonSize: 32, // tw-w-8 tw-h-8

  // Messages area
  messagesPadding: 16, // tw-p-4
};
```

## Background

The canvas background color matches Keboola's production UI:

```ts
const CANVAS_BG = "#F3F0EB";
```

## Scroll Calculation Heights

Used in `calculateScrollOffset()` to determine content overflow:

```ts
const SCROLL_CONSTANTS = {
  MESSAGE_BASE_HEIGHT: 60,
  TASK_HEIGHT: 32,
  TEXT_LINE_HEIGHT: 24,
  APPROVAL_PANEL_HEIGHT: 180, // Code preview + approve/decline buttons
};
```

## Flow Builder Internal Dimensions

Production-matching dimensions for flow tasks:

```ts
const TASK_WIDTH = 304; // Production exact
const TASK_HEIGHT = 70; // Production exact
const DOT_SPACING = 20; // Background grid dots
```

## Slide Animation Easing

Chat panel slide transitions use quartOut easing over 25 frames:

```ts
const quartOut = (t: number) => 1 - Math.pow(1 - t, 4);

// Usage:
const slideProgress = Math.min(1, (frame - slideStartFrame) / 25);
const easedProgress = quartOut(slideProgress);
const chatX = interpolate(easedProgress, [0, 1], [fromX, toX]);
```
