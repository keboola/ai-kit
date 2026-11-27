---
name: docs-diataxis-check
description: "Use before handing off a keboola/connection-docs page, or when asked whether a page is one Diátaxis type with the house shape (lede, type marker, Next, Goal/Result, length) and no leaking VERIFY markers. Runs the rule script, then the diataxis-checker agent. Triggers: \"проверь по диатаксису\", \"diátaxis check\", \"frankenstein page\"."
---

# Diátaxis page check


## Working Directory Context

Run `scripts/check.mjs` from the root of a connection-docs worktree, or pass `--root <worktree>`. It reads `src/content/docs`, `_data/navigation.yml` and, with `--dist`, `dist/` there. The script locates its fixtures and rules itself.

## Overview

Every page in the docs is meant to be one Diátaxis type with one shape; the rules say so in
three places and nothing enforced them. This skill holds the one rule list,
`references/rules.md`, and two checkers for it: a script for what can be counted, and the
`diataxis-checker` agent for what has to be read. Each returns PASS or FIX, with every finding
tied to a rule id and a line.

A FAIL blocks the handoff. EVIDENCE about a page's type goes into the handoff as an open
question for the page owner; the page map is a human call.

## When to use

- Before the handoff of any page you changed, created or split.
- When a rework starts, to see what the pages already break.
- When asked whether a page is "really a how-to" or "two pages stapled together".

**Not for:** where a page lives or duplicates (`migration-placement`); whether its facts are
true (`fact-checker`); links, redirects and anchors (`docs-link-redirect-check`); prose style
beyond these rules (the humanizer stays the final pass).

## Procedure

1. Run the script from the repo root of the worktree you are checking. Pick one way to
   name the pages:
   ```bash
   S="${CLAUDE_PLUGIN_ROOT}/skills/docs-diataxis-check/scripts/check.mjs"
   node $S src/content/docs/data-apps/operate.md            # named pages
   node $S --base keboola/main                              # pages changed since the PR's base
   node $S --paths src/content/docs/data-apps               # a whole section
   ```
   Then the same call with `--json > <scratch>/diataxis.json` for the agent (any directory you
   can write to; the session scratchpad is fine). Add `--dist` after `npm run build` to catch
   markers that reached `dist/` (D9). In a worktree `main` can be stale; name the PR's base.
2. Fix every FAIL the script lists, re-run until the last line says `PASS`. The FAIL rules
   are D1 (frontmatter), D3 (lede), D4 (H1), D5 (Next) and D9 (markers), all cheap to meet.
   WARNs do not block, but D2 on a page you wrote takes one line: you know its type, source
   and the date you checked it, so add the marker.
3. Dispatch the `keboola-docs:diataxis-checker` agent with
   this prompt, filled in:
   ```
   Pages (repo root <worktree>):
     <absolute path per page, one per line>
   Rules: ${CLAUDE_PLUGIN_ROOT}/skills/docs-diataxis-check/references/rules.md
   Script JSON: <scratch>/diataxis.json
   Follow your brief. Read-only, no network, no searching for other pages.
   ```
   Nothing else goes in: no "find the changed pages", no section name. A narrow brief keeps
   it under twenty tool calls.
4. Read its verdict. The agent has no FAIL rules of its own; the FAILs it lists are the
   script's, passed through. Everything else it finds is EVIDENCE (`mixed`, a lede that says
   nothing, a link-directory overview, limits on top of a reference page, an audience split, a
   title not in the reader's words) and goes into the handoff under "Open questions", quoted
   with the evidence, for the page owner to decide. Fix what you agree with while the page is open.
5. Re-run the script after your edits and close the handoff with this block:
   ```
   Diátaxis check: ✓ PASS · 2 page(s) · 0 fail · 1 warn · 1 evidence (script) · PASS (agent)
   Open questions:
   - data-apps/operate.md:15 D13: "Read the app's state" is a UI inventory inside a how-to (agent)
   ```
   A page ships on PASS, with or without WARNs, and waits on FIX.

## Reading the script

```
src/content/docs/data-apps/operate.md  (type: ? · 64 lines · nav: Apps #7)
  D2  WARN     :6     no type declared: add `<!-- <Type>-type page. … -->` after the lede
  verdict: PASS (0 fail, 1 warn, 0 evidence)
```

One line per finding: rule id, tier, `:line`, what. The JSON (`--json`) adds `type.declared`,
`nav` (section, position, next page) and `counts` (step lists, tables, click sentences, concept
headings, tabs), which the agent reads instead of counting again. Exit 1 on any FAIL.

Tests: `node --test "${CLAUDE_PLUGIN_ROOT}/skills/docs-diataxis-check/scripts/check.test.mjs"` runs the
fixture repo under `scripts/fixtures/` (name the file; `node --test <dir>` fails on Node 26).
Add a fixture and a test before changing a rule.

## Common mistakes

| Mistake | Fix |
|---|---|
| Treating a `mixed` EVIDENCE as an order to split | It is evidence. Quote it in the handoff; the page owner approves the page map |
| Demanding a comment marker on a Getting Started page | `<PageMeta genre="…">` is the declaration there; the script already accepts it |
| Running on `src/content/docs/dist/**` or `dist/` | Those are build output; the script skips `/dist/` paths, pass source paths |
| Counting `# comment` in a bash fence as an H1 | The script masks fences; if you grep by hand, do the same |
| Giving the agent a section name and letting it find the pages | It stalls past the watchdog. Hand it the exact files and the JSON |
| Fixing a FAIL by deleting the marker or the `Next` line | A marker without an owner gets an owner; a broken `Next` gets the right target |
| Reading D1's 327 FAILs on main as a reason to skip the rule | That is the backlog. The rule holds for the pages you hand off |
