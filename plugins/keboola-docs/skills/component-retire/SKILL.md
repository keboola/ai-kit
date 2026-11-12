---
name: component-retire
description: "Use when a Keboola component is being deprecated, replaced by a newer version or removed from the catalog, and its copy, documentation link, images and help page must say so: puts the deprecation line first in the long and configuration descriptions, points to the successor, drops copy and images that will rot, hands the help page to docs-retire. One owner-gated PR. The owner decides the deprecation; this skill never sets the Developer Portal flag."
---

# Component retire: say it is going, and where to go instead

A user deep-linked to a deprecated component, or opening an old configuration of it, must see
that first and see what to use instead. The deprecation itself (the `deprecated` flag, hiding
the component) is set in the Developer Portal by the owner; this skill only makes the copy and
the documentation agree with that decision.

`$CC` below is `${CLAUDE_PLUGIN_ROOT}/skills/component-copy`; its Facts and Guardrails apply.

## Working Directory Context

Run the scripts from the directory you work in (a scratch folder, or the component repo's root
when step 5 applies a change), never from the skill directory: they find their own references
through their location, `$SKILL_DIR` = `${CLAUDE_PLUGIN_ROOT}/skills/component-copy`. Proposals go to
`$COMPONENT_COPY_PROPOSALS` (default `./proposals/` under the current directory). The scripts that
read a component repo do it through `gh`, so no local checkout is needed until the apply step,
which runs inside a fresh clone (`git rev-parse --is-inside-work-tree` before committing).

## Before anything: the owner's decision

Ask, and do not guess: is the component deprecated, what replaces it (a component id, or no
replacement), and from when. Without those three answers there is nothing to write. Record
them in the PR body.

## Procedure

### 1. Facts

```bash
node $CC/scripts/component-facts.mjs <component.id> --include-hidden
node $CC/scripts/component-facts.mjs <successor.id>            # when there is one
```

`--include-hidden` is needed because a deprecated component is no longer public. The facts give
the repo and publish path; a `hard` gate (no repo, portal-only copy) means the owner changes the
copy in the portal and you hand him the text.

### 2. Draft into a proposal directory

- `component_long_description.md` opens with one line, then keeps what is still true:
  `Deprecated: use [<Successor name>](<successor documentation URL>) instead.` or
  `Deprecated: no replacement.` Add the date when the owner gave one.
- `configuration_description.md`, when it has text, opens with the same line, because existing
  configurations still open this form. When it is empty, leave it empty.
- `component_short_description.md` stays as it is; the catalog marks deprecated components
  itself.
- `documentationUrl.md` keeps pointing at the component's own docs while they exist.
- Images: remove any from the copy; nobody will move media for a component that is going away.
- The prerequisites block and the load-behaviour line are not required for a retired component
  (`--retired` turns those rules off), so no new `VERIFY` questions are raised for it.

### 3. Lint

```bash
node $CC/scripts/lint-copy.mjs <proposal-dir> --name "<name>" --retired
```

Exit 0 required: the deprecation line must open both descriptions.

### 4. The help page

If help.keboola.com has a page for the component, hand it to `docs-retire` with the successor's
page as the redirect target (or the category page when there is no successor). Never leave a
page that still teaches the deprecated component as current.

### 5. Gate, apply, record

Stop and show the diff. After an explicit yes: component-copy steps 5 and 6, branch
`PRDCT-586-retire-<component-id>`, a ledger row with the successor. Done means the live copy
shows the deprecation line.

## Common mistakes

- Deprecating on your own reading of the repo (archived, no commits). Only the owner decides.
- Deleting the long description. Users with existing configurations still need what it says;
  the deprecation line goes on top.
- Pointing at a successor that is itself hidden or deprecated. Run the facts on the successor.
- Forgetting the help page: a live page for a dead component is the worst outcome of this task.
