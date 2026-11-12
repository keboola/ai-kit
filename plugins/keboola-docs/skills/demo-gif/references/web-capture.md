# Web App Capture: Playwright + ffmpeg

Recipes for recording a browser demo and turning it into a README-ready GIF. Two stages: record video with Playwright, then convert to GIF with ffmpeg. The ffmpeg filter options below (`palettegen`/`paletteuse`) were verified directly against a local `ffmpeg 8.1.1` install via `ffmpeg -h filter=palettegen` and `ffmpeg -h filter=paletteuse` — run those two commands yourself if your ffmpeg version's option names differ.

## 1. Record with Playwright

Playwright records video at the **browser context** level via the `recordVideo` option. The video file is only finalized when the context closes, so the script must explicitly close it — don't just let the process exit.

### Setup

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### Minimal recording script

```ts
import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: {
      dir: 'recordings',
      size: { width: 1280, height: 720 }, // match your target embed proportions
    },
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();
  await page.goto('http://localhost:3000');

  // --- drive the demo interaction ---
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.waitForTimeout(800); // let animations/transitions settle before the next action
  await page.getByLabel('Project name').fill('demo-project');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForSelector('text=Project created');
  await page.waitForTimeout(1500); // hold the final state so the GIF doesn't cut off

  // --- finalize ---
  const video = page.video();
  await context.close(); // REQUIRED: video is written to disk on close, not before

  if (video) {
    await video.saveAs('recordings/demo.webm');
  }

  await browser.close();
}

main();
```

Run it with `npx tsx record-demo.ts` (or compile/run however the project already runs TypeScript one-off scripts — `ts-node`, `tsx`, or plain `node` after a build step).

### Notes

- `recordVideo.size` sets the *video frame* size. If it doesn't match the `viewport`, Playwright letterboxes/scales — set both to the same size to avoid unexpected borders in the output.
- Videos come out as `.webm`. That's fine — ffmpeg reads webm directly in the conversion step below, no separate transcode needed.
- `page.video()` returns a handle immediately (even before recording finishes); the actual bytes aren't guaranteed on disk until after `context.close()`. Always close the context before touching the file.
- `video.saveAs(path)` copies/renames the recorded video to a predictable path — without it, Playwright names the file with an internal random ID inside the `dir` you gave `recordVideo`.
- If the demo needs a signed-in state, a seeded database, or specific fixture data, set that up before `page.goto` (or via a `beforeEach`-style setup step) — same principle as `Hide`/`Show` in vhs tapes: don't record the setup, record the demo.
- For multi-step flows worth showing as a single GIF, keep total interaction time under ~20 seconds of real actions; the optimization step will already need to cut a longer capture down.

## 2. Convert to GIF: ffmpeg two-pass palette

A naive single-pass conversion (`ffmpeg -i input.webm output.gif`) uses a generic fixed palette and bands badly on anything with gradients, shadows, or antialiased UI. The two-pass `palettegen`/`paletteuse` flow builds a palette from the actual footage first.

### Pass 1: generate the palette

```bash
ffmpeg -i recordings/demo.webm \
  -vf "fps=12,scale=800:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff" \
  palette.png
```

- `fps=12` — downsamples to 12 frames/sec. 10-15fps is the target range for a UI demo; anything higher mostly just inflates file size for motion nobody needs to see at that resolution.
- `scale=800:-1:flags=lanczos` — resizes to 800px wide (matches the ~800px README embed guidance), `-1` preserves aspect ratio, `lanczos` is a high-quality resize filter.
- `palettegen=max_colors=128` — caps the generated palette at 128 colors (out of a max of 256); UI screenshots rarely need the full 256 to look clean, and a smaller palette shrinks the final file. Raise to 256 if the demo has photos or rich gradients and looks posterized at 128.
- `stats_mode=diff` — builds the palette from the parts of the frame that change between frames rather than full-frame histograms each time; generally better for mostly-static UI with small moving regions (cursor, typed text, a loading spinner) than the default `full` mode.

### Pass 2: apply the palette

```bash
ffmpeg -i recordings/demo.webm -i palette.png \
  -lavfi "fps=12,scale=800:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=sierra2_4a" \
  demo.gif
```

- The `fps`/`scale` filters must match pass 1 exactly, or the palette won't line up with the frames it's applied to.
- `paletteuse=dither=sierra2_4a` — error-diffusion dithering that smooths color transitions without the visible cross-hatch pattern of `bayer` dithering. Confirmed options on this filter (from `ffmpeg -h filter=paletteuse`): `bayer`, `heckbert`, `floyd_steinberg`, `sierra2`, `sierra2_4a` (default), `sierra3`, `burkes`, `atkinson`. `sierra2_4a` is a reasonable default; try `bayer` with `bayer_scale` set (0-5) if you want a smaller, more deterministic-looking result instead.

### One-liner alternative (single ffmpeg invocation, filter_complex)

If you'd rather not write an intermediate `palette.png` file:

```bash
ffmpeg -i recordings/demo.webm -filter_complex \
  "[0:v] fps=12,scale=800:-1:flags=lanczos,split [a][b]; [a] palettegen=max_colors=128 [p]; [b][p] paletteuse=dither=sierra2_4a" \
  demo.gif
```

Same result, one command, no intermediate file left on disk.

## 3. Alternative: gifski

If [gifski](https://gif.ski/) is installed, it produces very clean output from a PNG frame sequence (it does its own high-quality quantization, arguably better than ffmpeg's palette filters for photo-real content):

```bash
# extract frames first
ffmpeg -i recordings/demo.webm -vf "fps=12,scale=800:-1" frames/frame-%04d.png

# then encode
gifski -o demo.gif --fps 12 --width 800 frames/frame-*.png
```

Extra step (frame extraction) versus the ffmpeg-only path, so default to the ffmpeg two-pass flow unless gifski is already part of the project's toolchain or the ffmpeg output still looks banded after tuning `max_colors`/`dither`.

## 4. Optimize further with gifsicle

Whichever path produced `demo.gif`, run it through gifsicle before committing — see the main `SKILL.md` Step 4 for the exact flags (`-O3 --lossy=30 --colors 128`). The ffmpeg/gifski steps above already do most of the size reduction; gifsicle's lossy compression and frame-diffing (`-O3`) typically squeezes another 20-40% out on top.
