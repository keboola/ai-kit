---
name: docs-page
description: "Use when writing one new help.keboola.com page from a PRDCT id or a phrase, or resuming one: brief, type and place, template, draft, media, checks, local commit, with three stops for the author's OK. Triggers: \"новая страница\", \"напиши страницу про\", \"new page for\". Existing page: docs-update; delete or move: docs-retire."
---

# docs-page: one new page, brief to commit

## Overview

One page, one Diátaxis type, one commit. The skill does the routine (templates, nav, checks,
state) and **proposes** every judgement call (type, place, slug, media) with the rule it used and
one alternative, so the author's answer is "ok" or a correction, never a blank choice. Three stops:
after the type and page map, after the media decision, after the commit (push and PR are
`docs-ship`, only on an explicit "ok").

Rules: `${CLAUDE_PLUGIN_ROOT}/skills/docs-diataxis-check/references/rules.md` (D1–D16, G1–G4).
This file cites ids and never restates a rule. Long-form phase instructions:
`references/phases.md`. Templates: `templates/<type>.md`.

## Preconditions

- The cwd is a connection-docs checkout (`src/content/docs` and `_data/navigation.yml` exist) on a
  branch that is not `main`. If not, stop and say so: the author makes the worktree (their own
  helper, e.g. `wt-new.sh <branch> <suffix> --from keboola/main --link-deps`).
- Input: a `PRDCT-nnn` id (read the issue and its comments with the Linear tools) or a phrase.

## State and resume

State lives outside the worktree, so no `git add -A` can commit it:
`${CLAUDE_PLUGIN_DATA}/docs-page/<repo-dir-name>--<branch with / as ->.md` (the variable is empty in a shell and in a file you read directly: it is `~/.claude/plugins/data/keboola-docs-keboola-claude-kit`)
(frontmatter: `issue, title, type, template, slug, file, worktree, branch, phase, stops{type_ok,
media_ok, commit_ok}, media[], checks{}, commit, updated`; body: Brief, Page map (approved), Open
questions). **Every invocation reads this file first.** Found → print the phase and the three stop
flags, continue from `phase`; a stop that is already recorded is not asked again. "начни заново" /
`--restart` moves the file to `…/archive/` and starts at phase 0. Write the file at the end of
every phase, before the next one starts.

## Phases

| # | Phase | Exit when | Stop |
|---|---|---|---|
| 0 | **Brief**: reader, the question they arrive with, what they can do after, source of truth (UI in project 264 / API / a person for VERIFY), what "done" means | state has issue, title, brief, sources | |
| 1 | **Type and page map**: classify by the reader's need (section-rework "Diátaxis quick reference", D8/D13/D15); look for an existing home or duplicate (`git grep -il <topic> -- src/content/docs`, nav neighbourhood, migration-placement rules); propose type + rule + alternative, template, slug, file (.mdx only when components are needed), nav position with neighbours, `Next` target and which page's `Next` now points here, `redirect_from` if replacing | the map is in chat and in state | **STOP 1: "ok" on the map** |
| 2 | **Shape**: copy `templates/<type>.md`, fill frontmatter, lede, type marker, skeleton, Next; add the nav entry (the plugin's sidebar hook regenerates `src/sidebar.mjs`); run the check script on the page | 0 FAIL; only `TEMPLATE:` body blocks remain | |
| 3 | **Draft**: write from the sources; an unobserved fact gets a `VERIFY(owner)` comment (docs-verify-markers); remove every `TEMPLATE:`; length in the D6 band; humanizer pass on reader prose | `grep -c 'TEMPLATE:' <page>` = 0; 0 FAIL | |
| 4 | **Visuals and media**: pick the page's elements from `docs-visuals` (Before you start box, from/to cards, Prompt/UI/CLI tabs, FlowStrip, StageStrip, cards, collapsibles, SVG diagram) and its motion and screenshots from `docs-clip` ("Where the clip goes", `clip-grammar.md`); propose the list or "none" with the reason; then build each (docs-visuals, docs-clip, capturing-keboola-ui-screenshots, docs-stage-strip); `checker` agent on every clip | elements and media in place, twin reads them | **STOP 2: "ok" on the visuals list** |
| 5 | **Checks**: `npm run build`; check script `--dist --json` → `keboola-docs:diataxis-checker`; `docs-link-redirect-check --base keboola/main --no-build-check`; VERIFY list from the diff; `fact-checker`; `guide-tester` on tutorial/how-to; `checker` last. EVIDENCE goes to Open questions, never into a split | script PASS, agents PASS, links exit 0 | |
| 6 | **Commit**: show `git status --short` and the handoff block (type line, open questions, VERIFY list); stage page, media, nav, sidebar; `git commit -m "PRDCT-nnn: <title>"`. The commit gate runs the checks again and denies FAIL. Then: "say ok to ship" and stop | commit sha in state, phase `done` | **STOP 3: ship only on "ok" → docs-ship** |

Scripts (run from the worktree root):

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/docs-diataxis-check/scripts/check.mjs" <page>            # phases 2, 3, 5
node "${CLAUDE_PLUGIN_ROOT}/skills/docs-link-redirect-check/scripts/check.mjs" --base keboola/main --no-build-check
node "${CLAUDE_PLUGIN_ROOT}/scripts/media-inventory.mjs" <page>                              # phase 5: every media ref resolves
```

## How to propose (phases 1 and 4)

The format is fixed in `${CLAUDE_PLUGIN_ROOT}/skills/docs-page/references/stops.md`: a markdown table (Decision · Proposal · Why · Alternative, the
rule id in Why, a one-line Finding above it when something changed the picture), then the
question through the AskUserQuestion tool with the recommended option first. Never a code block,
never a two-column layout. The author picks or edits; never pick for them; never skip the stop.

## Guardrails

- One type per page (D8). If the brief needs two types, propose two pages, not one page with
  two voices.
- Titles in the reader's words, Keboola's own product names (D14); "connector"/"component",
  never "plugin" (D11); say "app", never "data app".
- Nothing invented: a claim you did not see live gets `VERIFY(<owner>)` with a real owner (D9).
- Getting Started pages carry G1–G4 (PageMeta, state sentence, Prereqs, verification block) and
  are exempt from D5 when they have the course bar.
- Never push, never open a PR, never merge from this skill. That is `docs-ship`, on "ok".
