---
name: docs-before-after
description: "Use when the author wants to see what a docs branch or PR changes on the rendered pages without opening them by hand: screenshots of every changed spot, live site vs local build, with word diffs, published as one Artifact page. Also the last check of docs-update and docs-page before the handoff. Triggers: \"покажи до и после\", \"скрины до/после\", \"что поменялось на странице\", \"before/after\", \"visual diff\"."
---

# Before/after report for changed pages


## Working Directory Context

Run `scripts/before-after.mjs` from the root of a connection-docs worktree on the branch under review. It needs `playwright` and `diff` from that worktree's `node_modules` (a `--link-deps` worktree has them) and a `dist/` built from the current files.

## What it does

For every page under `src/content/docs` changed since `--base`:

1. Opens the page on the live site (before, default `https://help.keboola.com`) and in the local `dist/` (after, served on a random localhost port).
2. Splits both into blocks: the H1, then each child of `.sl-markdown-content`, with list items one by one and tables whole.
3. Matches the blocks by text. A change whose words differ only in case or punctuation (sentence-case headings, dashes, quotes) is listed as a text diff without screenshots. Every other change gets a before and an after screenshot, with one block of context above, and a word diff.
4. Writes one self-contained HTML file (JPEG data URIs, light and dark themes) and prints its path last.

New pages get a whole-page "after" shot, retired pages a whole-page "before" shot, both cut at 1800 px.

## Run it

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/before-after.mjs" --build \
  --title "<short name, e.g. Onboarding cleanup review>" \
  --preview <vercel preview origin, optional> \
  --out "<session scratchpad>/before-after-<branch>"
```

- `--base` defaults to `keboola/main`. On a stacked branch keep it: the live site is main, so the report shows everything the reader will see change.
- `--build` runs `npm run build` when `dist/` is missing or older than the changed pages; without it the script stops and says so. Never run two builds that share `node_modules` at once (`pgrep -fl 'astro build'`).
- `--pages a.md,b.md` limits the report; `--before <origin>` compares against another deployment; `--scale` (1.5) and `--quality` (72) trade sharpness for size.
- About 6 s per page. Six pages with 22 visible changes came to 2.2 MB.

Then publish the printed file with the Artifact tool (icon `compare` on the first publish). For the same branch later in the session, publish the same path again so the link stays. Give the author the link, and say how many visible and cosmetic changes there are.

## Automatic on every PR (hook)

`scripts/pr-before-after.mjs` runs after every Bash call (PostToolUse). After `gh pr create`, or `git push` on a branch that has an open keboola/connection-docs PR with changed pages, it builds when needed, writes `<worktree>/.before-after/before-after.html` (kept out of git through `info/exclude`) and hands Claude the path. Publish that file with the Artifact tool straight away and give the author the link and the counts.

- It stays quiet on other commands, on main, without an open PR, without changed pages, when the report already covers this HEAD, and when nothing renders differently.
- It says why it skipped when another `astro build` is running (shared `node_modules`) or the run failed; then run this skill by hand.
- `DOCS_BEFORE_AFTER=skip git push` (or the env var) turns it off for one command.
- A `git push` waits for the report: a few seconds with a fresh `dist/`, about 40 s when it has to build.

## Reading it

- A card titled "Under …" names the section heading above the change. "Top of page" means the H1 or the lede.
- A side marked "nothing here; neighbours shown" is a pure insert or delete: the screenshot shows the blocks around the spot.
- The live site is main as deployed. A change already merged but not yet deployed shows up as a difference. Different line wrapping in the two shots is the column width of the two builds, not a content change.
- The report is private to the author. Don't paste its link into a PR for reviewers; they use the Vercel preview.

## Common mistakes

| Mistake | Fix |
|---|---|
| Report built from a stale `dist/` | The script refuses; pass `--build` |
| `--out` outside the scratchpad or working directory | The Artifact tool can only publish from those two |
| Reading "cosmetic" as "unimportant" | It only means the letters match ignoring case and punctuation; a dash rule is still a change worth a glance |
| Publishing a new path for every rerun | Reuse the path, keep one link per branch |
