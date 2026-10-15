# Diátaxis rules for help.keboola.com pages

`section-rework`, `devdocs-rework` and the repo's `CLAUDE.md` state these rules in prose. This
file gives each one an id, a tier, a checker and a live example, so a page can be held against
it. Change a rule here; the skills point here.

## Tiers

| Tier | Meaning | Who decides |
|---|---|---|
| **FAIL** | Blocks the handoff. Fix it before the PR is ready. | The script or the agent, mechanically |
| **WARN** | Worth fixing while the page is open; never blocks. | Same |
| **EVIDENCE** | A signal about the page's type or map. Goes into the handoff as an open question. | Nikita. Jordan, 2026-07-30: automated classification is evidence, not a verdict |

`checked by`: **S** = `scripts/check.mjs` (rule id in its output), **A** = the `diataxis-checker` agent.

## Rules

| id | Rule | Tier | Applies to | By | Source | Use this (on `keboola/main`) |
|---|---|---|---|---|---|---|
| D1 | Frontmatter has `title`, `slug` and a non-empty `description`. `slug` equals the file path (WARN when it differs). The site root (`index.md`) may have `slug: ''` | FAIL | all | S | section-rework §4 Frontmatter; CLAUDE.md house style ("title + description mandatory") | `data-apps/operate.md:1-5` |
| D2 | The type is declared: `<!-- <Type>-type page. Source … verified <date>. -->` right after the lede (`{/* … */}` in .mdx), or `<PageMeta genre="…">` on a Getting Started page. A comment marker above the lede is a WARN of its own; the type is still read from it | WARN | all | S | section-rework §4 Type marker; DECISIONS.md 2026-09-02 (GS) | `cli/workflows.md:11` (PageMeta pages are on the Getting Started branch, PR #1144, not on main yet) |
| D3 | A lede before the first `##`: one or two sentences saying what the page is, who it is for, and linking its siblings. A page that opens with a heading or a list has none | FAIL when missing; EVIDENCE on quality | all | S + A | section-rework §4 Lede | `cli/workflows.md:9` |
| D4 | No `# ` H1 in the body; `## ` is the page's top level (the title renders the H1). Fences are not headings | FAIL | all | S | section-rework §4 "`##` sections only" | any `cli/` page |
| D5 | `**Next:** [label →](/slug/)` is the last block and resolves to a page. Exempt: the last page of its nav group (a group is a nav item with a url and children; label-only groups belong to their parent), reference and troubleshooting pages, pages in a connector catalog (`components/extractors/`, `components/writers/`, `components/applications/`), and a page with the course bar (Getting Started's `<CourseLine>`), whose closing line may be a prose fork. Elsewhere a closing `**Next:**` line that is not in the footer form is WARN on an exempt page and FAIL on any other | FAIL | all but exempt | S | section-rework §4 Next footer | `cli/workflows.md:162` |
| D6 | 50 to 220 lines. Over 250 is the trigger to look for a split | WARN | all | S | section-rework §1 ("not a rule, a trigger"); devdocs-rework §3 band | `cli/concepts.md` (73), `data-apps/operate.md` (64) |
| D7 | How-to: each `##` task reads `**Goal:**` → steps → `**Result:**`, self-contained. On a page with no `##` at all, the `###` headings are the tasks | WARN | how-to | S | section-rework §4 How-to recipes | `cli/workflows.md` |
| D8 | One type per page. Frankenstein smells, any two make it `mixed`: concept prose + numbered steps; steps + a field table; the voice switches mid-page ("How it works" … "Click **Create**"); setup for several clients next to anything else | EVIDENCE | all | S counts, A judges | section-rework §1 smell tests; CLAUDE.md ("each page is ONE type") | counter-example: `ai/mcp-server/index.md` (591 lines, 19 step lists, 4 tables) |
| D9 | `VERIFY(Owner): …` and `TODO(Owner): …` always carry an owner, live in comments, and never reach `dist/<slug>/index.md` or `.html` | FAIL | all | S (`--dist` for the leak check) | docs-verify-markers skill; section-rework §7 | `data-apps/operate.md:13` |
| D10 | An overview carries weight: what it is, what you can do, a map of the section, never a bare list of links | EVIDENCE | overview / `index.md` | S ratio, A judges | section-rework §4 Overview; Guardrails | `data-apps/index.md`, `cli/index.md` |
| D11 | "connector" or "component", never "plugin", for a Keboola component. Product names (kbagent plugin, dataapp-developer plugin, an MCP client's Plugins menu) stay | WARN | all | S | CLAUDE.md house style; style-audit Nikita's rules | (a word rule, no example page) |
| D12 | Nav order is the reading order: the `Next` target is the next page in its `_data/navigation.yml` section, and every page is in the nav. Connector catalogs are skipped for the `Next` check: their nav order is alphabetical | WARN | all | S | section-rework §5 | `data-apps/` group (what-are-apps → Build → Run & share → Reference) |
| D13 | No type contraband: reference has no narrative or steps and lists limits last; explanation has no steps or field tables; tutorial has one path, no option matrices; how-to does not teach the concepts | EVIDENCE | per type | A | section-rework "Diátaxis quick reference"; CLAUDE.md ("limits at the bottom, never the top") | `data-apps/reference.md` (`## Limits` is the last section) |
| D14 | The title is in the reader's words, including synonyms and singular/plural; a shorter `sidebar.label` when the title is long | EVIDENCE | all | A | section-rework §4 (the "deprecated" vs "access changes" finding); Guardrails | `data-apps/what-are-apps.md`, `cli/concepts.md` (label "How It Works") |
| D15 | The split axis is the type, never the audience: no "for developers" page, no dev subtree. Technical material gets an on-page note | EVIDENCE | all | A | section-rework §2 and Guardrails (decision 2026-07-27) | the MCP worked example in section-rework |
| D16 | No `TEMPLATE:` instruction left on the page: the docs-page templates mark every block to fill with `TEMPLATE:` (in frontmatter, comments or prose) and all of them go before the page is handed off | FAIL | all | S | docs-page skill (templates); the commit gate | (new pages only; no page on main carries one) |

### Getting Started only (notes/getting-started/DECISIONS.md 2026-09-02, "cold landing")

Pages under `getting-started/` carry four more blocks. They are not site-wide rules; the agent
reports them as EVIDENCE on those pages only.

| id | Block |
|---|---|
| G1 | `<PageMeta genre>` under the title; the time budget only on the hub and the with-kai page (Nikita, 2026-09-29: PageMeta.astro), the position from `<CourseLine>` |
| G2 | A state sentence: where the reader is, what they will have when they finish |
| G3 | `<Prereqs>` rendered from the shared partial |
| G4 | A verification block at the bottom: how the reader knows it worked |

## What the script measured on `keboola/main` (2026-10-08, 372 pages)

| Finding | Pages |
|---|---|
| D1 FAIL (no description) | 327 |
| D5 FAIL (no or broken Next) | 339 |
| D2 WARN (no type declared) | 363 |
| D6 WARN (outside the band) | 151 |
| D9 FAIL (17 pages leak a marker into `dist/`, 4 markers have no owner) | 21 |
| D3 FAIL (opens with a heading) | 18 |
| D4 FAIL (H1 in the body) | 6 |
| D8 EVIDENCE (two or more smells) | 35 |
| D10 EVIDENCE (thin overview) | 31 |

Most of the site fails D1 and D5 today. That is the revamp backlog. The checker is for pages
being handed off, where the FAIL rules cost minutes to meet.

## Rulings

- 2026-10-08, Nikita: the type marker is WARN, `Next` is FAIL with the three exemptions above.
  Reason: section-rework asks for a marker on every page, yet on main the marker sits on 4 of 9
  `cli/` pages and 0 of 13 `data-apps/` pages; blocking on it would stop every Apps handoff.
- 2026-10-08, Nikita: type judgement (D8, D10, D13 to D15) is EVIDENCE and never a verdict. The
  page map stays a human call.
- 2026-10-08: a `slug` that differs from the file path is WARN under D1, not FAIL: 16 pages on
  main do this on purpose (`ms-sql/` → `microsoft-sql`).
- 2026-10-09, Nikita: a page with the course bar (`<CourseLine>`) is exempt from D5. The bar and
  Starlight's Prev/Next already carry the next step, so a `**Next:**` footer would be the third copy;
  the Getting Started duplication audit of that day found exactly that. A closing `**Next:**` line
  there may be a prose fork (project/, with-kai/). Fixtures: `course-step.mdx`, `course-fork.mdx`.
- 2026-10-13: D5's "last page" is the last page of the nav group, not of the top-level section (GE publish/, streamlit/migrate-to-python-js/).
- 2026-10-13: a prose `**Next:**` line on a page exempt from D5 is WARN. The page needs no footer,
  so the line is a style note there. A page that is not exempt keeps the FAIL. Fixtures:
  `sub/last.md` (WARN), `prose-next.md` (FAIL).
- 2026-10-13: the type marker goes after the lede. A marker above it is WARN under D2, and the type
  is still read from it. Fixture: `marker-first.md`.
- 2026-10-13: when a how-to has no `##` section, D7 reads its `###` headings as the tasks. D7 used to
  skip such a page. Fixture: `howto-h3.md`.
- 2026-10-14: D16 added with the keboola-docs plugin. A `TEMPLATE:` leftover is the one way a
  skeleton reaches readers; the gate refuses the commit. Fixture: `template-left.md`.
- 2026-10-13, Nikita: connector catalogs are exempt from D5 and D12; their nav order is alphabetical, not a reading order (writers pass, dbt trigger in #1190).
- 2026-10-14: marker format for agents. The site build (`page-markdown.mjs`, branch
  `agents-llms-twins`) copies the type and date into each page's markdown twin and `llms.txt`
  entry. It reads only `<Type>-type page` or `<Type>-hub page` (`Overview-hub` counts as
  explanation) and `verified … YYYY-MM-DD` in the same comment, and skips `VERIFY`/`TODO`
  comments. A looser form such as `<!-- How-to page -->` still passes D2 here but reaches agents
  without a type, so write the full form: `<!-- How-to-type page. Source: … Verified 2026-10-14. -->`.

### Open

- D7 `Goal/Result`: FAIL once a second how-to section uses the shape? Today `cli/workflows.md` is
  the only one; `data-apps/` how-tos write prose tasks. Nikita's call.
- D6 lower bound: a 36-line leaf (`data-apps/publish-and-share.md`) reads fine. Keep the WARN, or
  exempt leaf pages with a `Next`?
- D2 on `.md` pages: the build strips comments now (`strip-comments.mjs`), so a marker costs the
  reader nothing. Should new pages get one by default? Once `agents-llms-twins` merges, the marker is also what
  tells agents the page type in `llms.txt`, which argues for yes.

## Adding a rule

One row, in the table above: id, tier, who checks it, the source it comes from, and a page on
`keboola/main` that passes it verbatim. A rule without a source waits in the Open list until
it has one; a word rule like D11 needs no example page. If the script checks it, add a fixture under `scripts/fixtures/` and
a test in `scripts/check.test.mjs` first.
