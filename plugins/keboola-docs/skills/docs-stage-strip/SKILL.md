---
name: docs-stage-strip
description: "Use when a help.keboola.com how-to should show its 3 to 6 stages as numbered dots on a line (the StageStrip component, the Getting Started look), with a UI-locator screenshot of the screen a stage ends on. Triggers: \"полоса этапов\", \"полоса с точками\", \"stage strip\". Moving hub explainers belong to docs-clip."
---

# Stage strips for the Keboola docs

A stage strip is the Getting Started hub picture (numbered blue dots on a line, a bold title and one
line of text under each) drawn in HTML and CSS on a how-to page. Nikita asked for it on
build-locally on 29 Sep 2026 and chose the static strip over an animated clip.

## Decide first

- A how-to whose reader walks through 3 to 6 stages in order earns one strip per path, placed
  under that path's intro. build-locally has two: with an AI agent, and by hand.
- An overview hub that should show how something works in motion gets the docs-clip explainer
  instead: words and dots on a line that draws itself.
- A reference page or a single task gets nothing. Its numbered list already is the picture.
- Two strips per page at most, never one per section.

## Write the stages from the page

- One stage per thing the reader does, usually one per H3. The title is what the reader does there,
  in the page's own words, and it links to that H3's anchor. A stage without a heading of its own has
  no link.
- A strip follows one route in order. When a section has another route whose stages come in a
  different order, such as a UI route that pushes before it connects, name the route in the label and
  the caption ("From a terminal") and let the other route's own section cover it. When the other
  route changes only one stage, such as an MCP route that previews a draft before production, keep
  one strip and give that stage's section a line about it (build-locally's Check the app has one).
  The reviews of build-locally caught both on 29 Sep 2026.
- The line under the title has 12 words or fewer, made from sentences the page already has. No
  timings, no numbers the page can't back, no dashes, no new claims. If a stage needs a fact the page
  doesn't state, fix the page first.
- The build log warns outside 3 to 6 stages.

## Markup

```mdx
import StageStrip from '../../../components/StageStrip.astro';

<StageStrip label="Building by hand from a terminal, in four stages" caption="From a terminal">
  <li><strong><a href="#app-structure">Write the code</a></strong> A standard web app, plus a small configuration folder.</li>
  <li><strong><a href="#from-a-terminal">Create the app</a></strong> kbagent creates it with a Keboola-managed repository.</li>
  <li><strong>Push the code</strong> Commit and push it to the app's repository.</li>
  <li><strong>Deploy and open</strong> Deploy, then click Open App on its page for the password.</li>
</StageStrip>
```

- The page has to be `.mdx`. Rename a `.md` page with `git mv`; the slug stays. Before renaming,
  scan the prose outside code fences for `{`, `}`, `<!--` and `<https://`, because MDX evaluates
  braces (the `mdx-braces-evaluate` memory).
- Keep the opening tag and each `<li>` on one line, `<strong>` first, with no blank lines inside.
  The markdown twin reads them line by line.
- Write HTML inside the items (`<strong>`, `<a>`, `<code>`), as the Prereqs box does. A markdown list
  would be turned into step cards by `beacon-transforms`.
- `label` is the list's accessible name, and the twin prints it in bold as the strip's heading.
- `caption` is an optional visible caption above the dots, styled like the Prereqs box label. Use it
  when the strip follows one of several routes the section describes ("From a terminal"), so readers
  see which one.
- The full example, with its twin output, is in `references/example.mdx`.

## Placement

Right after the section's intro paragraph, above its first H3, and after the Prereqs box when the
section opens with one.

## What the component does

`src/components/StageStrip.astro` holds the markup, `.stage-strip` in `src/styles/custom.css` the
styles, and `src/integrations/page-markdown.mjs` the twin.

- Dots are numbered with a CSS counter, with a line between them.
- The strip is horizontal while the content column is wider than 36rem and vertical below that. It
  uses a container query, because between 800 and 1400 px the sidebar leaves the column about
  450 px wide. In the vertical layout each stage needs `flex: none`: the horizontal layout's
  `flex-basis: 0` plus `min-height` squeezed each stage to one dot's height.
- Dots and line are `--kbc-blue-600`, where white numerals pass 4.5:1. Titles are
  `--sl-color-white` and text `--sl-color-gray-3`, so both themes follow the tokens.
- Getting Started's `CourseLine` (#1144) draws the course the same way from its own data. Reuse one
  of the two; don't build a third.

## The markdown twin

`dist/<slug>/index.md` shows the label in bold as the strip's heading, then the stages as
`1. **Title (#anchor).** text`. The visible `caption` stays on the page only.
Grep it for leftover `<StageStrip` or `<li`.

## Pairing a stage with a UI screenshot

When a stage ends on a screen the reader has to recognize, such as a dialog or a button, put one
UI-locator screenshot under that stage's H3.

- Capture with Playwright and the saved session `~/.keboola-shots/state.json` in project 264,
  as `docs-clip/scripts/record.mjs` does. Never type credentials.
- Probe before you write. Read the labels on the real screen before trusting what the page says.
  The 29 Sep capture found the app password in the dialog that **Open App** opens. Four pages had
  put it "next to Open App" or said it "sits on the app's configuration page, ready to copy".
- Crop to the element with `page.screenshot({ clip })`, inset about 8 px so rounded corners don't
  show the dimmed page behind. Keep out the top bar, names, avatars, emails and other projects
  (PRDCT-616).
- Refuse to shoot if any secret-looking string is visible. A password field has to show dots.
- State changes need the author's yes first. If the screen needs a running app or any other change,
  ask, then put things back. The 29 Sep capture started app 74021867 with `kbagent data-app deploy`
  and stopped it again with `kbagent data-app stop`.
- Save to `public/<section>/`, under 250 KB, with alt text that says what is on screen.

## Checks before the PR

1. `npm run build` with no StageStrip warning, then `node scripts/check-cli-reference.mjs`,
   `node scripts/audit-phase2.mjs` and the docs-link-redirect-check skill.
2. The twin, as above.
3. Preview at 1280 px in light and dark (horizontal), at 820 px (vertical, sidebar showing) and at
   375 px (the strip no wider than the viewport). Click every linked stage.
4. fact-checker and guide-tester, per the repo's CLAUDE.md. Then the humanizer on the new lines and
   the checker agent until PASS.

## What lives where

- The component, the CSS and the twin code: in the docs repo.
- This skill: the keboola-docs plugin, `skills/docs-stage-strip`.
- The example: `references/example.mdx`.
- Capture rules for the UI-locator shot: `${CLAUDE_PLUGIN_ROOT}/skills/capturing-keboola-ui-screenshots/references/keboola-ui-capture.md`.
