# Remotion clips for help.keboola.com

Three compositions, one per form in `../references/clip-grammar.md`. Vendored from
`~/docs-ops/remotion/{where-kai,hub-explainer,apps-range}` on 2026-10-14 so a clip can be made
from any checkout. Fonts: Inter 4 (SIL OFL) in `public/fonts/`.

| Composition | Form | Data it needs |
|---|---|---|
| `Narrated` | a 2x recording with a caption band above the frame, camera to 1.6x, rings before clicks, labelled speed-ups, step dots | `public/timeline.json` + the paced mp4 it names (both written by `scripts/pace.py`) |
| `HubExplainer` | the Getting Started hub: a line that draws itself, then the guide's app on a card and "Want to build…" | `public/grid.png`, `public/screens/*.png` (shipped); edit the STEPS and PHRASES in the source |
| `AppsRange` | five app cards on a ring, one heading each | `public/clips/<key>.mp4`, `<key>-first.png`, `<key>-last.png` (not shipped; 1280x800 takes) |

## Make a narrated clip

1. Record at 2x into `~/.keboola-shots/<take>/raw.mp4` and log the click times
   (`capturing-keboola-ui-screenshots/references/keboola-ui-capture.md`: Chrome with
   `--force-device-scale-factor=2`, CDP screencast frames, a hollow-ring pointer, names out of frame).
2. Write `plan.json` next to the take: segments with speeds and holds, the click marks, camera
   keyframes, rings (raw px), captions (≤ 54 characters, a pill on every speed-up), steps. The
   docstring in `scripts/pace.py` is a complete example.
3. `cd <this folder> && npm install` (once), then `python3 scripts/pace.py <take>/plan.json`.
   It writes `public/<name>.mp4` and `public/timeline.json`.
4. `npx remotion studio` to check, then `npx remotion render Narrated out/<name>.mp4`.
5. Encode for the page (`../SKILL.md`, "Encode and place"): Remotion renders full range, so
   `-vf "scale=in_range=pc:out_range=tv,format=yuv420p"`; poster with `npx remotion still Narrated
   --frame=<n>`; budgets and the checker as usual.

## Make an explainer

Copy `src/examples/HubExplainer.tsx`, change the steps, phrases and screens, register it in
`src/Root.tsx`, render. Look and pacing: `../references/explainer-look.md`.

## Notes

- `remotion.config.ts` uses rspack and JPEG frames; `tsc` checks types (`npm run lint`).
- `public/*.mp4` and `public/clips/` are gitignored: sources are large and belong to the take.
- A render needs Chrome; Remotion downloads its own on first run.
