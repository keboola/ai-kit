---
description: Launch Remotion Studio to preview a video
allowed-tools: Bash
---

# Preview Video

Launch Remotion Studio for interactive video preview.

## Steps

1. Start the Remotion Studio dev server:

```bash
yarn workspace @keboola/kai-video dev
```

2. Inform the user:
   - Studio opens at **http://localhost:3000**
   - Select a composition from the sidebar (e.g., "KaiVideoV9")
   - Use the timeline scrubber to navigate frames
   - Props can be adjusted in the sidebar panel
   - Press Space to play/pause
