# Project Setup

## Prerequisites

- Node.js v22.x
- Yarn 4 (project uses Yarn workspaces)
- The `apps/kbc-ui` app must be present (the `@kbc-ui` webpack alias points to `../kbc-ui/src/scripts`)

## Development (Remotion Studio)

Launch the interactive preview:

```bash
yarn workspace @keboola/kai-video dev
```

This opens Remotion Studio at `http://localhost:3000` where you can:

- Preview compositions in real-time
- Scrub through the timeline
- Inspect individual frames
- Adjust props via the sidebar

## Type Checking

```bash
yarn build --filter=@keboola/kai-video
```

**Important**: Remotion's type-checking needs access to the real `/tmp` directory (not sandboxed). If running in a sandboxed environment, you may need to bypass the sandbox for this command.

## Rendering

Render a specific composition to file:

```bash
yarn workspace @keboola/kai-video render <CompositionId> --output ./out/<filename>.mp4
```

Example:

```bash
yarn workspace @keboola/kai-video render KaiVideoV9 --output ./out/revenue-forecast.mp4
```

Common render options:

- `--quality 80` — JPEG quality (default: 80)
- `--scale 2` — render at 2x resolution
- `--frames 0-300` — render only specific frame range (useful for testing)

## Adding a New Composition

1. Create your composition component (e.g., `KaiVideoV10.tsx`)
2. Export timing constants: `export const V10_FPS = 30; export const V10_TOTAL_FRAMES = 1800;`
3. Register in `Root.tsx`:

```tsx
import { KaiVideoV10, V10_TOTAL_FRAMES, V10_FPS } from "./KaiVideoV10";

// Inside RemotionRoot:
<Composition
  id="KaiVideoV10"
  component={KaiVideoV10}
  durationInFrames={V10_TOTAL_FRAMES}
  fps={V10_FPS}
  width={1280}
  height={720}
/>;
```

## File Organization Convention

Each new video should create:

1. **Data file**: `src/data/<featureName>Conversation.ts` — script data, types, timing constants
2. **Composition**: `src/KaiVideo<Version>.tsx` — main composition component
3. **Root registration**: Add `<Composition>` entry in `Root.tsx`

Reuse existing V9 components (`ChatPanelV9`, `TransformationEditorV9`, etc.) whenever possible. Only create new components when the video requires UI elements not covered by existing ones.
