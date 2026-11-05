---
name: docs-link-redirect-check
description: "Use after rewriting, merging, moving or deleting help.keboola.com pages and before review: checks that retired URLs redirect to real pages without chains, changed pages have no broken links, anchors or media, and nothing still points at a retired slug. Triggers: \"проверь ссылки/редиректы\", \"битые ссылки\", \"link check\"."
---

# Link & redirect check after a rewrite


## Working Directory Context

Run `scripts/check.mjs` from the root of a connection-docs worktree after `npm run build`: it reads `dist/`, `src/content/docs`, `_data/navigation.yml` and git history of that checkout (`git rev-parse --is-inside-work-tree` must hold).

## Why this exists

`scripts/audit-phase2.mjs` checks that a link's *path* resolves in `dist/` and that images exist.
It does not know that a page was **deleted or renamed**, it skips `#fragments` (PR #1073 adds that),
it ignores `<video>`/`poster` media, and it never looks at `redirect_from`. Three of the failures
that reached PRs in 2026 were exactly those: a retired slug with no redirect, a redirect pointing at
another redirect, and nav entries left pointing at a removed page. This skill runs one script that
covers all of it for the pages you changed, then tells you what to fix.

## When to use

- You merged, split, renamed or deleted a page (`redirect_from` involved, or should be).
- You rewrote a page and its headings changed (inbound `#anchors` may be dead).
- You added or replaced media (`![…](/…png)`, `<video>`, `poster=`).
- Before `git push` on any docs PR, and again after the Vercel preview deploys.

## Procedure

1. **Build first.** `npm run build` in the repo checkout you are checking (a worktree is fine).
   Redirect stubs are generated at build time by `src/integrations/redirect-from.mjs`, so
   nothing can be checked without `dist/`.

2. **Run the check** from the repo root:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/docs-link-redirect-check/scripts/check.mjs" --base keboola/main
   ```
   Flags:
   - `--base <ref>` — what to diff against to find changed/deleted/renamed pages (default
     `origin/main`, falls back to `main`; in a worktree where `main` is stale, pass the merge-base
     or the PR's base branch).
   - `--paths <glob-prefix>` — also treat every page under this prefix as changed (e.g.
     `src/content/docs/getting-started`), for a section-wide pass.
   - `--site` — run the anchor and media checks over the whole `dist/`, not only changed pages.
   - `--preview <url>` — after the Vercel preview is up: fetch each retired URL and each changed
     page there and confirm the same redirects and pages are served.
   - `--no-build-check` — skip the "is dist fresh?" guard (it compares `dist/` mtime to `src/`).

3. **Read the report** — sections in severity order, exit code 1 on any blocker:
   - `RETIRED URL WITHOUT REDIRECT` — a page deleted or renamed since `--base` whose old slug
     no surviving page lists in `redirect_from`. **Blocker.** Add the old URL to the surviving
     page's `redirect_from` (list form), rebuild, re-run.
   - `REDIRECT STUB MISSING OR WRONG` — `redirect_from` is declared but `dist/<old>/index.html`
     is absent, does not `meta http-equiv="refresh"`, points at a URL that is itself a stub
     (chain), or points at a URL that does not exist. **Blocker.**
   - `INBOUND LINKS TO A RETIRED SLUG` — occurrences in `src/**`, `_data/navigation.yml`, and
     the generated `src/sidebar.mjs` (excluding `redirect_from` lines). Fix every one: a redirect
     is a safety net, not a link target.
   - `NAV ENTRY WITHOUT A REAL PAGE` — a `url:` in `_data/navigation.yml` that resolves to a
     stub or to nothing. **Blocker** (Starlight would 404 or bounce the sidebar).
   - `BROKEN LINK / ANCHOR ON A CHANGED PAGE` — internal `href` whose path is missing, or whose
     `#fragment` has no matching `id` on the target (same-page fragments included). Cross-check
     against `scripts/audit-phase2.mjs`, which stays the site-wide authority for paths.
   - `MEDIA MISSING` — `img src`, `video > source src`, `poster` on changed pages with no file in
     `dist/`.
   - `SIDEBAR OUT OF DATE` — `src/sidebar.mjs` differs from what `scripts/convert-nav.mjs`
     would generate from `_data/navigation.yml`. Run `npm run gen:sidebar` and commit it.

4. **Then the existing audit**, for the site-wide view the script does not repeat:
   ```bash
   node scripts/audit-phase2.mjs
   ```
   Expect `MISSING IMAGES: 0` and no *new* `BROKEN INTERNAL LINKS`; the two
   `absolute-old-docs-link` rows under `/getting-started/` are known and deliberate.

5. **After the preview deploys**, run step 2 again with `--preview <vercel-url>`. A stub that
   is right in `dist/` but 404s on the preview means the file was not committed.

6. **Record it.** A moved or merged page is a structural change: the old→new mapping goes into
   the PR body ("old URL → new URL"), and CLAUDE.md's conservation rules apply
   (the section's CONSERVATION-REPORT and MISSING under `notes/<section>/` for anything dropped).

## What the script deliberately does not do

- It never edits anything. Fixes are yours: `redirect_from`, links, nav, `gen:sidebar`.
- It does not follow external links (audit-phase2 counts them; `check-redirects.mjs` on the
  PRDCT-572 branch owns the developers.keboola.com → help contract — a different job).
- It does not judge information architecture. If a page has no natural redirect target, that is
  a placement decision for a human (see the `migration-placement` skill), not a missing stub.

## Gotchas that bit us

- `redirect_from` accepts a string or a list; the list form is the one to use. A URL there
  must be the old **path with trailing slash** (`/getting-started/project/`), not a slug.
- A redirect to a page that itself has `redirect_from` is fine; a redirect **to** a retired URL
  is a chain — the browser follows it, search engines and `curl -I` do not. The script flags it.
- Deleting a directory of media (`git rm public/section/*.png`) can delete the directory; a later
  `cp` into it fails silently in a `set -e` script. Recreate the directory first.
- Anchors in Starlight are the heading's slugified text; renaming a heading kills every inbound
  `#fragment`. Grep for the old anchor before renaming (`section-rework` step 2b).
- In a worktree, `main` can be months stale. Use `--base origin/main` or the PR's base.
