# Clip grammar: which moving picture a page gets, and how it is captioned

Written 2026-10-14 after Nikita rejected a flat full-page recording with caption chips in the
bottom-left corner on the Apps "Pause and start" page. The house has three working forms; this
file names them, says when each one applies, and sets the caption and zoom rules they share.

## Three forms, by what the reader needs

| Reader needs to… | Form | House example | Budget |
|---|---|---|---|
| **See what a control does** (a menu and what it opens, a toggle, a tooltip, a state change) | **States clip** (still called a states GIF in this file): 2–7 stills (2 for a toggle or a confirmation), long holds joined by soft dissolves, the ring fading in before each click, no words in the picture; the sentence above it and the alt text carry the words. On a page it is a **30 fps MP4 loop** (`<video autoplay loop muted playsinline poster>`): as smooth as video at ~110 KB for a full screen, where a GIF that smooth was 720 KB (Nikita, 2026-10-22). A real GIF is only for Slack and PRs | `getting-started/automate/add-task.gif` (73 KB, 7.8 s, 960×510), `load/forecast-row-code-editor.gif` (19 KB), the `extend/component/ui-options/ui-examples/*.gif` family | ≤ 250 KB, 3–9 s, 30 fps, frames ≤ 760 px wide; the whole screen unless the author picks the action area at STOP 2; `scripts/capture-states.mjs` → `scripts/ring-frames.py` → `scripts/states-to-gif.sh <out>.mp4` (writes `<out>-poster.png`) |
| **Follow a flow across screens** (open Kai, paste, approve, something is created) | **Narrated recording**: real capture at 2x, camera "full screen → cue → zoom 1.6x → return", outline ring before each click, a hollow-ring pointer, captions in a **band above the frame**, numbered steps, every speed-up labelled ("sped up 10×"), step dots | `getting-started/with-kai` where-kai clip (`~/docs-ops/remotion/where-kai`, take 8, 26 s) | ≤ 30 s, ≤ 1 MB, MP4 + poster, Remotion |
| **Understand an idea or a range** (what you can build, how Keboola works) | **Explainer**: typography and cards on the Keboola canvas, a line that draws itself, product stills on cards, phrases that change; no screen recording at all | `getting-started/hub-explainer.mp4` (10 s), `data-apps/apps-range.mp4` (22 s ring of five apps) | ≤ 10 s on a hub, ≤ 30 s elsewhere, ≤ 1 MB, Remotion, `explainer-look.md` |

A plain recording with nothing on it is acceptable for a **feature description** on an
explanation or reference page (what a screen looks like while it works), never for a how-to step:
there the reader needs to know where to click, which is a ring and a zoom, not a caption.

Choosing: if one still would do, use the still. If a still cannot carry it but the reader never
leaves one screen, a states GIF. If the reader moves across screens, the narrated form. If there is
no screen at all to show, the explainer.

**One place per states GIF** (field test 2026-10-15, where a 4-screen, 1100 px, 10.4 s GIF failed
the checker): a states GIF shows one screen and the dialogs it opens, nothing else. When the task
crosses screens (Storage list → bucket → dialog → table), the numbered steps carry the route and
the GIF covers only the part on one screen, or the whole task becomes a narrated recording.
Capture at a **760 px** viewport: Keboola's menu and form labels are 14 px, and 713 / 760 × 14 keeps
them at 13 px in the page column (820 px left them at 12.2 px in the V8 field test, 1100 px near
9 px). Mask the project's schema and names before each shot, not afterwards.

**Where it goes in a numbered how-to:** under the last step the GIF shows, indented into that
list item. A GIF of steps 1–2 (menu → dialog) sits under step 2, never under a later step it does
not show (V8: a GIF of steps 1–2 placed under step 4 was a checker finding). On a page without
numbered steps, directly under the sentence that names the action the GIF shows.

**Crop and backdrop come from the scripts:** `capture-states.mjs` lightens a modal's dark veil
before each shot (a dialog frame at luma 163 failed the 200 budget, V9) and records each shot's
focus box (its ring, an open dialog, menu, listbox, tooltip or popper); `ring-frames.py` cuts every
frame to the union of those boxes and of what changed between frames, plus 24 px, at least 400 x 260
and shifted inside the frame. A top-level `"crop": [x, y, w, h]` in the plan names the area by hand
when the automatic one is wrong; `"keepBackdrop": true` on a shot and `--no-crop` turn them off; `"backdrop": 0–1` sets how dark the veil stays (default 0.15: lighter and the white dialog melts into the page, human test T2).
A dialog that scrolls inside the viewport grows the viewport to fit (the plan is replayed from its
`goto`, up to 1600 px), so the whole dialog is in the frame (V11: Minutes and the Preview were cut off).

### States GIF by UI pattern

Seven field runs on 2026-10-15 (G1–G7, each a different pattern) all failed the checker's first
pass on 0.7.1; this table is what the scripts do since, and what the plan has to say.

| Pattern | Plan | Watch for |
|---|---|---|
| Button → dialog | `click`, `shot` | the dialog's own X keeps no focus ring (blurred); a tall dialog grows the viewport |
| Menu (⋮) → item → dialog | `click` the ⋮, `shot` with a ring on the item, `click` it, `shot` | the ⋮ may live on the list row, not the detail page: target one row with `"in": { "css": "tr", "nth": n }`; a ⋮ that shows only on hover needs a `hover` first; the menu may stay drawn behind the dialog |
| Hover-revealed control or tooltip | `{ "hover": target }`, then `shot` (the pointer stays); for the menu it opens, `click` and a shot with `"keepPointer": true` (a click ends the hover) | pick the row with `"in": { "css": "<the row element, e.g. [role=row]>", "nth": n }`; a click on a hidden target warns |
| Tabs, or a link that opens a page | a ring on the tab before each `click`; the LAST shot has no ring | the crop follows what changed and snaps to whole text lines; a full-screen change wants a longer `"hold"` |
| Popover or side panel (no `role`) | `click`, `shot` | the diff crop takes it in; name it with `crop` if the page also moved |
| Target below the fold | ring it, or `{ "scroll": target }` first | scrolled to the middle automatically, also in Keboola's inner scroll box; warns if still outside |
| Transient state (toast, "Copied") | `click` with `"after": 100`, then `{ "shot": …, "fast": true }` | a fast shot skips the settle wait and keeps pointer and focus, which would close a tooltip. This is the one case where a still cannot do: the reader needs to see that the click answered |
| Control in the top bar | `"top": 0` | the organization and project names come into frame: mask both (the script warns) |
| Screen that breaks at 760 px | the narrowest width where it works (e.g. 960) | over 760 px labels fall under 13 px (ring-frames warns): split the GIF or show only the part that fits |
| Many names on screen (users, Events, Versions) | `"redact": [{ "css": "<the name column>" }]`, `"hideAvatars": true`, plus `mask` for the e-mail domain | a mask that matches nothing and a redact that matches nothing are both reported; at 760 px some tables drop their name column, so check `--list` before writing a redact |
| Canvas UIs (the flow Builder) | a ring on one node, a tight `crop` | canvas labels render near 9 px: if the crop must stay wide to show node and panel, it is a screenshot pair, not a GIF |

**Ask the frame at STOP 2.** The author picks, as an AskUserQuestion option in the media list: the **whole screen** (Recommended: the reader sees where they are; `ring-frames.py --crop full`, the default) or **only the area where the action happens** (`--crop action`: the rings, the dialog, what changed, never smaller than 60 % of the width and 40 % of the height). Never decide this silently: a small crop around one control read as a meaningless square (2026-10-22).

**Decide the form at STOP 2, before capture.** A states GIF fits when every state shows at one scroll
position and the area that changes fits in 760 px at a width where the screen renders properly. When
it does not (R4: the flow's task panel covers 75 % of the canvas at 760 px; R5: a target low on the
page and the next control at the top), propose a screenshot pair or a narrated recording instead.

**Placement on a page without steps:** directly after the sentence the GIF proves, but never inside a
paragraph pair that belongs together (R1 split a workspace passage) and never between a sentence and
the screenshot already under it: the GIF replaces that screenshot or goes after it (R5).

Find targets without writing probe code: `capture-states.mjs plan.json --list` prints the visible
buttons, links, tabs and menu items at each shot. Never dump a page's HTML or scripts while
probing: Keboola's inline script holds session tokens (G7).

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
  dissolve for a states clip.

## Pacing numbers that worked

| Beat | Length |
|---|---|
| Whole screen before the first zoom | 1.4–2 s |
| Typing | 1x for the first words, then 6x; letters must still be visible |
| After a click, before the next beat | 0.6–0.8 s |
| A state the reader must read (a dialog, a badge) | 1.6–2 s in a states clip, 3–4 s with a caption |
| A labelled wait (Kai working, Deploying) | 2–4 s on screen whatever the raw length |
| Final state hold | 2.5–4 s, then a dissolve back into the first state for the loop |
| Frame rate | 30 fps for a states clip (MP4 on the page; ring fade-in 0.25 s, dissolve 0.4 s); 10 fps with 0.2 s dissolves for a states GIF in Slack or a PR; 9–15 fps for a recorded GIF outside the docs. A 5 fps slideshow with hard cuts read as choppy (2026-10-22) |

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
