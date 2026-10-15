# docs-page phases, long form

SKILL.md has the table; this file has what each phase does when the table is not enough.
Rule ids refer to `../../docs-diataxis-check/references/rules.md`.

## Phase 0: brief

From a PRDCT id: read the issue title, description and every comment (Linear tools). From a
phrase: ask, one question at a time, only what the phrase leaves open:

1. What does the reader need to do or understand when they leave the page? (one sentence)
2. Where is the truth: a screen in project 264 (which one), an API (which call), a repo
   (which file), or a person (who answers VERIFY)?
3. What does "done" look like for the author: a page, a page plus a screenshot, a clip?

Write the brief into the state file as four lines: Reader, Question, Outcome, Sources.
Do not ask what type the page is. That is phase 1's proposal.

## Phase 1: type and page map

Classify by the reader's need, not by the material:

| The reader wants to… | Type | Smell that says otherwise |
|---|---|---|
| learn by doing, once, safely | tutorial | option matrices, "or you can…" |
| get one task done, now | how-to | explaining the concept first, full field tables |
| look a value up | reference | narrative, steps, opinions |
| understand why / the model | explanation | numbered steps, field tables |

Then look for the home:

- `git grep -il "<two or three words from the brief>" -- src/content/docs` and read the hits.
  An existing page that already answers half of it means `docs-update`, not a new page. Say so.
- Open `_data/navigation.yml` around the section; the new page's neighbours decide its `Next`
  and who points at it (D12: nav order is the reading order).
- Slug = section/page, the page's words, singular nouns, no "data-app" (say "app").
- `.mdx` only when the page needs a component (Tabs, PageMeta, StageStrip, a video with
  controls); otherwise `.md`.
- A page under `getting-started/` carries G1–G4 and uses the course bar; propose the GS
  variant of the tutorial template.
- A component catalog page (`components/<kind>/<cat>/<name>/index.md`) uses `component.md`,
  has no `Next` (catalog exemption, 2026-10-13) and gets `search_keywords`.
- A page ported from developers.keboola.com uses `dev-reference.md` and keeps the old URL in
  `redirect_from` (`/extend/…` or `/integrate/…`); read devdocs-rework for anchors.

Stop with the proposal block. Record `stops.type_ok` with the timestamp of the author's answer.

## Phase 2: shape

1. `cp "${CLAUDE_PLUGIN_ROOT}/skills/docs-page/templates/<type>.md" <file>` and fill the
   frontmatter and the lede; set the type marker's `Source:` and `Verified <date>`.
2. Nav: add `- url: /<slug>/` + `title:` at the agreed place in `_data/navigation.yml`. The
   plugin's PostToolUse hook runs `npm run gen:sidebar`; do not hand-edit `src/sidebar.mjs`.
3. Re-point the previous page's `**Next:**` at the new page when the map said so.
4. Run the check script on the new page and on the re-pointed neighbour. The skeleton must
   already pass D1, D3, D4, D5; the remaining `TEMPLATE:` blocks are the body (D16 will fail
   until phase 3 is done, which is expected here).

## Phase 3: draft

- Write each section from the source named in the brief. Open the screen or call the API;
  copy labels exactly as the UI shows them (bold for UI labels, fences for commands).
- Anything you could not observe: `<!-- VERIFY(<Owner>): <what to check> -->` next to the
  sentence (docs-verify-markers has the forms). Placeholder owners fail D9.
- Delete every `TEMPLATE:` line, including the ones in the frontmatter.
- Length: 50–220 lines (D6). A how-to over 220 is two how-tos; an explanation under 50 is a
  paragraph on its parent page.
- Final pass: the humanizer skill on reader-facing prose.

## Phase 4: visuals and media

First the page elements: read `${CLAUDE_PLUGIN_ROOT}/skills/docs-visuals/references/catalog.md` and pick by what the reader
needs (a task page gets the Before you start box and, with more than one way through, the Prompt /
UI / CLI tabs; a "how it works" passage becomes a FlowStrip; 3 to 6 ordered stages a StageStrip; an
end with several destinations a CardGrid). Then motion and screenshots. Decide from the page, not from habit:

| Page type / place | Default | Earns more when… |
|---|---|---|
| how-to (Apps, Storage, Flows…) | one UI-locator screenshot per screen a step ends on | a stage strip when the reader walks 3–6 stages in order (docs-stage-strip) |
| tutorial | screenshots at the checkpoints | one clip when something moves (Kai working, a job progressing) |
| reference, explanation | none | a diagram (hand-authored SVG under `public/<section>/`) when the model is spatial |
| Getting Started hub | the hero explainer, ≤ 10 s | never a second clip |
| component page | the Connection and Row configuration screenshots | nothing else |

Propose the list with file names (`public/<section>/<page>-<what>.png`) and the reason; stop;
record `stops.media_ok`. Then run the skill for each item. Every clip goes through the `checker`
agent before it counts as done; every screenshot is read for names, tokens and the promo toast
(capturing-keboola-ui-screenshots/references/keboola-ui-capture.md).

## Phase 5: checks

In this order, fixing in place between steps:

1. `npm run build` (needed for `--dist` and the link check).
2. `node …/docs-diataxis-check/scripts/check.mjs --dist --json <page> > <scratch>/diataxis.json`,
   then dispatch `keboola-docs:diataxis-checker` with the page path, the rules path and the JSON.
   FAIL → fix. EVIDENCE → write into Open questions in the state file.
3. `node …/docs-link-redirect-check/scripts/check.mjs --base keboola/main --no-build-check`.
4. `git diff keboola/main -- <page> | grep -n 'VERIFY('` → the VERIFY list for the handoff.
5. `fact-checker` agent on the page (standing authorization in the docs repo).
6. `guide-tester` agent on a tutorial or how-to.
7. `checker` agent last, with the session transcript path, the deliverables and a scratch dir.
   FIX → fix and re-run until PASS.

## Phase 6: commit

Handoff block (goes into the commit body and later the PR body):

```
Diátaxis: how-to · templates/how-to.md · check PASS · diataxis-checker PASS
Media: public/data-apps/pause-menu.png (UI-locator, 2x, names cropped)
VERIFY: VERIFY(Michal): the 15-minute default (data-apps/pause.md:41)
Open questions: none
```

`git add <page> <media> _data/navigation.yml src/sidebar.mjs` (never `-A`), then
`git commit -m "PRDCT-nnn: <title>" -m "<handoff block>"`. The commit gate (PreToolUse hook)
re-runs the Diátaxis check and refuses FAIL; `DOCS_GATE=skip git commit …` is the hatch for a WIP
commit and must be said out loud. Record the sha, set `phase: done`, and end with:
"Committed <sha>. Say ok to ship (push + PR via docs-ship)."
