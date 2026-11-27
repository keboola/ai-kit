---
name: mcp-tools-sweep
description: "Use when an alert, task or review says the MCP server docs page's tool list is outdated or has drifted from keboola/mcp-server TOOLS.md, or when asked to reconcile that list; collapses several drift alerts into one sweep."
---

# MCP tools drift sweep

## Overview

The tool inventories on `src/content/docs/ai/mcp-server/index.md` (help.keboola.com `/ai/mcp-server/`) are a **hand-copy of the generated [`TOOLS.md`](https://github.com/keboola/mcp-server/blob/main/TOOLS.md)** in `keboola/mcp-server`. TOOLS.md regenerates with server releases, so the page drifts and drift alerts recur.

**Core rule: never act on the alert's specifics — re-derive current state.** Alerts arrive stale (the 2026-08 "semantic tools missing" alert landed after #1061 had already merged; the *real* drift was three different read-only tools). Multiple alerts about this page = one sweep against today's TOOLS.md.

## Step 0 — Staleness/dedupe gate

```bash
gh pr list --repo keboola/connection-docs --state all --search "mcp in:title" --limit 10 --json number,title,state,mergedAt
gh api 'repos/keboola/mcp-server/commits?path=TOOLS.md&per_page=3' --jq '.[] | .sha[0:7] + " " + .commit.committer.date + " " + (.commit.message | split("\n")[0])'
```
If an open/just-merged PR already covers the delta, report that instead of duplicating. Quote URLs with `?` (zsh "no matches found").

## Step 1 — Fetch source of truth

```bash
curl -sL https://raw.githubusercontent.com/keboola/mcp-server/main/TOOLS.md -o /tmp/TOOLS.md
awk '/^## /{tool=$2} /^\*\*Annotations\*\*/{print tool": "$0}' /tmp/TOOLS.md   # per-tool annotations
sed -n '/^## Index/,/^---/p' /tmp/TOOLS.md                                    # categories + tools
```

## Step 2 — Diff against the page (two inventories)

Page on `keboola/main` (`git show keboola/main:src/content/docs/ai/mcp-server/index.md`). Beware: `management/project/mcp-server/` is a different (setup) page — don't touch it.

1. **Available Tools** — category bullets. Every TOOLS.md category must be represented (category level only, no per-tool list).
2. **Read-Only Tools** table — must equal exactly the set annotated `read-only` in TOOLS.md, grouped by the same categories.

Classify: missing / documented-but-gone / duplicated. Ambiguity → flag, don't guess.

## Step 3 — Fix (only if drift)

No drift → report "no drift vs TOOLS.md @ <sha>" and stop. Otherwise: **additive + dedupe only, no reorg** — same table format, alphabetical within a row. Keep the existing "see TOOLS.md for current annotations" link.

## Step 4 — Verify

`npm run build` clean; then grep `dist/ai/mcp-server/index.html` for the new tool names, count table rows in the read-only region, confirm `id="read-only-tools"` anchor.

## Step 5 — Ship

One worktree per PR: branch from the upstream `main`, name `PRDCT-580-<what>-sweep`, push to your fork. PR title must start `PRDCT-<id>:` (CI gate). PR body = sweep record: TOOLS.md sha + date, read-only counts (TOOLS.md vs page), exact delta, what was deliberately not touched, build/render proof. **Open the PR only if the user said to; never merge** — merging is Nikita's click.

## Common mistakes

- Trusting the alert's tool names/state instead of re-deriving (alerts are stale).
- Checking only the Read-Only table and forgetting Available Tools category coverage (or vice versa).
- Editing the setup page `management/project/mcp-server/` instead of `ai/mcp-server/`.
- Counting rendered rows with a naive `grep -c '<tr>'` — parse the `read-only-tools`→`examples` HTML region instead.
