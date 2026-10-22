---
name: docs-retire
description: "Use when deleting, merging, moving or renaming a help.keboola.com page so every old URL still lands: picks the redirect target, adds redirect_from, fixes the nav and inbound links, folds merged text, lists orphaned media. Triggers: \"удали страницу\", \"слей страницы\", \"перенеси страницу\", \"merge these pages\", \"move the page\"."
---

# docs-retire: delete, merge, move or rename with redirects

## Overview

A page never just disappears: its URL is in search results, in other pages, in someone's
bookmarks, and on developers.keboola.com a retired page answers 200 with a meta-refresh body, so
a status-code checker will not tell you it is gone. This skill owns the operation; the verifier
stays `docs-link-redirect-check`, and the commit gate refuses a retired page whose slug no page
claims in `redirect_from`.

Script: `node "${CLAUDE_PLUGIN_ROOT}/scripts/retire.mjs"` (`--from <slug> --to <slug> [--merge]`
or `--from <slug> --rename <new-slug>`, `--dry-run`, `--json`, `--delete-orphans`). It never
touches `dist/`.

## Phases

| # | Phase | Does | Stop |
|---|---|---|---|
| 0 | **Brief** | Which page(s), and why: duplicate (name the page it duplicates), obsolete feature (name the changelog or the build that removed it), wrong home (name the right one). Evidence is supported-status and code, never traffic (docs repo CLAUDE.md). | |
| 1 | **Target map** | For each retired URL choose the target **by meaning** (migration-placement rules): the page that answers the same reader question, the new slug on a move, or the section overview when nothing answers it. Run the script with `--dry-run --json` and read: `redirect_from` lines to add (including the retired page's own old URLs, so no chains), the nav entry to remove or re-point, inbound links to rewrite (`linksRewritten`), media only this page used (`orphanMedia`). Add by hand: anchors readers may hold (`#id` links in the org's repos and the kramdown-era ids on dev-docs ports; keep a heading alias on the target), the `Next` chain around the hole (D12), and the dev-docs meta-refresh caveat when the page came from developers.keboola.com. **Propose** the table: retired → target · why · redirects · nav · links · media · anchors. | **STOP 1: ok on the target map** |
| 2 | **Apply** | Run the script without `--dry-run`. On `--merge` it folds the retired body into the target under a `TEMPLATE:` note: at the end of the target's own section on that topic when it has one (`## 6 AI Rules` for AI Rules; the JSON names it in `foldedInto`), else as a new section before the `Next` footer or a closing Limits/Related section: fold it in by hand now (one type per page, D8; keep what the target lacks, delete the rest) until no `TEMPLATE:` is left (D16). Fix the `Next` of the page before the hole. Delete orphaned media only after `media-inventory` confirms nothing references it (`--delete-orphans` or by hand). On `--rename` the media under the old URL's folder (and the files next to an `index.md`) move with the page and their references are rewritten (`mediaMoved`). The script regenerates `src/sidebar.mjs` when the nav changed. | |
| 3 | **Checks** | `npm run build`; `node "${CLAUDE_PLUGIN_ROOT}/skills/docs-link-redirect-check/scripts/check.mjs" --base keboola/main` (retired URL → a real page, no chain, no dead stub, nothing in `src/` or the nav still points at it); the Diátaxis check on the target (D5/D12 hold after a merge); `media-inventory` 0 missing. For a page that was also live on developers.keboola.com, say in the handoff that the dev-docs side needs its own redirect (another repo). | |
| 4 | **Commit** | Handoff block: retired → target table, redirects added, links rewritten (file: count), media deleted, anchors kept. `git add` the named files; `git commit -m "PRDCT-nnn: retire <slug> → <target>"` (no ticket: `<section>: retire <slug> → <target>`, never a made-up id); the gate checks the redirect. Then "say ok to ship" and stop. | **STOP 2: docs-ship only on "ok"** |

## Proposal format (phase 1)

A table, then an AskUserQuestion, as `${CLAUDE_PLUGIN_ROOT}/skills/docs-page/references/stops.md` fixes it (never a code block or a two-column layout). Example rows:

| Decision | Proposal | Why | Alternative |
|---|---|---|---|
| Target | `/data-apps/old-page/` → `/data-apps/operate/` | duplicate: same three tasks, older labels | section overview |
| Redirects | `redirect_from` on `operate.md` (+ carried `/components/data-apps/old/`) | no chains | |
| Nav | entry removed; `publish-and-share/` Next → `operate/` | D12 | |
| Links | `index.md` (1), `build-app/index.mdx` (2) rewritten | inbound links | |
| Media | `old-page-1.png` delete | only this page used it | keep |

## Guardrails

- A chain is a bug: carry the retired page's own `redirect_from` entries to the target (the
  script does), and never point a redirect at a page that is itself a redirect.
- Never retire by traffic. Never retire a connector catalog page without the registry saying the
  component is gone.
- A merge that leaves two voices on the target is a section-rework job, not a merge: say so.
- The gate's refusal ("retired, but no page lists … in redirect_from") is the design working:
  add the redirect, do not use `DOCS_GATE=skip` for it.
