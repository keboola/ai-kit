# Remotion Fundamentals Reference

## Animation Primitives

### interpolate()

Linear interpolation between values:

```ts
import { interpolate } from "remotion";

// Fade in over 30 frames
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateRight: "clamp",
  extrapolateLeft: "clamp",
});

// Move horizontally
const x = interpolate(frame, [0, 60], [100, 0], { extrapolateRight: "clamp" });
```

**Important**: Without `extrapolateRight: 'clamp'`, values will continue linearly past the range.

### spring()

Physics-based animation (0 → 1):

```ts
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const scale = spring({
  frame,
  fps,
  config: { damping: 15, stiffness: 100, mass: 1 },
});
```

Common spring configs:

- **Smooth (no bounce)**: `{ damping: 200 }`
- **Snappy**: `{ damping: 20, stiffness: 200 }`
- **Bouncy**: `{ damping: 8 }`
- **Heavy**: `{ damping: 15, stiffness: 80, mass: 2 }`

### Combining spring + interpolate

Map spring's 0-1 output to custom ranges:

```ts
const progress = spring({ frame, fps });
const rotation = interpolate(progress, [0, 1], [0, 360]);
const translateX = interpolate(progress, [0, 1], [50, 0]);
```

### Easing

```ts
import { interpolate, Easing } from "remotion";

const value = interpolate(frame, [0, 100], [0, 1], {
  easing: Easing.inOut(Easing.quad),
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});
```

Curves (most linear → most curved): `quad`, `sin`, `exp`, `circle`
Convexities: `Easing.in`, `Easing.out`, `Easing.inOut`

## Sequencing

### `<Sequence>`

Delays when a child appears:

```tsx
import { Sequence } from "remotion";

<Sequence from={30} durationInFrames={60}>
  <MyComponent />
  {/* Inside MyComponent, useCurrentFrame() returns 0-59, not 30-89 */}
</Sequence>;
```

Use `layout="none"` to prevent wrapping in AbsoluteFill:

```tsx
<Sequence from={30} layout="none">
  <MyComponent />
</Sequence>
```

### `<Series>`

Sequential playback without overlap:

```tsx
import { Series } from "remotion";

<Series>
  <Series.Sequence durationInFrames={45}>
    <Intro />
  </Series.Sequence>
  <Series.Sequence durationInFrames={60}>
    <MainContent />
  </Series.Sequence>
  <Series.Sequence durationInFrames={30}>
    <Outro />
  </Series.Sequence>
</Series>;
```

## Compositions

Registered in `Root.tsx`:

```tsx
<Composition
  id="MyVideo"
  component={MyComponent}
  durationInFrames={1800}
  fps={30}
  width={1280}
  height={720}
/>
```

Use `type` for props (not `interface`) to ensure `defaultProps` type safety.

## Transitions

```tsx
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={60}>
    <SceneA />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: 15 })}
  />
  <TransitionSeries.Sequence durationInFrames={60}>
    <SceneB />
  </TransitionSeries.Sequence>
</TransitionSeries>;
```

Transitions **overlap** adjacent scenes, reducing total duration.

## Tailwind in Remotion

Tailwind works normally with one critical exception:

**FORBIDDEN**: `transition-*` and `animate-*` classes. These use CSS animations which do NOT work in Remotion's frame-based rendering. Always use `useCurrentFrame()` + `interpolate()`/`spring()` instead.
