---
type: llm
focus: last_message
---
PASS if the reply proposes the page map as a markdown table (rows such as Type, Slug, Nav; columns for the proposal, the reason or rule, and an alternative), outside any code block, and then asks the author to approve or correct it before anything is written.
FAIL if the proposal is a fenced code block or free text without a table, if it gives no reason per decision, or if it says the page was already written.
