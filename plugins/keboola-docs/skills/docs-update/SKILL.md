---
name: docs-update
description: "Use when an existing help.keboola.com page must change: a renamed button or UI change, an owner answered a VERIFY marker, a review comment, or stale screenshots and GIFs need a reshoot. Builds the impact map, stops for OK, applies, re-checks. Triggers: \"обнови страницу\", \"владелец ответил\", \"скрины устарели, переснять\", \"update the page\"."
---

# docs-update: maintain a page that exists

## Overview

Same contract as `docs-page` (state file, proposals with the rule, three stops, the commit gate,
`docs-ship` on "ok") for a page that is already live. The hard part is finding everything one
change touches: the sentence, the alt text, the screenshot, the other page that says the same
thing, the VERIFY marker that the answer settles. The impact map is the deliverable of phase 1;
nothing is edited before the author says ok to it.

Rules: `${CLAUDE_PLUGIN_ROOT}/skills/docs-diataxis-check/references/rules.md`.
State: `${CLAUDE_PLUGIN_DATA}/docs-page/<repo-dir>--<branch>.md` (empty variable: `~/.claude/plugins/data/keboola-docs-keboola-claude-kit`) with `mode: update` (same
format and resume behaviour as docs-page).

## Phases

| # | Phase | Does | Stop |
|---|---|---|---|
| 0 | **Change brief** | What changed and how it is known: a ticket, a changelog post, a UI build (date, what the screen shows now), an owner's answer (quote it), a reviewer's comment (quote it). Precondition as docs-page: a docs checkout on a non-main branch. | |
| 1 | **Impact map** | Text: `git grep -n "<old label or term>" -- src/content/docs` (also the singular/plural and the old product name). Media: `node "${CLAUDE_PLUGIN_ROOT}/scripts/media-inventory.mjs" --dates <page or section>` lists every image, video and poster the pages reference, whether it exists, its last commit date and which other pages share it; a shot older than the UI change, or of a screen the change touched, goes on the reshoot list. Markers: `git grep -n "VERIFY(<Owner>)" -- src/content/docs` for the owner who answered. A marker with no answer yet: look for its source of truth before calling it unverifiable: the component's `sourceCodeUrl` in its public metadata (`/v2/storage` index), then a global `gh search code` for two or three distinctive config keys or strings from the page (third-party snapshots count, say which), then the API spec; name what you searched in the map. Type: if the change adds steps to an explanation or a table to a how-to, say so as EVIDENCE (D8) and propose section-rework, never a silent split. UI path: before planning any shot, walk the path the page (or the brief) describes, read-only, with `capture-states.mjs plan.json --list`: a label or menu item that is gone, or a control that lives on another screen (G1, G2, G5 briefs named UI that no longer existed), goes into the map as a Finding for the author, never silently adapted. A label you find renamed is a text change too: `git grep` the old label across the docs and put every page that uses it in the map; the screenshots that still show it come from `media-inventory.mjs --text "<old label>" <pages>` (OCR, macOS; the commit dates cannot tell, human test T1) (R7 left "Users & Settings" on 10 pages). A GIF whose action no sentence on the page names gets its sentence proposed in the map; on an explanation or reference page, prefer a link to the how-to that has the steps (R2). **Propose** the map: hunks (file:line → new text), media (file → reshoot / re-render / delete, reason), markers (file:line → resolved sentence), pages that share a swapped file. | **STOP 1: ok on the map** |
| 2 | **Text** | Apply the hunks, keeping each file's line endings (many pages mix LF and CRLF: edit with Python `open(newline="")`, then `git diff --stat` must count only the lines you meant; the gate denies an ending-only change). Resolve a marker by replacing the comment with the verified sentence and bumping the page's `Verified <date>` in its type marker. Humanizer on changed prose. The check script on every touched page: 0 FAIL that this change introduced. A FAIL the page already had on main (the gate reports it as "already on main") is not this change's job: list it under Open questions as a follow-up, do not fix it here. | |
| 3 | **Visuals and media** | Only the items on the map. A page that is all prose where its siblings use the Apps and Getting Started elements gets a `docs-visuals` proposal in the map (EVIDENCE, the author decides). Same crop and name → overwrite the file; different crop → new name, update every page that referenced the old one (the inventory's `referencedBy`), delete the old file (and its byte-identical twin under another path when one exists). Clips: re-render through docs-clip's recipe (an MP4 with its poster; a states clip through capture-states → ring-frames → `states-to-gif.sh <out>.mp4`, which writes its poster); `checker` agent on each, given the session transcript path (a subagent run has none: say so and pass the author's request in their words instead), the files and a scratch dir. A states GIF's plan comes from the pattern table in `docs-clip/references/clip-grammar.md`. Screenshots: capturing-keboola-ui-screenshots, reading its capture reference (`${CLAUDE_PLUGIN_ROOT}/skills/capturing-keboola-ui-screenshots/references/keboola-ui-capture.md`) first (2x, 1100 px, names cropped, toast removed). Alt text updated when the screen changed. A standalone "reshoot the screenshots on X" enters here, with phases 0–1 reduced to the inventory. | **STOP 2: ok on the media list**, before any capture: the list carries the planned form, viewport, frame (whole screen or action area: ask the author), states, length and the step each clip sits under; capture only after the ok (skipped when the map has no media) |
| 4 | **Checks** | As docs-page phase 5 on every touched page: build, check script `--dist`, `keboola-docs:diataxis-checker`, `docs-link-redirect-check --base keboola/main --no-build-check` (it resolves the swapped media paths), `media-inventory` (0 missing), fact-checker, guide-tester on how-to/tutorial pages, `checker` on media. Record the results in the state file's `checks{}`. Commit only after every check and agent has returned, the checker, diataxis-checker and fact-checker included (R2 committed while two were still running). If a check changes a fact the author approved at STOP 1 (a source turns up, a label differs), show the map again with the change marked and wait. | |
| 5 | **Commit** | Handoff block: hunks applied, media swapped (old → new), markers resolved, pages touched. `git add` the named files (never `-A`), then `git commit -m "PRDCT-nnn: <what changed>"` in a separate call (the gate refuses both in one command; without a ticket: `<section>: <what changed>`). Then "say ok to ship" and stop. | **STOP 3: docs-ship only on "ok"** |

## Proposal format (phase 1)

A table, then an AskUserQuestion, as `${CLAUDE_PLUGIN_ROOT}/skills/docs-page/references/stops.md` fixes it (never a code block or a two-column layout). The options of an update's STOP 1 are its own: **Apply the map (Recommended)** · **Change a row** (the author names it) · **Narrow it to the brief** (drop rows the brief did not ask for, keep them as follow-ups) · **This needs a rework** (hand over to section-rework). Example rows:

| Decision | Proposal | Why | Alternative |
|---|---|---|---|
| Text | `operate.md:22` **Open App** → **Open** | UI build DZIl0CMv, 2026-10-02 | |
| Media | `app-actions-menu.png` reshoot | shows Open App; 1100 px, 2x, ⋮ menu | keep and note the old label |
| Shared | `publish-and-share.md` alt text | same file on two pages | |

## Scripts

Run from the worktree root (`${CLAUDE_PLUGIN_ROOT}` empty in your shell: see `docs-page/references/phases.md`):

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/docs-diataxis-check/scripts/check.mjs" [--dist] <page>…      # phase 2 and 4
node "${CLAUDE_PLUGIN_ROOT}/skills/docs-link-redirect-check/scripts/check.mjs" --base keboola/main --no-build-check
node "${CLAUDE_PLUGIN_ROOT}/scripts/media-inventory.mjs" [--dates] [--dist] [--twins] <page>…  # phase 1 and 4
```

State: create `${CLAUDE_PLUGIN_DATA}/docs-page/` when it is missing; the file is
`<worktree directory name>--<branch, / as ->.md`.

## Guardrails

- The map is complete or it is wrong: one missed alt text ships a stale shot. Grep the term in
  `src/` and `public/` (SVG text) before proposing. A hit the author's brief leaves out is still a
  row, marked "outside the brief", and goes to Open questions when the author narrows the map.
- Never widen into a rewrite. A page that needs a new shape is a section-rework proposal, named
  in Open questions.
- A resolved VERIFY becomes a sentence with the owner's answer, dated in the type marker, never a
  second comment.
- Delete media only after `media-inventory.mjs --dist` (on a fresh `npm run build`) lists it as
  unreferenced: that reads what the built pages and the markdown twins actually load, relative refs
  and raw `<img>` included. The page-source list agrees with it on main (2026-10-14), but the build
  is the ground truth. Delete both copies when a file was duplicated across `public/` paths.
- Never push or open a PR from here.
