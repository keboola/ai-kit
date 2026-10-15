# Clip grammar: which moving picture a page gets, and how it is captioned

Written 2026-10-14 after Nikita rejected a flat full-page recording with caption chips in the
bottom-left corner on the Apps "Pause and start" page. The house has three working forms; this
file names them, says when each one applies, and sets the caption and zoom rules they share.

## Three forms, by what the reader needs

| Reader needs to… | Form | House example | Budget |
|---|---|---|---|
| **See what a control does** (a menu and what it opens, a toggle, a tooltip, a state change) | **States GIF**: 3–7 stills, long holds, cropped to the control, no words in the picture; the sentence above it and the alt text carry the words | `getting-started/automate/add-task.gif` (73 KB, 7.8 s, 960×510), `load/forecast-row-code-editor.gif` (19 KB), the `extend/component/ui-options/ui-examples/*.gif` family | ≤ 250 KB, 3–9 s, 5 fps, `scripts/states-to-gif.sh` |
| **Follow a flow across screens** (open Kai, paste, approve, something is created) | **Narrated recording**: real capture at 2x, camera "full screen → cue → zoom 1.6x → return", outline ring before each click, a hollow-ring pointer, captions in a **band above the frame**, numbered steps, every speed-up labelled ("sped up 10×"), step dots | `getting-started/with-kai` where-kai clip (`~/docs-ops/remotion/where-kai`, take 8, 26 s) | ≤ 30 s, ≤ 1 MB, MP4 + poster, Remotion |
| **Understand an idea or a range** (what you can build, how Keboola works) | **Explainer**: typography and cards on the Keboola canvas, a line that draws itself, product stills on cards, phrases that change; no screen recording at all | `getting-started/hub-explainer.mp4` (10 s), `data-apps/apps-range.mp4` (22 s ring of five apps) | ≤ 10 s on a hub, ≤ 30 s elsewhere, ≤ 1 MB, Remotion, `explainer-look.md` |

A plain recording with nothing on it is acceptable for a **feature description** on an
explanation or reference page (what a screen looks like while it works), never for a how-to step:
there the reader needs to know where to click, which is a ring and a zoom, not a caption.

Choosing: if one still would do, use the still. If a still cannot carry it but the reader never
leaves one screen, a states GIF. If the reader moves across screens, the narrated form. If there is
no screen at all to show, the explainer.

## Captions: never on the UI

- Words go **outside the frame**: a band above the screen (where-kai: 80 px, white, Inter 600,
  27 px navy, numbered blue circle for a step, a light-blue pill for a speed-up), or nowhere (a
  states GIF). A caption laid over the page hides what the reader is being asked to look at and
  reads as a video-editor's overlay, which is the look Nikita turned down on 2026-10-14.
- The compositor's `chip` overlay (bottom-left, dark pill) is **retired for new clips**. It stays
  in `compositor.html` only so old clips can be re-rendered.
- One caption per beat, one line, ≤ 54 characters, shown only while the screen is still: "type,
  pause, annotate". During fast action, no caption (copilot screen-recording skill).
- The alt text (`aria-label` on `<video>`, the image alt on a GIF) says what happens in order,
  including values that move "on the day of recording".

## Rings in a states GIF

A states GIF has no pointer, so the frame before each click carries a **ring**: a rounded
outline in Keboola blue (3 px, radius 10, a soft 70-alpha glow 4 px outside, 4–6 px of padding
around the control) on the control the reader is about to click. Nikita asked for it on
2026-10-14 ("показывать курсором куда тыкаешь"). The sequence then reads: ring on the
control → the state it opens with a ring on the next control → … → the final state without a
ring. Draw rings on the 1x frames (Pillow, `uv run --with pillow`), never by hand in a screenshot
tool, and keep the ringed and unringed copies apart so the GIF can be rebuilt.

## Zoom and pointer

- "Full screen, cue, zoom, return": one or two seconds of the whole screen so the reader knows
  where they are, the ring lands on the target, the camera eases to 1.6x (Nikita, 2026-10-09:
  1.45x was not enough), the action happens, the camera pulls back before the next beat. Keep a
  landmark (the page title, the tab row) inside the zoomed frame.
- Do not zoom when the control is readable at 1x in the 713-px column, or when the surrounding
  context is the point (a whole flow canvas, an overview grid).
- Pointer: a hollow blue ring drawn by the recorder, parked off text after each click; the real
  cursor is hidden. Never a solid dot (it hid the labels it clicked), never an arrow drawn by hand,
  never a mascot.
- Waits are compressed, never cut silently: a labelled speed-up ("sped up 10×") in the band, or a
  hard cut with a white fade for a states GIF.

## Pacing numbers that worked

| Beat | Length |
|---|---|
| Whole screen before the first zoom | 1.4–2 s |
| Typing | 1x for the first words, then 6x; letters must still be visible |
| After a click, before the next beat | 0.6–0.8 s |
| A state the reader must read (a dialog, a badge) | 1.6–2 s in a GIF, 3–4 s with a caption |
| A labelled wait (Kai working, Deploying) | 2–4 s on screen whatever the raw length |
| Final state hold | 2.5–4 s, then fade through white for the loop |
| GIF frame rate | 5 fps for states, 9–15 fps for a recorded GIF outside the docs |

## What the rejected clip got wrong, as a checklist

- Full page at 1x: the ⋮ menu was 40 px in a 713-px column. Cue and zoom were missing.
- Captions as chips over the page, bottom-left: words on the UI instead of beside it.
- A 25 s wait compressed 12× with no label: the reader cannot tell real time from edited time.
- No step numbers, no ring before the click, no pull-back at the end.
- Placed at the top as a hero on a how-to: a how-to's picture sits under the step it proves.

## Sources beyond the house examples

- "Full screen, cue, zoom, return", keep a landmark, captions away from the click area:
  CapCut's zoom guide for tutorial videos.
- Typing at up to 6x, 9–15 fps, fade through white, no words inside the GIF, ≤ 256 colours:
  Superhuman, "How to create remarkable product GIFs".
- "Type → pause → annotate", 0.6–0.8 s after an action, 64 pt main message outside the frame:
  the awesome-copilot screen-recording skill.
- Changelog GIFs: tight crop, the exact change, readable at embed size, nothing decorative:
  Linear's changelog as the reference others cite.
