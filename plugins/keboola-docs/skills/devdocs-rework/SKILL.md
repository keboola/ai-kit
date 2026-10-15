---
name: devdocs-rework
description: "Use when reworking a section ported from developers.keboola.com (extend/, Generic Extractor, Generic Writer, storage/api, pages with an /extend/ or /integrate/ redirect_from): merging sibling families, pulling cookbooks out of reference pages, keeping kramdown-era anchors. Extends section-rework."
---

# Dev-docs rework — what a 1:1 port needs that a native section doesn't

## Overview

`section-rework` owns page SHAPE and is the parent procedure: classify → **propose the page
map and stop** → split verbatim → reshape → nav → verify. **Follow it.** This skill records
only what is different when the section arrived from developers.keboola.com, so the parent
isn't restated here. The rule list (ids, tiers, examples) is
`${CLAUDE_PLUGIN_ROOT}/skills/docs-diataxis-check/references/rules.md`; cite ids, never restate rules.

What is different: these pages were never authored for help. They were ported by a script.
So the defects come in classes, not one-offs — and two of them are the opposite of the
frankenstein split `section-rework` was built for.

**Measured on the 101 ported pages (2026-09-02):** 32 exceed 250 lines · four exceed 1,200 ·
~6,000 lines of examples sit inside reference pages · zero type markers, zero `VERIFY()`
flags, zero `Next` footers · anchors already broken before anyone touches them.

## The three moves

### 1. Collapse uniform families — the move `section-rework` doesn't have

A ported tree grows one page per *variant of the same thing*: 8 authentication methods,
6 pagination strategies, 4 manifest shapes. Each is 40–250 lines, identically structured,
and none is a page a reader wants alone — they want to **compare** and pick one.

**Fold the family into one reference page: an at-a-glance table, then one `##` per variant.**

This is not a new invention — it is the shipped Apps move. `data-apps/` had
`oidc/auth0/`, `oidc/google-cloud-platform/`, `oidc/microsoft-entra-id/`, `oidc/okta/` as
four pages; #1013 folded them into one `authentication.md`, and `backend-versions`,
`storage-access`, `terminal-log-tab` into one `reference.md`. Result: 16 nested pages → 11
flat ones.

Fold when: siblings share a heading skeleton · differ only in *which* variant they document ·
none is a task on its own · combined length stays inside the band below. Don't fold when a
sibling is a genuine task with its own `Next` step, or when the combined page passes ~250 lines
with no internal comparison to justify it.

### 2. Extract cookbooks out of reference

Ported reference pages carry their examples inline, and the examples win: `config/jobs`
is 75% examples, `mappings` 90%, `jobs/children` 87%, `login` 88%. A reference page whose
last three quarters are worked scenarios is two documents stapled together.

**The examples move verbatim to a sibling page (type: how-to, `sidebar.label: Examples`);
the origin keeps a `## Examples` stub of one paragraph plus the link.** The repo already
ships this shape — `generic-writer/configuration-examples/`,
`extend/component/ui-options/configuration-schema/examples/`.

Find the cut with heading offsets, not by eye:

```bash
grep -n '^##' src/content/docs/<page>/index.md   # first example heading = the cut line
```

Keep reference blocks that merely *look* like examples. On the GE `functions` page the cut is
line 854 — "Function Contexts" above it is reference and stays.

### 3. Rebuild around reader needs, flatter

The precedent band is **50–220 lines per page, 1–2 nav levels** (`cli/` is 8 flat pages;
`data-apps/` 11). Ported trees run 250–1,536 lines and up to **7 levels**. Target the band.
Names are reader-need names — `getting-started`, `workflows`, `commands`, `troubleshooting` —
never the source tree's nouns.

## Anchors: inventory from `dist/`, never from markdown

**The trap:** these pages carry kramdown-era ids. A link says `jobs/#dataType`; the heading is
`## Data Type`; Starlight (github-slugger) renders `id="data-type"`. The link is **already
broken today** and a markdown-based inventory will happily confirm a match that doesn't exist.
Double-dash ids (`#output-mapping--delete-rows`) are the other tell.

```bash
# 1. baseline — build main in a clean worktree first
grep -rho 'id="[^"]*"' dist/<tree>/ | sort -u > /tmp/before.txt

# 2. who points in (in-repo, then the org — fragments survive a 301)
git grep -nE '\]\(/<tree>/[^)]*#' -- src/content/docs
gh search code "developers.keboola.com/<section>" --owner keboola

# 3. after the split, rebuild, then:
grep -rho 'id="[^"]*"' dist/<tree>/ | sort -u > /tmp/after.txt
comm -23 /tmp/before.txt /tmp/after.txt        # anchors that vanished — must be zero unaccounted
```

Every vanished anchor is either still on the origin page or repointed in the same PR.
Pre-existing broken anchors you find on the way: fix them, and report them **separately** —
they predate your change and inflate the diff's apparent risk if you don't say so.

`audit-phase2.mjs` validates paths, not fragments; #1073 adds the detector. Until it lands,
the `comm` diff is the gate.

## Provenance: verify against the source the port came from

Source A is the **`devdocs` remote**, which is already a remote in this repo and whose paths
mirror the old site:

```bash
git show devdocs/main:<section>/<page>.md      # what the page said before the port
```

Then platform reality (`fact-checker`'s Source B). **The dev originals carry the upstream
README's factual errors** — verify against component *code*, not the README it was written
from.

Cheapest source of truth for component ids, `flags` (`deprecated`, `excludeFromNewList`) and
live `configurationSchema`: `curl -s https://connection.keboola.com/v2/storage`.

## Known rot classes — grep for these before reading

A ported tree rots in patterns, so sweep for the pattern rather than discovering it page by
page. Verified stale as of 2026-09-02:

| Grep | Why it's rot |
|---|---|
| `travis` | The tooling ships **no** Travis template; `component-generator/templates-ci` has github-actions / bitbucket / gitlab only |
| `quay.io` | Transformation images last tagged 2021; `python-transformation-v2` archived 2026-08-06, sources now private |
| `component-generator` | Frozen since 2023; `cookiecutter-python-component` is the live Python entry point |
| `developers.keboola.com` | Links home to the site being retired — flip only when the target exists on help |
| `TODO:` / `FIXME` | Renders in public prose; two were shipping on GE pages |
| `sandbox` | Now Workspaces |
| `ex-docs-tutorial` | The example repo is **404**; 5 pages depend on it |

Deletion is decided by **supported-status + code, never traffic**, and every deletion carries
its evidence inline as `VERIFY(owner)` so a reviewer can challenge it. A section that is
merely *deprecated but still accepted by the platform* (`delete_where_*`, `processed_tags` in
the `docker-bundle` schemas) **stays** — a reference must list what the API takes.

## Conservation proof for large verbatim moves

A 4,800-line move is unreviewable by reading. Prove it mechanically, in the PR body:

- per-page line sums before → after (they must add up)
- `git diff --color-moved=dimmed-zebra` on the verbatim commit — reviewer sees moves, not rewrites
- marker strings: pick ~10 distinctive strings from the moved content, show each resolves
  exactly once tree-wide (#1074 did this with 23 markers)

**Two commits minimum: A = verbatim move, B = rewrite.** Never one — a split plus a rewrite in
one diff loses content silently, and the reviewer cannot tell which is which.

## Sizing to the review queue

Review throughput is the binding constraint, not authoring. Keep **no more than two READY
PRs** from a rework initiative at once, and prefer riding an existing open PR over opening a
new one (descriptions → #993; data-streams → #1010; MCP → #1074). Drafts cost the owner
nothing; flipping to READY costs a slot.

## Gate artifact — offer variants

The owner picks the information architecture (Jordan, 2026-07-30). For a ported tree the
honest proposal is **two variants**, because "keep the tree, extract cookbooks" and "rebuild
flat" are both defensible and cost very different amounts of review. Apps shipped exactly this
way: variant A was #996, variant B was #1013, and B superseded A.

Use the Apps PR body as the template: `### Structure (clean Diátaxis, sequential)` — one
bullet per page with its type and what it carries — then the grouped nav, the `Next →` chain,
`### Content & accuracy`, `### Verification`, and `**Draft — do not merge.** Review chain: X → Y`.

One sheet outstanding at a time. Silence is not approval.
