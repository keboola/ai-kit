---
type: llm
focus: last_message
---
PASS if the reply proposes a Diátaxis type (how-to) with the reason, a slug or file path, a place in the navigation, and then asks the author to confirm or correct before any page is written; or if it stops earlier because the current directory is not a connection-docs checkout and says a worktree is needed.
FAIL if the reply writes page content, picks the type without asking for confirmation, or asks the author which type they want with no proposal.
