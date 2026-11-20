# Visual element catalog (Apps and Getting Started, 2026-10-14)

Paths are in keboola/connection-docs. "GS branch" = `PRDCT-487-hub-course` (PR #1144), not on main yet.
Every element must survive the markdown twin: plain-string props on one line, one `<li>` per line.

## Prereqs: the "Before you start" box

- **Where:** site-wide `src/components/Prereqs.astro` (main); the Getting Started version
  `src/components/getting-started/Prereqs.astro` adds `from`/`to` slots and tab lines (GS branch).
- **Wording** lives in `prereqs.mjs`, so the same item reads the same on every page.
- **Use:** `<Prereqs needs={['project']} groupLabel="Depending on how you build">` with page items as
  `<li>` children and a second list as `<li slot="group">`. Tab-specific lines: `tabs={N}` plus
  `<span slot="prompt|ui|cli">` overrides. `tabs` takes the first N of Prompt, UI, CLI / API, so a
  page with only UI and CLI tabs cannot use it: write the CLI line as a page item instead
  (`<li><strong>For the CLI / API tab:</strong> …</li>`, as `storage/tables/load-csv` did).
- **Example:** `data-apps/build-locally.mdx:25`, every `getting-started/*/index.mdx`.
- Nikita likes the boxed look; use it on every task page instead of a "Prerequisites" heading.

## FromTo: where you are, when you finish

- **Where:** `getting-started/FromTo.astro` (GS branch). `<FromTo from="nothing exists yet." to="a project you can sign in to." />`
- **Use** on a hub or a standalone page; step pages put the same two cards inside `<Prereqs>`
  through its `from`/`to` slots.
- **Example:** `getting-started/index.mdx:129`. Main-only alternative: one state sentence after the lede.

## PathIntro + Tabs: Prompt, UI, CLI / API

- **Where:** `getting-started/PathIntro.astro` (GS branch) + Starlight `<Tabs syncKey="howto">`.
- **Labels are a contract**, byte for byte: `Prompt`, `UI`, `CLI / API`. The sync key remembers the
  reader's choice by label text; a different spelling silently drops out of the sync.
- **Use:** `<PathIntro tabs={3} manual={false} approvals={false} yours="…" />` once, before the first tabs.
- **Example:** `getting-started/app/index.mdx:124`. `syncKey="howto"` with these labels is the
  Getting Started contract (GS branch); main has no `howto` tabs yet. The Apps pages on main sync
  their own choices instead: `syncKey="ai-client"` (Claude Code, Cursor, …), `"oidc-provider"`,
  `"os"`. A new task page with Prompt / UI / CLI ways through uses `howto` and these labels.

## FlowStrip: how it works in three or four boxes

- **Where:** `getting-started/FlowStrip.astro` (GS branch), styles `.gs-flow`.
- **Use:** `<FlowStrip steps="A URL|The HTTP connector, one row per file|A table in Storage" label="…" />`;
  `code` in backticks renders as code; the twin prints the steps joined with arrows.
- **Example:** `getting-started/app/index.mdx:143`. Replaces "three paragraphs about the mechanism".

## StageStrip: numbered dots for 3 to 6 stages

- **Where:** `src/components/StageStrip.astro` (main), styles `.stage-strip`. Full procedure: `docs-stage-strip`.
- **Use:** `<StageStrip label="Building with an AI agent, in four stages" caption="…">` with one
  `<li><strong><a href="#anchor">Title</a></strong> 12 words or fewer.</li>` per stage, each on one line.
- **Example:** `data-apps/build-locally.mdx:62`. At most two strips per page.

## CourseLine and PageMeta: the course frame (Getting Started only)

- `<PageMeta genre="Tutorial" />` under the title: the page type for a cold landing (G1).
- `<CourseLine current="load" />` at the top of a step (dots, done steps filled, this one ringed);
  `<CourseLine layout="list" />` on the hub. The course lives in `course.mjs`.
- Pages with the course bar are exempt from the `Next` footer (D5).

## SampleData: the sample tables as cards

- **Where:** `getting-started/SampleData.astro`, data in `sample.mjs` (the twin reads it too).
- **Use:** `<SampleData />`. Replaced a paragraph plus a three-column table (David Esner, 2026-09-29: "too much text").

## CardGrid + LinkCard: where to go next

- **Where:** Starlight built-ins. `<CardGrid><LinkCard title="kbagent CLI" href="/cli/getting-started/" description="…" /></CardGrid>`
- **Use** for a choice between destinations (hub endings, "other ways to do this"); not for a reading order (that is `Next`).
- **Example:** `getting-started/index.mdx:221`.

## Collapsibles

- `<details><summary>What the forecast URL asks for</summary> … </details>`: detail most readers skip
  (the full URL, an error table, a "why" aside). 46 of them across Getting Started; the summary is a
  question or a noun phrase the skimmer can judge.

## Asides

- `:::tip[Find the exact names in Storage]`, `:::note[Your bucket name will differ]`, `:::caution`.
  The title states the point; the body is two or three lines.

## Diagrams

- Hand-authored SVG under `public/<section>/`, referenced as an image with alt text that says what
  the picture says: `public/cli/how-it-works.svg`, `public/workspace/workspace-states.svg`.
  Keboola palette (`docs-clip/references/explainer-look.md`), text as text (not outlined).
- **Size:** viewBox at most 640 wide and labels at least 16 px in it. The column is 713 px and
  shrinks on a phone; a 920-wide diagram with 12 px labels rendered at 7 px in the field test.
  (`cli/how-it-works.svg`, 860 wide with 11.5–15 px labels, is too small by this rule.)
- **Light and dark:** an `<img>` SVG cannot follow Starlight's theme toggle (`prefers-color-scheme`
  inside the file follows the OS, not the site). Draw it on a white rounded card with its own
  border, so it reads the same in both themes.

## Motion and screenshots (other skills)

- States GIF, narrated recording, explainer: `docs-clip` (form chosen from `clip-grammar.md`).
- UI-locator screenshots: `capturing-keboola-ui-screenshots`.
- Hub explainer clips: Remotion compositions in `docs-clip/remotion/`.
