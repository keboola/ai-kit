# ui-video Plugin

Create Remotion-based feature highlight videos for the Keboola UI using real production components.

## What This Plugin Does

This plugin codifies the knowledge needed to create Keboola feature highlight videos. It provides:

- **Skills** that teach Claude about the video system architecture, script format, and available components
- **Commands** for creating scripts, previewing, and rendering videos
- **Agents** that autonomously generate and validate video scripts

## Installation

```bash
claude --plugin-dir /path/to/ai-kit/plugins/ui-video
```

Or add to your Claude Code settings to load automatically.

## Quick Start

### Create a new video

```
/ui-video:create-script "Storage browser with table preview"
```

Or describe what you want:

> "Create a video showing how Kai helps a user explore their storage buckets, preview table data, and create a transformation from selected columns."

The `script-generator` agent will autonomously create all necessary files.

### Preview your video

```
/ui-video:preview
```

Opens Remotion Studio at http://localhost:3000 for interactive preview.

### Render to file

```
/ui-video:render KaiVideoV10
```

Renders the composition to MP4.

## Skills

| Skill                | Triggers On                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| `video-architecture` | Questions about how the video system works, its structure, or setup    |
| `script-authoring`   | Creating/modifying scripts, defining scenes, writing conversation data |
| `video-components`   | Which components are available, their props, how to extend them        |

## Commands

| Command                   | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `/ui-video:create-script` | Generate a new video script from a feature description |
| `/ui-video:preview`       | Launch Remotion Studio to preview                      |
| `/ui-video:render`        | Render a composition to MP4                            |

## Agents

| Agent              | Purpose                                               |
| ------------------ | ----------------------------------------------------- |
| `script-generator` | Autonomously creates complete video scripts (sonnet)  |
| `script-reviewer`  | Validates timing, patterns, and anti-patterns (haiku) |

## Prerequisites

- Node.js v22.x
- Yarn 4
- The `apps/kbc-ui` app must be present (provides `@kbc-ui` webpack alias)
- `@keboola/design` package installed

## Architecture

```
VideoScript (data) → Composition (React) → Remotion Renderer (MP4)
```

Videos use real production components from `@keboola/design` and `kbc-ui`, controlled by Remotion's frame-based rendering. Each frame is a pure function of the current frame number — no runtime state, no DOM mutations.

## Key Rules

1. User messages type in input first, then send, then appear as bubbles
2. Every button click needs a visible cursor with ripple effect
3. Tool calls render inline in messages, not as toasts
4. No CSS transitions or useEffect — Remotion renders frames independently
5. Use frame-based `transform: translateY` for scrolling
