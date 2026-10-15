---
name: migration-placement
description: "Use when migrating a developers.keboola.com section into the help docs, or auditing a migration PR for placement: finds the home by meaning, removes duplicates, proposes regrouping, applies single-page fixes and leaves placement calls to the owner."
---

# Migration Placement — right home, no duplicates

## Overview

Migrating a dev page into help is **not** "move the file + fix the content." The failure
mode (Jordan, 2026-07-30) is placing content at the **first name-matching spot** and
**adding it alongside** an existing help page — creating duplicate/looping pages, which is
the exact thing the page-by-page migration was chosen to avoid.

Poster child: **Generic Extractor #1054** added a full "Generic Extractor Reference" tree
while the old thin `components/extractors/other/generic` stub (which just points users to
dev docs) was left in place → two "Generic Extractor" entries, one bouncing users off-site.

This skill encodes the manual method: figure out what the content *is*, find where that
concept *already lives* (expanding even the hidden "Other" nav groups), dedup, place it **by
meaning** — and, when the neighbourhood is scattered or a cross-cutting topic sits under the
wrong parent, **propose a regroup** — then hand the owner a short **situation report** naming
the real decision(s).

**Behaviour:** audit + **apply the unambiguous fixes** (delete redundant stubs, redirects,
retitle, repoint links, fix nav); **never pre-decide** a genuine placement question — pose it.
Works both on already-open migration PRs (retrofit) and on fresh migrations.

## When to use

- Placing a migrated dev→help section, OR
- Auditing an open migration PR (e.g. #1051–54, #1023) for duplication / wrong home.

Not for: fact-accuracy of the content (that's the `fact-checker` agent) — though see the
component-id guardrail below. Placement/dedup is a *different axis* and must be done too.

## Procedure

### 1. Identify what the content IS (concept, not title)
Read the migrated page(s). Classify — this decides the home and the search key:
- **Connector** — has a component id (`ex-generic-v2`, `kds-team.wr-generic`, `keboola.wr-*`).
- **Cross-cutting platform feature** — used across many surfaces (variables, data streams).
- **API reference** — endpoint/spec-style material.
- **Tutorial / how-to** — ordered learning steps.

The **component id / feature name is the search key** in step 2 — never the title word.

### 2. Find where that concept ALREADY lives (the dedup search)
```
git grep -il "<concept | component-id | friendly-name>" main -- src/content/docs/
git grep -in  "<friendly-name>"                          main -- _data/navigation.yml
```
- **Always expand every `**/other/` nav subgroup** (`components/extractors/other/…`,
  `components/writers/other/…`) — that's where thin stubs hide.
- For each existing page found, record: **slug**, **nav path**, and **stub-that-links-out
  vs full content** (open it; a stub is a short page whose main payload is a
  `developers.keboola.com` link).

### 3. Classify the relationship & pick the action
- **None found** → pure new placement (step 4).
- **Stub linking to dev docs** (migrated content supersedes it) → **REPLACE**: put the full
  content in / promote it, **delete the stub**, `redirect_from` the old slug, and **fold any
  unique bit** of the stub (a screenshot, a UI blurb) into the new page. Never leave both.
- **Full existing page overlapping** → **MERGE/dedup** into one page, redirect the loser.
  Never add-alongside.
- **Same concept in several homes, one outdated** (e.g. a "Flow usage" section duplicating
  Flows) → delete-or-link the stale copy, keep + verify the canonical one.

Duplication signals to catch: same/similar **title**; two pages describing the same
**component id**; a page↔page **link loop**; **near-sibling slugs** for the same thing.

### 4. Determine the correct home by MEANING (NOT nearest-name)
Place the topic by its **concept and its sibling neighbourhood**, not by the nearest
same-named page. Ask: *"What is this topic a kind of, and where do its true siblings live?"*
A same-named page is a dedup signal (step 3), not automatically the right home. Use the
taxonomy in the next section:
- **Connector** → `components/{extractors|writers|applications}/{category|other}/<friendly-kebab-name>/index.md`.
- **Cross-cutting feature** → likely a **tough decision** (which parent, or its own
  category). Do **not** self-place; recommend + **surface to the owner**.
- **API reference** → there is **no dedicated API section**; API refs are normally **linked
  out**. In-repo API-adjacent content sits under its product surface. **Flag** any migration
  that invents a new un-homed area (`/integrate/…`, `/overview/api/` don't exist here).
- **Tutorial/onboarding** → `tutorial/`.

### 4b. Regroup scan (place-by-meaning at the section level)
Correct placement sometimes means **reorganising the neighbourhood**, not just filing one
page. After picking a home, scan for two patterns and, when found, **propose** a regroup
(never self-apply — see step 5):
- **(a) Cross-cutting topic under one wrong parent** → candidate to *lift into its own group*
  (e.g. Variables & Shared Code sit under Transformations but are used by components/flows/
  workspace).
- **(b) Scattered-but-related topics with no common home** → candidate to *consolidate into one
  group* (e.g. API/developer-reference pages punting to developers.keboola.com across many
  sections → a real "API / Developer Reference" grouping; the migrated `…/api/` pages belong
  together).

**Signals:** duplicate nav titles (two nodes both "Components"); a topic buried far from its
true siblings (Generic Extractor under `extractors/other/`); the same concept documented across
≥2 top-level sections; a family of pages with no shared parent.

**Evidence discipline (rank candidates by this, not by hunch):**
- Rank by **who links to the page** — `git grep -n "<slug-or-URL>" -- src/content/docs/`,
  grouped by top-level folder. Broad inbound spread = genuinely cross-cutting.
- Also weigh **duplicate nav titles** and **buried depth**.
- **Do NOT rank by raw word frequency** — it lies. Known traps: `variables` matches `KBC_*`
  environment variables (not the config feature); `stream` matches the `dynamodb-streams`
  extractor (not Data Streams). **Confirm every candidate by reading, not counting.**
- If the evidence is weak, say so and **leave it in place** (e.g. Data Streams is
  self-contained under Storage — no regroup).

### 5. Apply the unambiguous fixes
- Delete redundant stub(s); add `redirect_from:` for **every** retired URL (never leave a
  dead link).
- Unify the title (drop odd suffixes like "Reference" when it becomes the canonical page).
- Repoint inbound links: `git grep -n "<old-slug>" -- src/content/docs/` → update to the new slug.
- Fix `_data/navigation.yml`: remove the duplicate entry, keep exactly **one** canonical
  entry at the right depth, then `npm run gen:sidebar` (**never** hand-edit `src/sidebar.mjs`).
- **Do NOT pre-decide** genuine placement questions — leave the current placement and pose
  the question in the report.
- **A regroup (step 4b) is owner-gated — never self-applied.** It is bigger than one page and
  spans sections, so it changes **no** nav until the owner decides. Put a **before/after nav
  subtree** in the situation report as a question for Jordan/Matias. (Single-page dedup/replace
  fixes above stay auto-applied.)

### 6. Situation report (the owner deliverable)
A few sentences, per unit (follows the `jordan-pr-handoff` format — not a bare PR link):
> **<Section> — PRDCT-### / #<PR>**
> - Existing help state (the stub / duplicate).
> - What the migration did wrong (the duplication / misplacement).
> - What was fixed in the branch (dedup applied).
> - **The ONE open decision** for the owner/SME (e.g. the home of a cross-cutting feature).
> - **Regroup?** — if step 4b found one: a compact **before/after nav tree** naming the
>   cross-cutting/scatter question (or an explicit "checked, no regroup needed"). Cross-cutting
>   regroups that span units attach to the most-relevant PR with a cross-reference.
> - PR + `/files` · Preview deep-link to the slug · repo path.

### 7. Verify
- `npm run build` clean (page count no longer inflated by the dup).
- `node scripts/audit-phase2.mjs` → 0 missing images, no new broken links, old-slug links repointed.
- `git grep -n "<deleted-slug>" -- src/content/docs/ _data/navigation.yml` → **zero** hits.
- Nav shows exactly **one** canonical entry for the concept.

## IA taxonomy (from `_data/navigation.yml` on `main`)

**Top-level homes:** Overview · Tutorial (`/tutorial/` = onboarding/learning) · Kai · Flows ·
Apps · Components · Catalog · Storage · Transformations · Workspace · Management · AI ·
External Integrations.

**Connectors** → `components/{extractors|writers|applications}/{category|other}/<friendly-kebab-name>/index.md`:
- Extractors = **"Data Source Connectors"**; writers = **"Data Destination Connectors"**;
  applications = **"Applications"**.
- Category subgroups: extractors — communication, database, erp, marketing-sales, social,
  storage, **other**; writers — bi-tools, database, storage, **other**; applications —
  triggers, custom-python, data-gateway, ai.
- Use a category subgroup if one fits; **`other/`** only if none does.
- **Keyed by friendly name in the slug**, not the component id. Nav `title` = human display name.

**Cross-cutting platform feature** (variables, data streams) → often independent of any single
parent → **tough decision**; recommend a home, surface to owner (e.g. Variables sit under
Transformations today but are used by components + flows too — Jordan questioned that home).

**API reference** → **no dedicated API section**; normally **linked out** to
api.keboola.com / developers-docs. In-repo API-adjacent content lives under its product
surface (`storage/…`, `transformations/variables/api/`). The only literal `reference/` folder
is `storage/data-streams/reference/`. `/integrate/…` and `/overview/api/` do **not** exist —
don't create them (they're the PRDCT-582 orphans). **Known regroup candidate:** these
scattered API-ref pages + the orphans have no shared home → an "API / Developer Reference"
grouping is a real owner-question (evidence: `/overview/api/` 12 refs across 7 sections,
`/integrate/jobs/` 7 refs across 4 — all external dev-docs links; verified `upstream/main`).

**Known structural fact — duplicate "Components":** two nav nodes are both titled "Components"
— `/components/` (the "use components" tree: extractors/writers/applications) and
`/extend/component/` (under the top-level "Extending Keboola" = the "build components" tree).
Generic Extractor, a build-your-own tool, is filed on the *use* side under
`components/extractors/other/generic/`. The use-vs-build split + duplicate title is a standing
regroup question — surface it, don't silently pick a side.

**Conventions:**
- Page = **folder + `index.md`**; co-locate images alongside.
- `slug` frontmatter = full path, **no** surrounding slashes; nav `url` = slug **with** slashes;
  file path under `src/content/docs/` == slug.
- Minimal frontmatter: `title` + `slug` (+ `description` for search/RAG).
- On any move/rename, add old URLs to `redirect_from:` (list or string). Integration:
  `src/integrations/redirect-from.mjs` writes a redirect stub at each old path (derives the
  target from `slug`); it **won't** overwrite a real page.
- `_data/navigation.yml` is the source of truth → `npm run gen:sidebar` regenerates
  `src/sidebar.mjs` (never hand-edit the generated file).
- Ignore untracked `src/content/docs/extend/**` and `dist/**` (build cruft, not in git on main).

## Guardrails (hard-won lessons)

- **Nearest-name dumping + add-alongside-a-stub is the failure mode.** Always search by
  concept/component-id and always expand the `other/` groups.
- **Don't invent new top-level areas** (`/integrate/`, `/overview/api/`) — known orphan problem.
- **Verify a component id against the live catalog before "fixing" it.** The `ex-generic-v2`
  scare: a guide-tester wanted `keboola.ex-generic-v2`; the live component index proved
  `ex-generic-v2` correct. Use Keboola MCP `find_component_id` / the component index, not memory.
- **SME (Matias/Miro) review only after** your own placement/dedup pass — never before.
- **One canonical page per concept.** If you can't merge cleanly, redirect — don't ship two.
- **Rank regroup candidates by link-references, not word counts.** Raw `git grep` word
  frequency produces false positives (`variables`→env-vars, `stream`→dynamodb-streams). Confirm
  by reading. Weak evidence → leave in place and say so.
- **A regroup is a proposal, not an edit.** It spans sections and is the owner's call — a
  before/after nav tree in the report, zero nav changes until they decide.

## Common mistakes

- Reporting a bare list of PR links instead of a per-section situation report (Jordan's ask).
- Retitling/moving without a `redirect_from` → dead old URLs.
- Editing `src/sidebar.mjs` by hand (it's generated) instead of `navigation.yml` + `gen:sidebar`.
- Leaving a deleted slug still referenced by inbound links or a stale nav entry.
- Pre-deciding a cross-cutting feature's home instead of posing it to the owner.
- Filing a topic by nearest name when its true siblings live elsewhere (place by meaning).
- Ranking a regroup by how often a word appears instead of who links to the page.
- Restructuring the nav for a regroup unilaterally instead of proposing before/after to the owner.
