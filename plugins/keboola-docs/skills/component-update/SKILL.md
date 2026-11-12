---
name: component-update
description: "Use when a published Keboola component's copy has gone stale or out of rule and must be brought up to date: the README or schema gained endpoints or modes the description does not mention, the owner answered a VERIFY, an image sits in the copy, the README lacks its Prerequisites section or the copy a load-behaviour line, field tooltips need fixing, or the fleet audit put it on the list. Finds the drift with scripts, proposes only the changed lines, one owner-gated PR. Writing missing copy from scratch is component-copy; deprecating a component is component-retire."
---

# Component update: bring live copy back in line

`component-copy` writes copy where there is none. This skill changes copy that exists, so it
works from a diff: what is live, what the sources say now, what the house rules require. It
reuses component-copy's scripts, templates and gate; read that skill's **Facts** and
**Guardrails** once, they apply here unchanged.

`$CC` below is `${CLAUDE_PLUGIN_ROOT}/skills/component-copy`.

## Working Directory Context

Run the scripts from the directory you work in (a scratch folder, or the component repo's root
when step 5 applies a change), never from the skill directory: they find their own references
through their location, `$SKILL_DIR` = `${CLAUDE_PLUGIN_ROOT}/skills/component-copy`. Proposals go to
`$COMPONENT_COPY_PROPOSALS` (default `./proposals/` under the current directory). The scripts that
read a component repo do it through `gh`, so no local checkout is needed until the apply step,
which runs inside a fresh clone (`git rev-parse --is-inside-work-tree` before committing).

## When to use

- The fleet audit (`node $CC/scripts/audit.mjs`) lists the component.
- The component's README or schema changed: new endpoints, objects, modes or limits.
- The owner answered a `VERIFY(...)` that is in the live copy.
- The copy the UI shows has an image (pictures belong in the README), or the README has no
  `## Prerequisites` section in the house shape.
- Schema field copy (titles, descriptions, tooltips, enum titles) needs fixing.

**Not for:** empty fields on a component nobody has touched yet (`component-copy`), a component
being deprecated or replaced (`component-retire`), help.keboola.com pages (`docs-update`).

## Procedure

### 1. Facts and drift

```bash
node $CC/scripts/component-facts.mjs <component.id>        # repo, bucket, publish path, gate
node $CC/scripts/drift.mjs <component.id> --repo <repo from the facts>
```

`drift.mjs` prints `lint` (house-rule findings on the live copy and the README), `verify` (open owner
questions), `readmeItems` (things the README lists under an endpoints or objects heading that
the long description never names) and `prerequisites` (the README's own section, the starting point for
its house-shaped `## Prerequisites`). Exit 0 means nothing to do: say so and stop.

The gate from `component-facts.mjs` holds exactly as in component-copy: `hard` stops, `soft`
drafts a proposal only.

### 2. Propose only what changed

Copy the live text into `$COMPONENT_COPY_PROPOSALS/<id>/` (files named like their
`component_config/` targets) and edit it there:

- Add what the sources now say; keep every sentence that is still true. Deprecation notices,
  limits, licensing lines and links are never dropped (component-copy Guardrails).
- `readmeItems` is a hint, not an instruction: name the items in "what you get" when they are
  data the user receives; ignore option values that slipped through.
- An owner's answer replaces its `VERIFY(...)` with the answer, in the answer's own terms.
- An image in the copy goes: into the README when the README lacks it, otherwise just removed.
  Say which in the PR.
- The README's prerequisites section is replaced in place by the five-item `## Prerequisites`
  (template `README.md: Prerequisites`), keeping the detail it had; the rest of the README is
  not touched. Lint with `--readme <proposed README>`.

### 3. Schema field copy (separate PR)

Field titles, descriptions, tooltips and enum titles go in their own PR, never mixed with the
markdown files. Write the edits as JSON and apply them with the guard:

```bash
node $CC/scripts/schema-copy.mjs <repo>/component_config/configRowSchema.json edits.json          # dry run
node $CC/scripts/schema-copy.mjs <repo>/component_config/configRowSchema.json edits.json --write  # after the yes
```

It sets only `title`, `description`, `options.tooltip`, `options.documentation`,
`options.enum_titles`, refuses anything else, refuses a file whose formatting it cannot keep,
and runs `schema-diff.mjs` before writing. The field rules are in the templates
(`configSchema.json / configRowSchema.json`); the worked example is `keboola.ex-medallia`.
Lint with `--full --schemas`.

### 4. Lint, gate, apply, record

Lint the proposal (`lint-copy.mjs <dir> --name "<name>" --bucket <bucket>`, exit 0), then stop
and show a before/after per file. After an explicit yes, follow component-copy steps 5 and 6:
branch `PRDCT-586-update-<component-id>`, draft PR with the publish caveat for the repo's
`publish.trigger`, a ledger row in the plugin repo checkout. Done means the live copy in
`/v2/storage` matches, not that the PR merged; re-run `drift.mjs` to confirm.

## Common mistakes

- Rewriting a whole description to fix one line. Propose the changed lines; a full restyle is a
  taste argument with the component's owner.
- Treating `readmeItems` as truth. It is a substring check; a README list can be configuration
  values, and the long description may name the item in other words.
- Mixing a schema change into a markdown PR. Schemas drive the live form; they get their own PR,
  their own review and `schema-diff.mjs`.
- Dropping a `VERIFY` because it looks answered somewhere. Only the owner's answer closes it.
