---
name: docs-visuals
description: "Use when a help.keboola.com page needs a visual element beyond plain text: a Before you start box, where-you-are and when-you-finish cards, Prompt/UI/CLI tabs, a flow of boxes, stage dots, sample-data cards, link cards, a collapsible, an SVG diagram. Picks the element from the Apps and Getting Started patterns and builds it. Triggers: \"визуализация\", \"сделай наглядно\", \"карточки\"."
---

# docs-visuals: the page elements Apps and Getting Started are built from

## Overview

The Apps and Getting Started sections read well because most of their structure is not prose: a
boxed **Before you start**, two cards saying where the reader is and where they will be, the same
three tabs on every task, a strip of boxes for "how it works", numbered dots for stages, cards for
the sample data, collapsibles for the detail most readers skip. This skill picks the element a page
needs and writes it the way those sections do. Clips, GIFs and screenshots stay with `docs-clip` and
`capturing-keboola-ui-screenshots`; this skill hands off to them.

Catalog with props, real examples and the twin rule: `references/catalog.md`. Read it before writing.

## Pick by what the reader needs

| The reader needs to… | Element | Not this |
|---|---|---|
| know what to have ready before step 1 | `<Prereqs>` box (site-wide), shared items by `needs`, page items as `<li>` | a bullet list under "Prerequisites" |
| know where they are and what they will have | `<FromTo from to>` cards, or the `from`/`to` slots of the Getting Started `<Prereqs>` | a sentence in the lede |
| do the same task by prompt, by clicks, or from a terminal | `<Tabs syncKey="howto">` with exactly `Prompt`, `UI`, `CLI / API`, introduced once by `<PathIntro>` | per-path sections with their own headings |
| see how a mechanism flows, 3 or 4 parts | `<FlowStrip steps="A\|B\|C">` | three paragraphs |
| walk 3 to 6 stages in order | `<StageStrip>` (dots on a line), `docs-stage-strip` | a numbered list of headings |
| see where this page sits in a course | `<CourseLine current="…">` (Getting Started only) | "Step 3 of 7" text |
| understand sample tables | `<SampleData />` cards from `sample.mjs` | a three-column table and a paragraph |
| choose where to go next among options | Starlight `<CardGrid>` + `<LinkCard>` | a bullet list of links |
| get detail most readers skip | `<details><summary>` | a long paragraph in the main path |
| see a model or architecture | hand-authored SVG in `public/<section>/` (like `cli/how-it-works.svg`) | a screenshot of a whiteboard |
| be warned or tipped | `:::tip[Title]`, `:::note`, `:::caution` with a short title that says the point | bold "Note:" lines |
| see the product doing something | `docs-clip` (states GIF, narrated recording, explainer) or a screenshot | |

One element per job; never two that say the same thing (a FromTo and a lede repeating it). One style
per element across the site: reuse the component, never restyle it on one page.

## How to build one

1. Read the catalog entry and the live example it points to.
2. Check availability: `StageStrip` and the site-wide `Prereqs` are on main; the Getting Started
   set (`PageMeta`, `CourseLine`, `PathIntro`, `FlowStrip`, `FromTo`, `SampleData`) lives under
   `src/components/getting-started/` on the Getting Started branch (PR #1144) until it merges. A page
   on main that needs one waits for that merge or uses the main-only alternative named in the catalog.
3. The page becomes `.mdx` when it uses a component; add the import line the catalog shows.
4. Keep every prop a plain string on one line, and every `<li>` on one line: the markdown twin
   (`src/integrations/page-markdown.mjs`) reads them off the tag for agents and View as Markdown.
5. Styles live only in `src/styles/custom.css` under the component's class (`.gs-flow`,
   `.stage-strip`, `.gs-data`…). A new element gets a component and a class there, never inline style.
6. Check: `npm run build`; open the page at 1280 px and 820 px, light and dark; open
   `dist/<slug>/index.md` and confirm the element reads as text; run `docs-diataxis-check`.

## A new element

When nothing in the catalog fits, propose it at the media stop before writing code: what reader need
it serves, which page uses it first, what the twin prints for it. It becomes a component in
`src/components/` (section-specific ones in a subfolder), a class in `custom.css`, a branch in
`page-markdown.mjs` so the twin can print it, and a catalog entry here.
