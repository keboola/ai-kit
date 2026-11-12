---
name: component-copy
description: Use when a Keboola component's user-facing copy needs to match the house shape — an empty or component-describing short/long description, a missing configuration description, cluttered schema field titles or tooltips — or when a new component is being published and its `component_config` must be right from the start. Edits `component_config/` in the component repo (which the developer portal reads), never a help-docs page. One component, one PR, owner-gated. Stale or out-of-rule copy that exists is component-update; a deprecated or replaced component is component-retire.
---

# Component Copy — one component, one PR

## Working Directory Context

Run the scripts from the directory you work in (a scratch folder, or the component repo's root
when step 5 applies a change), never from the skill directory: they find their own references
through their location, `$SKILL_DIR` = `${CLAUDE_PLUGIN_ROOT}/skills/component-copy`. Proposals go to
`$COMPONENT_COPY_PROPOSALS` (default `./proposals/` under the current directory). The scripts that
read a component repo do it through `gh`, so no local checkout is needed until the apply step,
which runs inside a fresh clone (`git rev-parse --is-inside-work-tree` before committing).

## Overview

A component is "done" when a user scanning the catalog can tell **what service it talks to**
from the short description, tell **what they will get and what they must provide** from the long
description, and never meet configuration instructions before they start configuring.

The two failure modes this skill exists to kill, both of which the platform's own published
rules already forbid:

- **Copy that describes the component instead of the service.**
  WRONG: *"This extractor extracts data from Cloudera Impala"* · OK: *"Native analytic database
  for Apache Hadoop"*. Most of the fleet's short descriptions have this shape (read them in
  `references/inventory.json`, field `short`).
- **The empty field.** Of 398 public components, **175 have no `configurationDescription`**
  and **25 have no `longDescription`** — the user is configuring against silence.

**Always present, whatever the sources say** (house rules agreed 2026-11-12, enforced by
`lint-copy.mjs`): a connector's `### Before you start` block (Account and plan, Access,
Permissions, Network, Set up first) and its load behaviour in the long description (unknown →
`VERIFY(owner)`), a configuration description of at least where access comes from and what the
first run produces, and images only from `https://help.keboola.com/`. The templates hold the
detail.

**Behaviour:** gather facts with scripts → draft into a proposal directory → lint →
**stop for the operator's approval of the diff** → only then branch, commit, open a draft PR.
Nothing is pushed anywhere on the skill's own judgement. Matyáš Jirát owns the copy shape
(PRDCT-587) and the review path is manual first, bot later (PRDCT-590): **classification and
drafting are evidence, the call is the owner's.**

**The one fact everybody gets wrong:** a merge and a published change are different events.
The repo's workflow pushes `component_config` to the Developer Portal, and the portal syncs to
every stack within about five minutes. When that workflow runs differs per repo:
`component-facts.mjs` reads it as `publish.trigger`. On `tag` (the standard template and
`keboola/component-ci`) nothing changes until someone cuts a semver release; on `every-push` or
`push-default` the merge is live in minutes. Never report a component as fixed on the strength
of a merge, and never assume which kind of repo it is.

## When to use

- A component has an empty `longDescription` or `configurationDescription` (the gap-fill pass).
- A component's copy describes the component, or buries detail that belongs in a tooltip.
- A new component is being published and `component_config` should be right from the start —
  this is the long-term reason the skill exists (PRDCT-586).

**Not for:**
- Help-docs pages under `src/content/docs/` → `section-rework` (page shape) or
  `migration-placement` (where a page lives).
- Dead `documentationUrl` values → PRDCT-648. Re-pointing help→README links → PRDCT-650.
  Same files, different task; don't mix them into a copy PR.
- Components whose fields are hard-coded in the Keboola UI monorepo (non-generic UI) — those
  need a monorepo PR, and `component-facts.mjs` blocks on them.
- Restyling copy that is already correct. Phase 2, after a gap-fill PR has been merged **and
  published**.

## Facts (do not recall these from memory)

| Portal property | File in the component repo |
|---|---|
| shortDescription | `component_config/component_short_description.md` |
| longDescription | `component_config/component_long_description.md` |
| configurationDescription | `component_config/configuration_description.md` |
| configurationSchema | `component_config/configSchema.json` |
| configurationRowSchema | `component_config/configRowSchema.json` |
| documentationUrl | `component_config/documentationUrl.md` |

- The mapping is applied by `scripts/developer_portal/update_properties.sh` in the component
  repo, called from the `update_developer_portal_properties` job in `.github/workflows/push.yml`.
- **Publish trigger:** in the standard template the job is guarded by `is_deploy_ready` =
  semver tag on the default branch; repos on `keboola/component-ci` behave the same. Some repos
  differ, so read `publish.trigger` from `component-facts.mjs`, never this line.
- **Portal → product:** any change that reaches the Developer Portal shows on all stacks within
  about five minutes. An invalid schema reaches customers just as fast.
- Tooltips are not files: they live inside the schemas as `options.tooltip` (Markdown),
  `options.documentation` `{link, tooltip}`, `options.enum_titles`.
- The rules are published docs, not opinions — cite them in the PR:
  `extend/publish/index.md`, `extend/publish/checklist/index.md`,
  `extend/component/ui-options/configuration-schema/index.md`.
- Component repos live in the **`keboola`** org (kds-team ones included) and a few in
  **`keboola-rnd`**; `component-facts.mjs` searches both. A component whose id appears in no
  workflow has no findable repo: its copy is portal-only, and the gate stops hard.
- **Public only** (owner's rule): not expired, not `excludeFromNewList`, not `deprecated`, as
  `scripts/lib/visible.mjs` defines it. That is a proxy read off the Storage index; when in
  doubt, check the component in the Developer Portal's public listing.
- Branch name: `PRDCT-586-copy-<component-id>`. Proposals: `$COMPONENT_COPY_PROPOSALS/<id>/`
  (default `./proposals/<id>/`).
- `$SKILL_DIR` is `${CLAUDE_PLUGIN_ROOT}/skills/component-copy`.
- **The installed plugin is read-only.** Anything that changes `references/` (a map refresh
  with `--write`, an owner confirmation in `overrides.json`, a ledger row) goes into a checkout
  of the plugin repo: set `COMPONENT_COPY_REFS=<checkout>/plugins/keboola-docs/skills/component-copy/references`
  for the scripts, commit there, and ship it as a plugin release. That keeps one copy of the map
  and the sign-offs, reviewed like code.
- `$SKILL_DIR/references/`: `inventory.json` (the fleet), `category-map.json` (buckets, carries
  the whole-map `reviewed` flag), `overrides.json` (classification exceptions with reasons, and
  per-component owner confirmations under `confirmed`),
  `templates/{source,destination}.md` (and the `application.md` stub), `run-ledger.md`.
- **What good field copy looks like:** the "configSchema / configRowSchema" section of each
  template, with `keboola.ex-medallia`'s schemas as the worked example: a one-line
  `description`, the how and why in `options.tooltip`, a documentation link wherever a field
  takes a grammar defined elsewhere.

## Procedure

### 1. Facts first, deterministically

```bash
node $SKILL_DIR/scripts/fetch-inventory.mjs                 # fleet drift: informational here; --write to accept
node $SKILL_DIR/scripts/component-facts.mjs <component.id>  # one JSON blob
```

`component-facts.mjs` resolves the repo authoritatively (the component id appears in the
workflow's `KBC_DEVELOPERPORTAL_APP`), reads the live copy, finds the bucket, and reports the
publish path. **Exit 1 means gated; read `gate.level`:**

- `hard`: nothing a `component_config` PR can fix (no repo, portal-only copy, custom UI), or
  several repos declare the id and the right one must be picked by hand. Stop; no draft.
- `soft`: the owner has not signed off. Draft the proposal (steps 2 and 3) so he has something
  to review, but stop at step 4; no branch, no PR.

A soft gate lifts for the whole fleet when `category-map.json` has `reviewed: true`, or for one
component when the owner confirms it under `confirmed` in `references/overrides.json`, with the
bucket he confirmed. That per-component path is how the first PRs go through his manual review
one at a time. Both approvals lapse on their own when a refresh moves the component (or any
component, for the whole map) to another bucket.

Exit 2 with "not public" means the component is expired, hidden or deprecated: out of scope, no
proposal, no ledger row.

### 2. Draft into a proposal directory — never into the repo yet

Write files named exactly like their `component_config/` targets into
`$COMPONENT_COPY_PROPOSALS/<id>/`. Fill the bucket's template from
`$SKILL_DIR/references/templates/`.

**Sources allowed:** the current portal copy, the repo README, the config schema, the service's
own linked documentation. Nothing else. You are reshaping facts that exist, not writing
marketing. Anything you cannot source gets `VERIFY(owner)` inline — a guess that reads well is
the worst possible output here, because nobody downstream can tell it from a fact.

**In the first cut, touch only the three markdown files.** Schema field copy (titles,
tooltips, enum titles) is a separate PR through `component-update` step 3 and
`scripts/schema-copy.mjs`.

### 3. Lint

```bash
node $SKILL_DIR/scripts/lint-copy.mjs <proposal-dir> --name "<component name from the facts>" --bucket <bucket from the facts>
```

Must exit 0. Each finding cites the published rule it came from; fix the copy, not the linter.
A schema file in a proposal is an error unless `--schemas` is passed, and that is only for a
reviewed schema change (phase 4), which also needs `scripts/schema-diff.mjs` (Guardrails).

Self-check after editing the linter: `lint-copy.mjs $SKILL_DIR/fixtures/clean --schemas` gives
0 errors, `lint-copy.mjs $SKILL_DIR/fixtures/broken --schemas` gives 9 errors and 4 warnings.
`schema-diff.mjs` on `fixtures/schema-diff/before.json` passes against `after-copy.json` and
blocks `after-functional.json` (2 paths).

### 4. GATE — stop and show the diff

Show, per file: what the portal has now, what you propose, and why (which template line, which
rule). Then **stop**. Do not open a PR, do not create a branch, do not "prepare" the push.
The operator (the person running the skill) approves each component's diff; Matyáš reviews
the PR manually until PRDCT-590's bot exists.

### 5. Apply, only after an explicit yes

```bash
gh repo clone <repo> /tmp/cc-<id> -- --depth 1
cd /tmp/cc-<id> && git checkout -b PRDCT-586-copy-<id>
# copy ONLY the approved markdown files; schemas never ride along in the first cut
for f in component_short_description.md component_long_description.md configuration_description.md; do
  [ -f "<proposal-dir>/$f" ] && cp "<proposal-dir>/$f" component_config/
done
node $SKILL_DIR/scripts/lint-copy.mjs component_config --full --bucket <bucket>   # --full: real dir, not a proposal
git add component_config/*.md && git diff --cached --stat        # nothing but .md files
git commit -m "PRDCT-586: <what changed> for <component id>"
gh pr create --draft --title "PRDCT-586: component copy for <component id>" --body "<see below>"
```

PR body must carry the propagation caveat for the repo's `publish.trigger`:

- `tag`:
  > Copy-only change to `component_config`. It publishes to the Developer Portal on the next
  > semver tag on the default branch, so merging alone changes nothing user-visible. Safe to
  > include in the next routine release; no code paths touched.
- `every-push` / `push-default`:
  > Copy-only change to `component_config`. This repo publishes to the Developer Portal on
  > merge, and the portal syncs to every stack within about five minutes, so the text is live
  > shortly after merging. No code paths touched.
- `unknown`: say that the publish path could not be read from the workflows, quote
  `publish.triggerVia`, and ask the reviewer when it goes live.

plus which template and bucket were applied, the rules cited, and that it was generated by this
skill.

### 6. Record, and close the loop later

Print one `RESULT:` line. Append a row to `run-ledger.md` in the plugin repo checkout (see
Facts, `COMPONENT_COPY_REFS`):
component, PR, date, `merged: no`, `published: no`. The component stays open in the ledger
until `component-facts.mjs` shows the live portal copy matching the proposal. That re-check —
not the merge — is what "done" means.

### New component (not published yet)

```bash
node $SKILL_DIR/scripts/component-facts.mjs --local <path>/component_config --bucket <bucket>
node $SKILL_DIR/scripts/lint-copy.mjs <path>/component_config --full --schemas --name "<name>" --bucket <bucket>
```

No live copy, no repo search, no gate and no ledger row: fill the bucket's template, lint to
exit 0, and ship the copy with the component. This is the mode the engineering toolkit uses.

## Images, GIFs and video in component copy

Long and configuration descriptions are Markdown and may embed media. Take screenshots with
`capturing-keboola-ui-screenshots` and make GIFs or video with `docs-clip`; do not invent a
second capture pipeline here.

- Never hotlink: raw URLs from private repos answer 404 to customers, and Bitbucket or image
  hosts like i.ibb.co break without notice. On 2026-11-12, 11 public components embedded
  images and 6 of them were broken: a vendor logo answering 404 (four revolt-bi components)
  and README-relative paths that mean nothing outside the repo (`kds-team.wr-lytics-v2`,
  `keboola.processor-duckdb`).
- Images are hosted on `https://help.keboola.com/` only (house rule, 2026-11-12): the file goes
  into keboola/connection-docs `public/`, the copy uses its absolute URL, and `lint-copy.mjs`
  fails anything else. A broken image is re-hosted there or dropped; the PR says which.
- Whether the Keboola UI renders images in these fields at all is not confirmed yet:
  `VERIFY(Matyáš Jirát)`. Until it is, a proposal adds no new image.

## Fleet audit

```bash
node $SKILL_DIR/scripts/audit.mjs --out audit.md     # every public component against the house rules
```

Read-only. Counts per rule and per bucket, then the components to fix first (an empty field,
then images, then Before you start, then load behaviour). Run it before choosing a batch and
after a batch is published; a component it lists goes through this skill when its fields are
empty and through `component-update` when they exist.

## In component CI

`scripts/lint-copy.mjs` is one dependency-free file so a component repo's CI can run the same
rules on every PR. The step and the rollout (report first, enforce for new components later)
are in `references/component-ci.md`. Adding it to `keboola/component-ci` is the Component
Factory owner's call.

## Guardrails

- **Dry-run by default.** Every script writes nothing without an explicit `--write`/`--apply`.
- **Whitelisted leaves only, when schemas are in scope:** `title`, `description`,
  `options.tooltip`, `options.documentation`, `options.enum_titles`. Never `enum` values,
  `required` membership, `default`, `type`, or renumbering `propertyOrder` beyond adding a
  missing one. Edit surgically; do not load-modify-dump a schema, and prove no other leaf moved
  with `node $SKILL_DIR/scripts/schema-diff.mjs <before.json> <after.json>` (exit 0 = copy-only).
  `lint-copy.mjs --schemas` must also pass: valid JSON, every property has a `type`, every
  `required` name exists. For a schema PR, step 5's lint is `--full --schemas`; without
  `--schemas`, `--full` reports schema problems as warnings, which is right only for a
  markdown-only PR. These files drive the live configuration UI and reach every stack in
  about five minutes: this is the one failure mode that breaks the product rather than the
  prose.
- **Never delete meaning.** Deprecation notices, rate limits, licensing sentences, "beta"
  wording and links are preserved or moved, never dropped. Proposed deletions go to the
  proposal file for a human.
- **Idempotent.** A second run on an already-conformant component produces an empty diff.
- **One open PR per repo. At most five open at a time**, and the next batch waits until the
  previous one is merged *and visible in `/v2/storage`*. Skip repos with red CI on the default
  branch — they will not get a tag.
- Never tag a release, never write to the developer portal API, never push to a default branch.

## Common mistakes

- **Reporting a component fixed because the PR merged.** Depending on `publish.trigger` it
  publishes on a tag or on merge. Either way, check `/v2/storage`, not GitHub.
- Drafting copy from memory of the component instead of from the template plus the repo's own
  README and schema.
- Inventing a plausible capability sentence. If the README does not say it, it goes in as
  `VERIFY(owner)` or not at all.
- "Cleaning up" a schema and moving a functional key — `enum`, `required`, `default`, `type`.
- Opening a PR while the gate is soft, i.e. before Matyáš has confirmed the bucket set or this
  one component. One shape cannot fit the fleet, so the owner signs off before anything ships.
- Treating a repo with `component_config/` but no `update_developer_portal_properties` job as
  publishable. Say in the PR that the path is unverified.
- Picking a component whose copy is merely *ugly* rather than *missing*, during the gap-fill
  phase. Restyle invites a taste argument with the component's owner; filling an empty field
  does not.

## Related

- `component-update` — copy that exists but is stale or out of rule; schema field copy.
- `component-retire` — a deprecated or replaced component.
- `section-rework` — the shape standard this skill is modelled on, and where docs pages go.
- PRDCT-587 category map (blocks the apply step) · PRDCT-590 review path ·
  PRDCT-588 inventory · PRDCT-648 dead documentation links · PRDCT-650 link re-pointing.
- `references/benchmark.md`: Fivetran's connector pages as the outside check on this design,
  useful when the owner asks why one skeleton with per-category depth.
