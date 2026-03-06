---
name: video-architecture
description: Use when user asks about how the Keboola video system works, its structure, directory layout, Remotion setup, or how to set up a new video project. Covers architecture overview, webpack config, composition registration, and development environment.
---

# Keboola UI Video Architecture

The video system creates feature highlight videos for the Keboola platform using **Remotion** — a React-based video framework where each frame is a pure function of time.

## Core Architecture

```
VideoScript (data) → Composition (React component) → Remotion Renderer (MP4/WebM)
```

1. **Data files** define the conversation, timing, and scene structure as TypeScript constants
2. **Composition components** read `useCurrentFrame()` and render the correct UI for each frame
3. **Remotion** renders each frame independently — there is NO runtime state, NO effects, NO DOM mutations

**CRITICAL**: Remotion renders frames independently. CSS transitions, `useEffect`, `scrollTop`, `scrollIntoView`, and any DOM mutation APIs **DO NOT WORK** in rendered video. All animation must be pure functions of `useCurrentFrame()`. Use `interpolate()` for linear animations, `spring()` for physics-based animations, and `transform: translateY()` for scrolling.

## Directory Structure

```
apps/kai-video/
├── remotion.config.ts          # Webpack aliases, Tailwind, output format
├── src/
│   ├── Root.tsx                 # Composition registration (entry point)
│   ├── index.css                # Tailwind imports
│   ├── KaiVideoV9.tsx           # Latest composition (scene orchestration)
│   ├── data/
│   │   ├── chatConversation.ts  # Base types (ChatMessage, ChatConversation)
│   │   ├── revenueNarrativeConversation.ts  # V9 script data + extended types
│   │   └── financeSqlSnippets.ts            # SQL code for transformations
│   └── components/
│       ├── v9/                  # Latest components using real production code
│       │   ├── ChatPanelV9.tsx
│       │   ├── TransformationEditorV9.tsx
│       │   ├── FlowPreviewV9.tsx
│       │   ├── ToastV9.tsx
│       │   └── index.ts
│       ├── v8/
│       │   └── CursorV8.tsx     # Animated cursor with click ripple
│       ├── core/
│       │   └── CenteredStage.tsx # Layout helpers (CenteredStage, CenteredCard)
│       ├── transitions/
│       │   └── ScaleAway.tsx    # ScaleIn entrance animation
│       └── ui/
│           └── LogoReveal.tsx   # End-card logo animation
```

## Video Specifications

| Property         | Value             |
| ---------------- | ----------------- |
| Resolution       | 1280 x 720        |
| Frame rate       | 30 fps            |
| Typical duration | 60s = 1800 frames |
| Format           | MP4 (JPEG frames) |

## How Remotion Works

Remotion renders React components as video frames. Each frame is a **pure render** — the component receives `frame` from `useCurrentFrame()` and returns the exact visual for that moment.

```tsx
import { useCurrentFrame, interpolate } from "remotion";

export const MyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });
  return <div style={{ opacity }}>Hello</div>;
};
```

Key Remotion APIs:

- `useCurrentFrame()` — current frame number (0-indexed)
- `useVideoConfig()` — `{ fps, width, height, durationInFrames }`
- `interpolate(value, inputRange, outputRange, options)` — linear interpolation
- `spring({ frame, fps, config })` — physics-based 0→1 animation
- `<Sequence from={frame}>` — delay child rendering
- `<Composition>` — registers a renderable video in Root.tsx

## Composition Registration (Root.tsx)

Every video must be registered as a `<Composition>` in `Root.tsx`:

```tsx
import { Composition } from "remotion";
import { ThemeProvider } from "@keboola/design";
import { KaiVideoV9, V9_TOTAL_FRAMES, V9_FPS } from "./KaiVideoV9";

export const RemotionRoot: React.FC = () => (
  <ThemeProvider>
    <Composition
      id="KaiVideoV9"
      component={KaiVideoV9}
      durationInFrames={V9_TOTAL_FRAMES}
      fps={V9_FPS}
      width={1280}
      height={720}
    />
  </ThemeProvider>
);
```

The `ThemeProvider` wrapper is required for `@keboola/design` components to render correctly.

## Webpack Configuration

`remotion.config.ts` configures:

- **Tailwind CSS** via `@remotion/tailwind`
- **`@kbc-ui` alias** → `../kbc-ui/src/scripts` (enables importing real kbc-ui components)

```ts
Config.overrideWebpackConfig((currentConfig) => {
  const tailwindConfig = enableTailwind(currentConfig);
  return {
    ...tailwindConfig,
    resolve: {
      ...tailwindConfig.resolve,
      alias: {
        ...tailwindConfig.resolve?.alias,
        "@kbc-ui": path.resolve(process.cwd(), "../kbc-ui/src/scripts"),
      },
    },
  };
});
```

## References

For deeper Remotion API details, see [references/remotion-fundamentals.md](references/remotion-fundamentals.md).
For dev environment setup, see [references/project-setup.md](references/project-setup.md).
