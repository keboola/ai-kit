---
name: section-rework
description: "Use when restructuring a help-docs section into Diátaxis shape: splitting frankenstein pages, turning a link-list overview into a real one, or shaping a migrated section into tutorial, how-to, reference and explanation pages with a reading order. Stops for OK on a page map. Where a section lives in the nav: migration-placement."
---

# Section Rework — one page, one Diátaxis type

## Overview

A section is "done" when a reader with **one** need can land on **one** page that serves only
that need, and the pages read in an order. The two failure modes this skill exists to kill:

- **The frankenstein page** — one page mixing 2+ Diátaxis types (concept + steps + field
  table). The audit counted ~16/20 in Transformations and ~13/19 in Management. Such a page
  can't be improved in place; it has to be split.
- **The thin link-directory overview** — a section index that is just a list of links, or a
  stub page whose payload is a link elsewhere.

Poster child (the section this skill was built from): **MCP.** After the dev→help merge,
`ai/mcp-server/index.md` was a **562-line** single page carrying explanation + per-client
setup + tool reference + troubleshooting, while `management/project/mcp-server/index.md`
sat in nav as an **18-line** duplicate stub — two "MCP Server" entries, no reading order.

**Behaviour:** classify → **propose the page map and stop** → after approval, split, reshape,
renumber the nav, verify. Within-page work (lede, headings, `Next` footer, type marker,
frontmatter) is applied without asking; **creating/splitting/deleting pages and changing nav
is gated on the owner's OK.** Jordan, 2026-07-30: *AI must not decide information
architecture* — automated classification is **evidence, not a verdict**.

## When to use

- Reworking a native help section (Storage, Flows, Transformations, Getting Started).
- Shaping a section that just landed via a dev→help migration, **after** placement is settled.
- Splitting a single frankenstein page, even outside a full section pass.

**Not for:**
- *Where* content lives + duplicate hunting → `migration-placement` skill (run it **first**;
  it answers "right home, one canonical page"; this skill answers "right shape").
- Fact accuracy of the result → `fact-checker` agent (run it **after**, standing authorization).
- Whether a guide is followable → `guide-tester` agent (run it **after**, on tutorials/how-tos).

## Procedure

### 1. Inventory & classify

```bash
find src/content/docs/<section> -name '*.md*' | grep -v /dist/ | sort   # never include dist/
wc -l src/content/docs/<section>/*.md*
grep -rn -- '-type page' src/content/docs/<section>        # already-classified pages
grep -n -A25 'url: /<section>/' _data/navigation.yml       # current nav shape + order
```

Read each page (don't classify from the title — titles lie) and tag it
`tutorial | how-to | reference | explanation | mixed`. Record: path, line count, type,
and which slugs link in (`git grep -n "<slug>" -- src/content/docs/`).

**Frankenstein smell tests** — any two of these on one page means `mixed`:
- Conceptual "why / how it fits" prose **and** a numbered step list.
- A step list **and** an exhaustive field/flag/error table.
- `##` headings that switch person mid-page ("How it works" … then "Click **Create**").
- Install/setup steps for **several** environments or clients on the same page as anything else.
- Over ~250 lines. Not a rule, a trigger to look: `cli/` pages land at 73–162 lines each.

### 2. Propose the page map — **GATE. Stop here.**

Produce, and **write no files until the author approves**:

1. **Before → after table:** old page (lines, type) → new page(s), each with type, `title`,
   `slug`, what content moves into it, and which old slugs die with `redirect_from`.
2. **Before/after nav subtree** (`_data/navigation.yml` shape, with groups).
3. **Reading order** — the `Next` chain, explicitly.
4. **Open questions** you are *not* deciding (a topic whose home is genuinely arguable, a
   page that may belong to another section, content that looks retired).

Keep it compact enough to read in a minute. If the map implies moving content *out of* the
section, that is a placement decision → `migration-placement`, not this skill.

**The split axis is the Diátaxis type — never the audience.** No `for-developers` /
`for-business-users` page, no dev subtree, no dev/help split in the nav (decision 2026-07-27).
Reference and explanation are written **once** and shared; when material inside a page is
markedly more technical, the signal goes **on the page** — a top-of-section note ("this part
is for technical readers — skip it, or hand it to your agent") or in-page highlighting — not
into a separate page or nav group. Two how-to pages may split by **task family** (e.g.
"connect a client" vs "run the server yourself"); check the honest reason — if the real
divider is *who reads it* rather than *what they're doing*, it's the wrong split.

### 2b. Check who links to the anchors you're about to destroy

A split dissolves the old page's `##` anchors. In-repo links are step 3's job, but **external
repos link to docs anchors too** and no local grep will show them:

```
gh search code "help.keboola.com/<section>" --owner keboola   # READMEs, dev docs, skill files
```

The MCP pilot: `keboola/mcp-server`'s README linked to
`help.keboola.com/ai/mcp-server/#remote-server-setup`, an anchor the split deleted. Either keep
an anchor-compatible heading on the surviving page (cheap, and it can just route onward), or
open a one-line PR against the other repo — but decide, don't discover it later.

### 3. Split (after approval)

- **One new page per type.** Move content **verbatim first**, rewrite second — a split and a
  rewrite in one pass makes the diff unreviewable and loses content silently.
- Page = **folder + `index.md`** (co-locate images) for a topic with assets; a flat
  `<name>.md` next to its siblings is fine for a leaf page (`cli/`, `data-apps/` are flat).
- Every retired slug: `redirect_from:` in the surviving page's frontmatter (list or string).
  The `src/integrations/redirect-from.mjs` integration writes the stub; it won't overwrite a
  real page.
- Repoint inbound links: `git grep -n "<old-slug>" -- src/content/docs/ _data/navigation.yml`
  → update every hit. A split that leaves the old URL as a competing overview has **not**
  been migrated (Jordan 07-30: the goal is de-duplication, not relocation).
- Anchors count too: `git grep -n "<old-slug>#"` — a split usually breaks `#heading` targets.

### 4. Page shape (the observable standard)

The rule list with ids, tiers and live examples is
`${CLAUDE_PLUGIN_ROOT}/skills/docs-diataxis-check/references/rules.md`; this section is the narrative behind it,
never a second list.

Every rule below is visible in the two shipped sections — `src/content/docs/cli/` and
`src/content/docs/data-apps/`. Copy them, don't invent conventions.

**Frontmatter**
```yaml
---
title: How kbagent works          # the user's words, not the product's noun label
slug: 'cli/concepts'              # full path, no surrounding slashes; == file path
sidebar:
  label: How It Works             # shorter nav label when the title is long
description: 'The concepts behind the kbagent CLI — the connection and config model, …'
redirect_from:                    # on any move/rename/merge
  - /data-apps/build-with-kai/
---
```
`title` + `description` must use the reader's **symptom vocabulary**, including
singular/plural and synonyms — the sharpest traffic finding: a page titled "access changes"
earns ~0 clicks while users search "deprecated".

**Body**
- **Lede:** one or two sentences saying what the page is, who it's for, and linking its
  siblings (`cli/workflows.md`: "Practical recipes for kbagent. Each is self-contained… For
  the ideas behind them see How it works; for every command and flag see the reference.").
- **Type marker** — an HTML comment (JSX comment in `.mdx`) right after the lede recording
  type + source + verification date:
  `<!-- Reference-type page. Groups + subcommands verified against kbagent v0.66.0 --help, 2026-07-13. Source: keboola/cli. -->`
- **`## ` sections only** for the page's own structure; no `#` (the title renders it).
- **How-to recipes** = `**Goal:**` → steps → `**Result:**` blocks, one `##` per task
  (`cli/workflows.md` — 10 recipes, each self-contained).
- **Overview page must be substantial** — never a link directory. Two shipped templates:
  `cli/index.md` (what it is · **What you can do with it** · In one minute · **Why a CLI and
  not just the UI** · **This section** — a one-line map of every sub-page · how it relates to
  the other tools) and `data-apps/index.md` (same job, but the sub-page links are threaded
  into the narrative sections instead of a "This section" list, plus a showcase). Either
  works; a bare list of links does not. Don't over-trim an already-rich overview.
- **`Next` footer on every page in the sequence** (all 6 `cli/` pages, 8 `data-apps/` pages):
  `**Next:** [Get started with kbagent →](/cli/getting-started/)`
- **Copy-pasteable blocks stay** — code fences get copy buttons; an image never replaces a
  command. Transcribe code/values out of screenshots into fences.
- **`.mdx` only when the page needs components** — `<Tabs syncKey>` for per-OS or per-client
  steps (`cli/getting-started.mdx`). Plain `.md` otherwise. **Never link to content that lives
  inside another tab**: synced tabs don't switch on anchor navigation, so the reader lands on
  the tab strip exactly where they were. Say "open the X tab above", or repeat the snippet.

### 5. Nav = reading order

- Edit **`_data/navigation.yml`**, then `npm run gen:sidebar`. **Never** hand-edit
  `src/sidebar.mjs` (generated).
- A section is a **group**, never a lone page. Nav order **is** the reading order and must
  match the `Next` chain.
- Use sub-groups when the section has phases — `data-apps`: `What are apps?` → **Build**
  (With Kai / Locally) → **Run & share** (Authentication / Publish and share) → `Reference`
  → `Streamlit Apps`. Compare the flat 7-item `cli/` group: Get Started → How It Works →
  How-to Guides → Use with AI Agents → Command Reference → Web UI → Troubleshooting.
- Nav `url` = slug **with** slashes; `title` = display label.

### 6. Screenshots — by page type

- **tutorial / how-to** → real step screenshots. Break the flow into its most important steps,
  one clean image per step, under the matching heading. Capture in the **demo project 264**
  ("[Keboola] GROWTH – KBC Toy Co.", dummy Shopify) — **never** real-customer data. Clean
  frames: no stray modals, side panels, or account menus; the shot must actually show the
  thing (a dropdown page needs the dropdown open).
- **reference / explanation (API, CLI, technical)** → **no screenshot requirement**
  (decision 2026-07-14). Explain the response/output instead; use real terminal captures or
  a hand-authored diagram (`cli/concepts.md` uses `public/cli/how-it-works.svg`) where a
  picture genuinely helps.
- **Migrated screenshots — three buckets** (`Method.md`): **keep** locators (where a control
  is) · **transcribe** code/values/CLI output into fences and drop the image · **drop**
  decorative hero shots. Default to transcribing over keeping; keep a locator when unsure.
- Never fabricate or placeholder an image. `scripts/screenshot.mjs` is the local-only helper;
  **`scripts/shoot.mjs` is not gitignored — don't commit it.** Keep throwaways out of the repo.

### 7. Verify & hand off

```bash
npm run build                                   # clean, no fatal errors
node scripts/audit-phase2.mjs                   # MISSING IMAGES 0, no new broken links
node scripts/check-redirects.mjs                # when slugs moved (see AGENTS.md for flags)
npm run check:cli                               # only if CLI pages changed
git grep -n "<every-deleted-slug>" -- src/content/docs/ _data/navigation.yml   # → zero hits
```
Run the `docs-diataxis-check` skill on every changed page (script, then the `diataxis-checker`
agent) and fix its FAILs; its EVIDENCE rows go into the handoff as open questions.
Then, without asking (standing authorization): **`fact-checker`** on every changed page, and
**`guide-tester`** on any tutorial/how-to. **Budget real work for what they return** — a rework
is the moment inherited rot surfaces, and it's yours to fix now that you're touching the page.
The MCP pilot inherited two dead facts from the dev-docs original (a `GOOGLE_APPLICATION_CREDENTIALS`
setup for a code path removed months earlier; credentials in a URL query string the server had
stopped reading) and a how-to that told readers to connect to a port nothing on the page could
make it listen on. Delete what no longer works, record the evidence inline as a `VERIFY(owner)`
comment so a reviewer can challenge the deletion, and say so in the handoff. Verify CSS-dependent behaviour in a production
build (`astro build && astro preview`), not `npm run dev`.

Facts you cannot observe (limits, versions, policy, internals) → inline `VERIFY(owner)` /
`TODO(human-review, <name>)` **plus** a Linear accuracy issue for that section. Never guess a
product fact.

**Ship:** one section = **one PR** to `upstream` (keboola/connection-docs), page-by-page
commits; draft PR stays "In Progress"; never merge. Hand off in the `jordan-pr-handoff`
format — intro + per-PR block: PR link + `/files`, what changed, Vercel preview **deep-linked
to the reworked slug**, repo path — and name the ONE open decision if step 2 left one.

## Diátaxis quick reference

| Type | Reader's need | Voice | Must NOT contain |
|---|---|---|---|
| **tutorial** | learning by doing, one guaranteed path | "you will build…", ordered steps, one worked example | alternatives, option matrices, exhaustive flags |
| **how-to** | get a specific task done | Goal → steps → Result, self-contained recipes | teaching the concepts, full field tables |
| **reference** | look something up | dense, complete, uniform, tables | narrative, tutorials, opinions |
| **explanation** | understand why / the mental model | prose, diagram, trade-offs | step-by-step instructions, field tables |

Reference and explanation are written **once** and shared across audiences (user + developer);
only the action layer (tutorial/how-to) may exist per-audience and links back to the shared
reference.

## Worked example — the MCP section

**Before:** `ai/mcp-server/index.md` (562 lines, `mixed`: what MCP is + per-client setup +
tool list + troubleshooting) · `management/project/mcp-server/index.md` (18-line stub, second
nav entry) · no reading order.

**Map, by type only:** `ai/mcp-server/` **explanation** hub (what it is, the hosting/OAuth +
transport model, dev-branch behaviour, use cases, This-section map) → `…/connect/`
**how-to**, `.mdx` with `<Tabs syncKey="client">` per client, programmatic connection recipes
in the same page behind an on-page "more technical" note → `…/tools/` **reference** (tool
catalogue + access-restriction config; drifts by design against `tools.md` in the MCP server
repo, so the type marker records source + date) → `…/self-hosted/` **how-to** (Docker, uv,
pointing a client at localhost). No troubleshooting page — the source has none, and a rework
doesn't invent pages. **No `for-developers` page**: the SDK/API recipes are the same *connect*
task, so they stay in the how-to (first draft of this map got that wrong — audience axis).
Stub dies with `redirect_from`, one canonical nav entry, `Next` chain across the four pages.
Report note: two semantic-layer tools were knowingly missing at merge (#1050) — that's a
freshness-check question for the owner, not a one-off fix.

## Guardrails

- **Never split before the map is approved.** Classification is evidence; the structure call
  is the owner's.
- **One page, one type.** If you can't say which type a page is, it's `mixed` — split it.
- **Split by type, never by audience.** dev vs business is a facet handled on the page (a
  top-of-section note, in-page highlighting), never a page, a subtree, or a nav group.
- **One canonical page per topic.** Can't merge cleanly → redirect. Never ship two.
- **The overview carries weight** — no link directories, and don't over-trim an existing rich
  overview while "cleaning up".
- **Title in the user's words**, covering synonyms and singular/plural.
- **Don't document retired or non-working behaviour** (e.g. dev branches for apps; don't
  claim Streamlit is retired; don't assert E2B hosting). Ship a migration page, titled in
  symptom words, with any breaking change — same day, plus a banner on the affected page.
- **help = user-facing home; developers.keboola.com = deep dev reference.** Cross-link, don't
  mirror.
- **Backlink pass** after the rework: grep the docs for the section's topics and add inbound
  links from the most relevant pages. Nav alone is not enough.
- **Product facts vs content choices** — ask the owner; don't guess.

## Common mistakes

- Splitting (or renaming, or touching nav) before the page map is approved.
- Leaving the old page in place as a competing overview instead of redirecting it.
- Splitting and rewriting in one commit → unreviewable diff, silently dropped content.
- Forgetting `npm run gen:sidebar`, or hand-editing `src/sidebar.mjs`.
- A broken `Next` chain (or nav order ≠ reading order) after a split.
- Demanding screenshots on API/CLI reference pages — explain the output instead.
- Classifying pages by title instead of by reading them.
- Splitting out a "for developers" / "advanced users" page — that's the audience axis wearing
  a Diátaxis costume. Ask what *task or need* the page serves; if the answer is "the same one,
  but for a techier reader", it belongs on the same page with an on-page note.
- Including `src/content/docs/dist/**` in an inventory (local build cruft, not real pages).
- Handing off a bare PR link instead of the per-section report with a deep-linked preview.
