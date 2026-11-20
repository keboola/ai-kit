---
name: docs-clip
description: "Use when a help.keboola.com page needs motion: choosing the form (states GIF, narrated recording with a caption band, Remotion explainer), recording in Keboola, encoding a budgeted MP4 or GIF, re-rendering a clip, or a GIF for Slack or a PR. Triggers: \"запиши гифку/клип\", \"переснять клип\", \"record a demo\"."
---

# Clips for the Keboola docs


## Working Directory Context

Scripts run from the root of a connection-docs worktree: Playwright resolves from its `node_modules`, finished clips go under its `public/<section>/`. They locate their own files (`compositor.html`, `explainer*.html`) themselves; raw takes and composites go to a scratch directory, never into the repo. The Remotion project in `remotion/` is the exception: `cd` into it for `npm install` and renders.

## Decide first: does this need a clip?

A clip earns its place when a page would otherwise be a wall of text about something that moves —
an assistant working, a job progressing, a draft updating live. It does **not** earn its place
when a single screenshot says the same thing, and a numbered list plus a still is cheaper to keep
correct than a video. One clip per page, maximum. Stripe's docs, which people hold up as the bar,
have almost none: the code beside the prose does the work.

Which form the page gets (states GIF, narrated recording with a caption band, or an explainer)
is decided first, from `references/clip-grammar.md`. A how-to step gets a states GIF or a
narrated recording placed under the step; a hub gets an explainer; words never sit on the UI.

Hard rules, from the people who review this section:

- **No mascot, no character, no arrows drawn by hand.** The guide is an outline and a caption,
  nothing else (Nikita, 14 Sep 2026; Michal's "být sušší" points the same way).
- **Bright, never dimmed.** Use the compositor's `look: 'bright'`: a blue outline on the point, no
  scrim over the rest. The dimmed spotlight made the hub clip average a luma of 71 of 255 against
  229 for its screenshots, and Nikita rejected it as dark (24 Sep 2026). Budget: mean luma at least
  200 and no frame under 180, poster included, measured with
  `"${CLAUDE_PLUGIN_ROOT}/scripts/checker/clip_metrics.sh" <clip> <poster> <out>` (`--states` for a states clip,
  which holds it to 250 KB and 3–9 s), which also writes the contact sheet.
- **An overview page may use an explainer instead of a screen recording:** words and numbered dots
  on a line that draws itself, then a real screenshot and a closing question
  (`scripts/explainer.html`, recorded with `record-composite.mjs --page explainer.html <image> 1280
  800`). Same budgets and rules: every word is something the page says, no timings the page cannot
  back, no mascot.
- **Captions a reader can read:** the page column is 713 px in a 1280-px window (measured
  2026-10-06; `clip_metrics.sh --page-width` overrides), so text needs at least 24 px on a 1280
  canvas to render at 13 px. The old "22 px" figure assumed an 800-px column and is retired.
- **MP4 on pages**, `<video autoplay loop muted playsinline poster …>`, for a recording and, since
  2026-10-22, for a **states clip** too (a few stills of one screen and its dialogs, built by
  `capture-states.mjs`, joined by dissolves at 30 fps: see "States clip on a page" below). A GIF is
  only for Slack, a PR body or a README.
- **≤ 30 seconds, ≤ 1 MB** on a page. Over budget means cut content, not raise the ceiling.
- **Nothing in frame that is not ours to publish** (PRDCT-616): no colleague names or avatars, no
  tokens, no other project's configurations. Shoot in project 264, element-cropped, and read every
  frame before committing.

## Where the clip goes: budgets by section

| Page | Budget | What it shows |
|---|---|---|
| Getting Started hub (hero clip) | **≤ 10 s** (Michal Jeřábek, 2026-09-30), ≤ 1 MB | results, not ingredients: one screen of the app the guide really builds, then a closing phrase; poster = the result frame. Explainer form, see `references/explainer-look.md` |
| Getting Started task pages | one clip at most, usually none | the Prompt · UI · CLI/API block carries the step; a UI-locator screenshot per screen a step ends on. All GS shots from one project (264 or the author's Free BigQuery project) and one week |
| Apps pages (`data-apps/`) | screenshots first; a clip only for something that moves (Kai building, a draft updating) | element-cropped UI-locator shots, `capturing-keboola-ui-screenshots` |
| Any other page | ≤ 30 s, ≤ 1 MB | one clip per page at most |

Capture gotchas (viewport, names, CSP, toast, Kai panel, 2x recording) are in
`${CLAUDE_PLUGIN_ROOT}/skills/capturing-keboola-ui-screenshots/references/keboola-ui-capture.md`.

## The pipeline

Three stages, three scripts in `scripts/`, all runnable from anywhere:

```
record.mjs         drive the product, record webm   (Playwright + a saved session)
compositor.html    pacing + spotlight + chips       (opened by record-composite.mjs)
record-composite.mjs  screen-record the compositor  → webm
ffmpeg             encode to mp4 + poster           (recipe below)
```

### 1. Record

`record.mjs` drives a logged-in browser and records the viewport. It needs a saved session at
`~/.keboola-shots/state.json`; refresh it with a headed Playwright run if it has expired (a headed
browser opens, you log in, it saves and exits — never type credentials into an agent).

Two habits that make the raw take usable:

- Kill the promo toast: `document.querySelectorAll('div.tw\\:fixed.tw\\:bottom-4.tw\\:left-16').forEach(e => e.remove())`.
- Record at 1280×800 for panels and chat, or the element's own size for a single component.
  Playwright finalizes the file only when the **context** closes, so close the context, not just
  the page.

Kai's chat has its own traps, and they are written down in the `kai-ui-automation` memory: the
composer is a `<textarea>` whose content lives in `.value`, Enter sends (so multi-line prompts need
Shift+Enter), opening the panel starts a new chat, and resolved approval cards keep their buttons
in the history — fingerprint a card before clicking it or you will click a dead one two hundred
times.

### 2. Post-produce

`compositor.html` replays the take with a variable rate and draws the overlays. Add a clip to the
`CLIPS` object (a source video) or a scene to `SCENES` (a still image the spotlight tours):

```js
'my-clip': {
  src: 'my-clip.src.mp4', w: 1280, h: 800, endAt: 73, holdMs: 3500,
  segments: [ { until: 2.2, rate: 0.9 }, { until: 52, rate: 9.0 }, { until: 99, rate: 0.9 } ],
  overlays: [
    { type: 'chip', from: 0.3, to: 12, html: 'Ask Kai — <b>read-only</b>, nothing to set up' },
    { type: 'spot', from: 69, rect: [905, 250, 365, 175] },
  ],
},
```

- `segments` is the pacing: typing at 1×, an assistant thinking at 6–9×, the result at 1× with a
  hold at the end. This is what turns a 104-second take into a 36-second clip that still reads.
- `chip` is a caption in the site's palette, bottom-left, with a plain dot — no icons, no emoji.
  **Retired for new clips (2026-10-14):** a caption on the UI hides what the reader should look at.
  New narrated clips put captions in a band above the frame (the where-kai Remotion composition,
  `references/clip-grammar.md`); the chip stays only to re-render old clips.
- `spot` dims everything outside a rectangle. It is the only pointer. Give it the element's real
  rect from the recording, not an approximation.
- `hl` (a pulsing outline) still exists for the rare case where dimming the page would hide
  context worth seeing.

Scene mode needs no video: a background still plus `cards` (raw rows), `question` (the poster
frame) and `stops` (the spotlight tour). Each stop takes `x`, `y` and optionally `w`, `h`; a stop
marked `noRing: true` turns the spotlight off, which is what a closing statement wants, because it
points at nothing.

Run it:

```bash
node scripts/record-composite.mjs my-clip /path/to/my-clip.src.mp4 1280 800
node scripts/record-composite.mjs --scene my-scene /path/to/background.png 966 744
```

`REC_OUT` sets the output directory; `PLAYWRIGHT_PATH` points at a Playwright install if the
default one has moved.

### 3. Encode and place

```bash
ffmpeg -y -i <composite.webm> -vf "fps=20,scale='min(1280,iw)':-2" \
  -c:v libx264 -preset slow -crf 29 -pix_fmt yuv420p -an -movflags +faststart \
  public/getting-started/<page>/<clip>.mp4
ffmpeg -y -ss <seconds> -i public/getting-started/<page>/<clip>.mp4 -frames:v 1 \
  public/getting-started/<page>/<clip>-poster.png
```

Over 1 MB: `crf 31`, then `fps 18`, then `scale 1152`, then cut content. The poster is the most
informative frame — the question for a hub tour, the result for a task clip — not the last frame,
which is usually a chip fading out.

On the page:

```mdx
<video autoplay loop muted playsinline poster="/getting-started/<page>/<clip>-poster.png" aria-label="…">
  <source src="/getting-started/<page>/<clip>.mp4" type="video/mp4" />
</video>
```

The `aria-label` is a sentence describing what happens, not "video". If a value in frame moves
with live data, say "on the day of recording" in the label or in the authoring comment.

### GIF, when something outside the docs needs one

Follow the `demo-gif` skill's recipe (same plugin) — two-pass palette, then gifsicle:

```bash
ffmpeg -y -i clip.mp4 -vf "fps=12,scale=800:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff" palette.png
ffmpeg -y -i clip.mp4 -i palette.png -lavfi "fps=12,scale=800:-1:flags=lanczos,paletteuse=dither=bayer:bayer_scale=3" clip.gif
gifsicle -O3 --lossy=30 --colors 128 clip.gif -o clip.opt.gif
```

Never embed a GIF exported from a recording in a docs page: it is five to ten times the size of the MP4 for worse text. A states GIF is a different thing (below).

## Before you commit

Read `references/checklist.md` and actually do it. The short version: contact sheet of every
frame read with your eyes, no mascot, no names, budgets met, the page and the clip in the same
commit, `docs-link-redirect-check` run (it checks `<video>` and `poster` paths).

## Remotion, in the plugin

`remotion/` holds the three house compositions (`Narrated` with the caption band, `HubExplainer`,
`AppsRange`) with Inter and a sample timeline; `remotion/README.md` is the six-step recipe
(record at 2x → `plan.json` → `scripts/pace.py` → studio → render → encode). `npm install` there
once; renders go to `remotion/out/`, never into the repo.

## What lives where

- Scripts and the compositor: in the plugin (`${CLAUDE_PLUGIN_ROOT}/skills/docs-clip/scripts/`), so they are
  versioned and reachable from every worktree. They used to sit gitignored in the docs repo.
- Raw takes and composites: the session scratchpad. They are large and disposable — and macOS
  purges `/private/tmp` after about three days, so anything worth keeping goes into the repo or
  into `notes/getting-started/DECISIONS.md` (or the section's own notes) the same day.
- Finished clips and posters: `public/<section>/…` in the docs repo, committed.

## States clip on a page

Two kinds of clip. A recording (`record.mjs` → `postgif.sh`) is for a flow with real pacing: a Kai
chat, a job running. A **states clip** is for a **behaviour a still cannot carry and the reader cannot
click**: a hover-revealed toolbar, a tooltip, a menu and what it opens, a tab choice that follows the
reader to the next page, a confirmation that disappears. Pick the plan from the "States GIF by UI
pattern" table in `references/clip-grammar.md`, and at STOP 2 ask the author for the frame: **the
whole screen** (Recommended) or **only the area where the action happens**. Build it in three steps:

1. `scripts/capture-states.mjs plan.json` (your logged-in Chrome over CDP, 760 px, 2x, masked, focus
   blurred, its own window).
2. `uv run --with pillow python scripts/ring-frames.py <frames dir> [--crop action]`: the ring fades in
   before each click, states dissolve into each other, the last dissolves back into the first; 30 fps;
   the whole screen unless `--crop action`. It prints the next command.
3. `scripts/states-to-gif.sh <out>.mp4 30 "<plan>"`: an H.264 loop (~110 KB for a full screen) and
   `<out>-poster.png` next to it.

On the page, directly under the sentence it proves, with one line of lead-in:

```mdx
<video autoplay loop muted playsinline poster="/<section>/<page>-<what>-poster.png" aria-label="<what happens, in order>">
  <source src="/<section>/<page>-<what>.mp4" type="video/mp4" />
</video>
```

Budget and the one-place rule: `references/clip-grammar.md` (≤ 250 KB, 3–9 s, ≤ 760 px wide, one
screen and its dialogs). For Slack or a PR, the same frames make a GIF:
`ring-frames.py --fps 10 --xfade 0.2 --ring-in 0.2` then `states-to-gif.sh <out>.gif 10 "<plan>"`
(a GIF as smooth as the MP4 weighed 720 KB, 2026-10-22).

Recorder hygiene learned the hard way (2026-09-22): never click an *ancestor* of some text to
dismiss a popover — one such click hit the top bar's "New Development Branch" button and opened its
dialog. Click the element itself, and verify with `kbagent branch list` afterwards if anything in
the top bar could have been touched. Rows in the new UI are `div.td` cells, not `<a>`: the name cell
opens the row, the table chip in the same line opens the table preview instead.
