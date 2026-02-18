---
description: Render a video to file
allowed-tools: Bash, Read, Glob
argument-hint: <composition-name> [output-path]
---

# Render Video

Render a Remotion composition to an MP4 file.

## Steps

1. **Identify composition**: If no composition name was provided, list available compositions:

```bash
grep -o 'id="[^"]*"' apps/kai-video/src/Root.tsx
```

2. **Determine output path**: Use the provided path, or default to `apps/kai-video/out/<composition-name>.mp4`.

3. **Run the render**:

```bash
yarn workspace @keboola/kai-video render <CompositionId> --output <output-path>
```

4. **Report results**: Show the output file location and file size:

```bash
ls -lh <output-path>
```

## Common Options

- Render specific frame range (for testing): `--frames 0-300`
- Higher quality: `--quality 90`
- Scale up: `--scale 2`
