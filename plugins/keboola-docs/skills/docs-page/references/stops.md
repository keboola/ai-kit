# Stops: how a proposal is shown and how the author answers

Nikita, 2026-10-14, on the first docs-page run: "ничего не понятно где что написано… мб делать
репорт или типо опросник". The two-column fixed-width block wrapped into a mess in the chat
pane. The rule from now on:

## 1. The proposal is a table, never a code block

One markdown table, one row per decision, four columns. Cells are short phrases; the rule id goes
in the Why column; links and paths in backticks. No ASCII alignment, no "→" chains.

| Decision | Proposal | Why | Alternative |
|---|---|---|---|
| Type | how-to | D8: one task with an observable result, nothing to teach | explanation, if the reader's question were "why" |
| Slug | `data-apps/pause` | reader's words, singular, "app" not "data app" (D14) | `data-apps/pause-and-start` |
| Nav | Apps › Run & share, after `operate/` | D12: reading order; `operate/` Next → here, here → `troubleshooting/` | before `operate/` |
| Redirects | none | new page | |
| Visuals | Before you start box, Prompt/UI/CLI tabs | task page with three ways through (`docs-visuals` catalog) | plain lists |
| Media | states GIF under step 2 | Apps rule: a menu and what it opens; `clip-grammar.md` | none |

Add a one-line **Finding** above the table when something changes the picture (a page that
already covers the topic, a sibling page with a stale fact), so the author reads it first.

## 2. The question is asked with the AskUserQuestion tool

When the host has it, the stop is an AskUserQuestion with 2 to 4 options, the recommended one
first and marked "(Recommended)", each option's description being the reason in one sentence. The
author picks or types a correction in "Other". Three stops, three questions at most:

| Stop | Header | Options |
|---|---|---|
| 1 Type and map | "Page map" | Go with the map (Recommended) · Fold into `<existing page>` instead · Change the type · Change the place |
| 2 Visuals | "Visuals" | `<proposed elements and media>` (Recommended) · Text only · A different element or form |
| 3 Ship | "Ship" | Push and open the PR · Keep the commit local · Discard the branch |

Without the tool (another host, a scripted run): the table, then one line "Reply ok, or name the
row to change", and stop.

## 3. What never happens

- No proposal inside a fenced code block.
- No two-column layouts, tabs or padded spaces for alignment.
- No more than one table per stop; details go to the state file, not to the chat.
- No stop skipped because the answer "seems obvious".
