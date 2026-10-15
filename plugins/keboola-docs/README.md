# keboola-docs

**Version**: 0.4.1

Write, update, retire and ship pages on help.keboola.com (keboola/connection-docs, Astro +
Starlight) by the Diátaxis rules, with the checks, the media tooling and a commit gate in one
plugin. Maintainer: Nikita Zverev (docs revamp).

## Install

```bash
claude plugin install keboola-docs@keboola-claude-kit
```

## First run

You need: Node 22+, a connection-docs checkout with `npm install` done, `jq`, `gh` logged in, and
for media `ffmpeg` and `gifsicle`. Then, from the docs checkout:

```bash
/keboola-docs:docs-page new how-to page about <topic>
```

The skill proposes the type, place and media as a table and asks before it writes. For UI
screenshots from your own logged-in Chrome (Chrome 136+ needs a separate profile for the debug port):

```bash
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.keboola-shots/chrome-cdp"
```

For Remotion clips, run `npm install` once in `skills/docs-clip/remotion/`.

Heads-up: the commit gate runs on every `git commit` in a connection-docs checkout. A FAIL blocks
the commit with the reasons; `DOCS_GATE=skip git commit …` bypasses it when you mean to.

## What you get


| Do this | Skill |
|---|---|
| Write a new page from a PRDCT id or a phrase | `/keboola-docs:docs-page` |
| Change a page that exists (UI change, rename, VERIFY answer, stale screenshots or clips) | `/keboola-docs:docs-update` |
| Delete, merge, move or rename a page with redirects | `/keboola-docs:docs-retire` |
| Push and open the PR, on your "ok" | `/keboola-docs:docs-ship` |
| Check a page's Diátaxis type and shape (script + judge agent) | `/keboola-docs:docs-diataxis-check` |
| Verify links, anchors, media and redirects | `/keboola-docs:docs-link-redirect-check` |
| Flag claims you could not check live | `/keboola-docs:docs-verify-markers` |
| Record a clip, build an explainer (Remotion compositions ship in the skill), export a GIF | `/keboola-docs:docs-clip`, `demo-gif` |
| Pick the page elements (Prereqs box, Prompt/UI/CLI tabs, flow and stage strips, cards, diagrams) the Apps and Getting Started pages use | `/keboola-docs:docs-visuals` |
| Shoot a product-UI screenshot | `/keboola-docs:capturing-keboola-ui-screenshots` |
| Stage strip (numbered dots) with a UI-locator shot | `/keboola-docs:docs-stage-strip` |
| Split or reshape a section; port a dev-docs section; find the right home | `section-rework`, `devdocs-rework`, `migration-placement` |
| Label a PR by its ticket and files | `docs-pr-label` (also a hook) |
| Keep the MCP tools page in sync with the server | `mcp-tools-sweep` |

Agents: `diataxis-checker` (type and shape judge), `checker` (independent check of finished
clips, screenshots and pages), `fact-checker`, `guide-tester`.

The rules live in one file: `skills/docs-diataxis-check/references/rules.md`
(D1–D16, G1–G4 with tiers, who checks them and a live example each). Every other skill cites ids.

## The three authoring skills share one contract

Each one starts with a brief, proposes what it intends to do with the rule it used and one
alternative, waits for your "ok", applies the change, runs the checks and ends in a local commit.
There are three stops: the type and page map, the media list, and the commit. Nothing leaves the
machine until you say "ok" to `docs-ship`. State persists across sessions under the plugin's data
directory, keyed by checkout and branch, so a page can be resumed later.

## Hooks

| Event | What happens |
|---|---|
| PreToolUse on Bash, `git commit` in a docs checkout | Commit gate (`scripts/gate.mjs`): Diátaxis D1–D16 on staged pages, a retired page must have a `redirect_from` somewhere, deleted media must be unreferenced, the link check when `dist/` exists. FAIL denies the commit with the findings; WARN is printed. `DOCS_GATE=skip git commit …` bypasses it (say so in the handoff); `DOCS_GATE=strict` turns child timeouts into FAIL. The gate judges the staged blobs (what the commit will contain), or the working tree for `git commit -a`. |
| PostToolUse on Write/Edit of `_data/navigation.yml` | `npm run gen:sidebar` (never hand-edit `src/sidebar.mjs`) |
| PostToolUse on Bash `gh pr create` | labels the new PR (`docs-pr-label/rules.json` names the authors it labels for) |

## Layout

```
skills/      docs-page (templates/, references/phases.md, stops.md), docs-update, docs-retire, docs-ship,
             docs-diataxis-check (references/rules.md, scripts/check.mjs + tests + fixtures),
             docs-link-redirect-check, docs-verify-markers, docs-clip (references/, remotion/),
             docs-stage-strip, docs-visuals (references/catalog.md),
             capturing-keboola-ui-screenshots (scripts/shoot-cdp.mjs), demo-gif,
             docs-pr-label, section-rework, devdocs-rework, migration-placement, mcp-tools-sweep
agents/      diataxis-checker, checker, fact-checker, guide-tester
hooks/       hooks.json
scripts/     gate.mjs, media-inventory.mjs (--dist reads the built site), retire.mjs (+ tests),
             lib/source.mjs (working tree or git index), lib/media-refs.mjs (one parser for every
             image, video and srcset reference), trigger-evals.mjs, sidebar-regen.sh, pr-label.sh, checker/
evals/       ai-kit trigger-evals per skill
evals-behavior/  claude plugin eval cases: routing, outcome (tag outcome, scaffolded docs repo),
                 agent-docs (tag agent-docs: can an agent answer from help.keboola.com/llms.txt)
```

## Develop

```bash
cd plugins/keboola-docs
node --test skills/docs-diataxis-check/scripts/check.test.mjs scripts/*.test.mjs
claude plugin validate . --strict
claude plugin eval . --ablation none --trust-plugin   # behavioural cases in evals-behavior/
claude plugin eval . --tag outcome --scaffold --allow-tools Bash --ablation none --trust-plugin
node scripts/trigger-evals.mjs --votes 3   # local routing check through claude -p, no API key
```

`evals/<skill>/trigger-evals.json` are the ai-kit activation cases (Tier 1 in CI; `trigger-evals.mjs`
runs the same cases locally); `evals-behavior/` holds the
`claude plugin eval` cases (the manifest's `experimental.evals` points there).

## Not in v1

Workflow orchestration, `userConfig` for the label rules and the session path, a `STYLE.md`,
and the docs repo's own `CLAUDE.md`/`AGENTS.md` naming the namespaced skills
(keboola/connection-docs#1203, in review).
