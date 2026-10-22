# Explainer look: Remotion clips in Keboola's style

An explainer is a clip with no screen recording in it: a line that draws itself, numbered dots,
short phrases, a product still on a card. The Getting Started hub clip and the Apps range clip
are the two shipped examples. This file holds the look and the pacing they settled on, so the
next one starts from the same place. Reference projects (not in the plugin): the Remotion
projects under `~/docs-ops/remotion/` (`hub-explainer`, `apps-range`, `where-kai`), each with a
README that has the rebuild commands.

## Look (from `@keboola/design`, public npm package, light mode)

| Token | Value | Used for |
|---|---|---|
| Font | Inter, weight 600 for phrases, 500 for labels | every word |
| Text | `#1e293b` | phrases, labels |
| Keboola blue | `#2563eb` | dots, the line, the "Want to build" phrases; `#1f8fff` failed contrast (3.1:1), do not use |
| Canvas | `#f9fafb` | background |
| Card edge | `#e5e7eb` + a blue-grey shadow | the product-still card |
| Easing | `cubic-bezier(0.2, 0.7, 0.2, 1)` | every move; springs as in the kbl-content plugin |

No mascot, no character, no hand-drawn arrows (site rule). Fonts: Inter OTFs copied into the
project's `public/fonts/` (Raycast.app ships them); never load fonts from the network at render.

## Pacing (what the checker accepted)

- A dot every ~0.67 s; the whole line draws in 3.0–3.9 s. Nikita, 2026-10-06: the first cut's line
  was ~1.5x too fast.
- Labels under a dot: one line, about 54 characters at most. A two-line label (79 chars) failed the
  checker: too much to read in 3.9 s.
- Phrases that change ("Want to build … an app like this one? / an interactive dashboard? / a
  what-if simulator?"): at least 1.7 s each. Four phrases in the same slot (1.2 s each) failed.
- Every phrase is something the page also says, and every claim has a build behind it: "an
  approval form" was dropped because no build backed it (fact-checker).
- Getting Started hero clip: 10 s at most (Michal Jeřábek, 2026-09-30). One screen of the app the
  guide really builds; other apps' screens do not belong in the hub clip.
- Fade through white between scenes, not a cut to black.

## Encode and measure

Remotion renders full-range video (`yuvj420p`, `color_range=pc`), which reads about 18 luma
points higher than the tv-range files the budgets were set on. Convert before measuring:

```bash
ffmpeg -y -i out/clip.mp4 -vf "scale=in_range=pc:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 28 -movflags +faststart -an public/<section>/<clip>.mp4
npx remotion still <composition> --frame=<n> public/<section>/<clip>-poster.png
```

Then the usual budgets: at most 1 MB, mean luma at least 200 and no frame under 180, poster
bright and under 250 KB, text at least 24 px on a 1280 canvas (`clip_metrics.sh`). The hub clip
shipped at 201 KB with luma 228/227 after conversion.
