# Before a clip is committed

`${CLAUDE_PLUGIN_ROOT}` below is the keboola-docs plugin directory. Claude Code fills it in when a skill loads, not in this file and not in your shell; if a command finds it empty, set it first: `export CLAUDE_PLUGIN_ROOT="$(claude plugin list 2>/dev/null | awk '/keboola-docs@/{f=1} f && /Read from:/{print $3; exit}')"`.

Run through this every time. Each line is here because it went wrong once.

## What is in frame

- [ ] **Contact sheet read with your eyes**, not skimmed:
      `ffmpeg -y -i clip.mp4 -vf "fps=1/2,scale=440:-1,tile=6x5:margin=4:padding=4" -frames:v 1 sheet.png`
- [ ] No mascot, no character, no hand-drawn arrow. An outline and a caption chip are the only
      guides, and no scrim darkens the rest of the frame.
- [ ] No colleague names, avatars or e-mail addresses — they appear in list views (Transformations,
      Jobs, "Recently updated by"), so crop to the element or shoot a filtered view. PRDCT-616.
- [ ] No tokens, no git URLs with credentials (the data-app builder prints one in its terminal log),
      no other project's configuration names.
- [ ] **Every frame OCR'd for e-mail addresses**, poster included: `scripts/ocr-scan.swift` (build
      and run lines in its header). A contact sheet samples one frame in thirty; a DOM scrub lags a
      fresh render, and on 2026-10-09 the Apps list's "Last edited" e-mail stood in a raw frame for
      about a tenth of a second after navigation. Exit 1 is a stop.
- [ ] Shot in project 264, or in a dev branch of it. Never a customer project.
- [ ] The top bar is cropped out unless the clip is about the top bar.

## What it claims

- [ ] Every number visible in frame is one the page states, or the page says values move.
- [ ] Values that come from live data (a forecast, a job duration, a row count that changes) are
      called out as example values in the `aria-label` or the authoring comment. Read the dates off
      the frames; the recording day is often not the day they show (R3: rows dated 1 Oct, shot 15 Oct).
- [ ] The caption chips say something the page also says. A chip is a signpost, not a new fact.

## Budgets

- [ ] Duration ≤ 30 s on a page (a chat answer may run to ~36 s if the pacing is already at 9×).
- [ ] Size ≤ 1 MB. Over: `crf 31` → `fps 18` → `scale 1152` → cut content.
- [ ] `ffprobe -v error -show_entries format=duration -of csv=p=0 clip.mp4` and `ls -l` both
      checked, not assumed.
- [ ] Poster is the most informative frame, and it is a real file — a missing poster shows a black
      rectangle until the video decodes.
- [ ] Bright: `"${CLAUDE_PLUGIN_ROOT}/scripts/checker/clip_metrics.sh" [--states] <clip> <poster> <out>` reports luma mean
      at least 200, no frame under 180, and a bright poster.
- [ ] Captions at least 24 px on a 1280 canvas: the page column is 713 px, so that renders at 13 px
      (`clip_metrics.sh` prints the scale; `--page-width` overrides the column).
- [ ] Poster at most 250 KB. A 256-colour PNG is usually enough:
      `palettegen=max_colors=256` then `paletteuse=dither=none`.
- [ ] The `checker` agent has run on the clip and said PASS.

## Wiring

- [ ] `<video autoplay loop muted playsinline poster …>` with a descriptive `aria-label`.
- [ ] Clip, poster and the page that references them are in the **same commit**.
- [ ] `node "${CLAUDE_PLUGIN_ROOT}/skills/docs-link-redirect-check/scripts/check.mjs" --base <base> --paths <section>`
      passes (it resolves `<video>` sources and posters).
- [ ] `npm run build` clean, and the clip plays on the Vercel preview — a file that exists locally
      and 404s on the preview was never committed.

## Cleanup

- [ ] Anything created in 264 to make the shot (a throwaway configuration, a dev branch, a draft
      app) is deleted, and anything left behind is reported by name and ID.
- [ ] Raw takes stay in the scratchpad. They are large, and `/private/tmp` is purged after about
      three days — nothing that matters lives only there.
