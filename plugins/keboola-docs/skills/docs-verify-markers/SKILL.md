---
name: docs-verify-markers
description: "Use when a keboola/connection-docs page states something not checked live, when a page or diff carries VERIFY(<owner>) or TODO markers, when deciding whether to delete such comments before a PR, or when internal notes reach readers (View as Markdown, llms.txt). Applying an owner's answer to the page is docs-update."
---

# VERIFY markers in the docs

## Overview

A `VERIFY(<owner>)` marker is a note to the docs team inside a page's source: "this is not checked yet, and <owner> checks it". Readers never see it. The team finds open checks with one grep, so markers stay in the source until someone settles them.

Two facts shape every rule below:
- **The repo is public.** Every comment is readable on GitHub by anyone.
- **The build strips comments** from the rendered HTML and from the `/<slug>/index.md` twins (`src/integrations/strip-comments.mjs`). A marker in the source is fine; a marker in `dist` is a bug.

## Writing a marker

Put the claim on the page only as far as you checked it. The marker carries the rest.

| Part | Form |
|---|---|
| Syntax | `{/* VERIFY(Name): … */}` in .mdx, `<!-- VERIFY(Name): … -->` in .md |
| Owner | A real person who can check it, never empty: `VERIFY(Nikita)`, `VERIFY(Michal Ševčík)` |
| Body | What is unchecked, what evidence exists, what would settle it |
| Placement | On the line after the sentence it is about |

```mdx
Storage Access must be on in the project; see [Storage access](#storage-access).
{/* VERIFY(Nikita): whether a new free project has Storage Access on. Every run so far was in project 264; if a fresh project has it off, list it in Before you start. */}
```

The visible sentence above states only what is known. It does not say "is on by default".

**What may go in a comment (public repo):** the internal test project and app IDs (264, App IDs), dates, kbagent or build versions, team members' names. **Never:** tokens, passwords, API keys, customer names, customer project IDs, private URLs, email addresses.

## Before a PR

Markers stay. Deleting them, or moving them into the PR description, loses the open check: after the merge nobody searches PR descriptions.

1. List the markers your diff adds or touches: `git diff upstream/main -- src/content/docs | grep -n "VERIFY("`.
2. For each one, either settle it now (step 3) or leave it as is, and list it in the PR body under "Open checks".
3. To settle a marker, do the check (a live run in project 264, the public UI bundle, kbagent `--help`, the Storage API), then replace the marker with a dated evidence note, or delete it if the page text is now plainly true:
   `{/* Checked 2026-10-07: … (what was run, result). */}`
4. Build, and confirm nothing leaks:
   `grep -rl "VERIFY(" dist --include=index.md --include=index.html` must print nothing.

## Finding open markers

`git grep -n "VERIFY(" upstream/main -- src/content/docs` lists every open check on main, and `git grep -n "VERIFY(Nikita)"` lists one owner's checks.

## Common mistakes

| Mistake | Fix |
|---|---|
| Unchecked claim written as fact, with a marker beside it | Write only what is checked; the marker holds the rest |
| `VERIFY:` with no owner | Name the person who can check it |
| Deleting markers before the PR because they "go into the code" | They are meant to be in the code; the build keeps them off the site |
| Moving the open check into the PR description only | Keep it in the source; mention it in the PR body as well |
| A token or a customer name in a comment | Remove it; rotate the token if it was ever committed |
| `VERIFY` shows in `dist/**/index.md` | strip-comments.mjs is missing or bypassed; fix the build, not the page |
