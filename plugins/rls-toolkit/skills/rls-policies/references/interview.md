# Interview script

Ask with AskUserQuestion, one decision per question. Show what discovery already found and ask
only to confirm or correct it. Nothing is written before step 9.

## 1. Where is it enforced?
Data app (which one: list the apps), the Keboola MCP server's workspace, another governed
workspace, or more than one. For a data app, run the discovery of `data-app-discovery.md` first.

## 2. Preconditions
Show: Storage access, SSO on every path, provider types, project feature. When one fails, offer
the exact fix and ask. Do not continue to rules until the app can be governed.

## 3. Who are the readers
- Identity provider: from the config (oidc, gitlab, github, jumpcloud).
- OIDC/JumpCloud: "Which group strings does your IdP send for the users of this app?" Offer
  `["*"]` for "everyone signed in". Warn: case-sensitive; Entra sends ids unless configured.
- GitHub or no groups: only `["*"]` or a few named `subjects` (`<idp>|<login>`); say the login can
  change hands.
- Administrators: do they need access? If yes, which rule (`keboola|<user id>` subject or a group).

## 4. Which tables
Show the candidate list (config tables + tables found in the app source). The user removes and adds.
For each table ask: restrict rows, restrict columns, or both?

## 5. Row rules (per table)
Suggest, from `storage table-detail` columns and a sample of distinct values:
- A dimension column (`region`, `country`, `owner`, `org_id`, `tenant`, `team`, `department`):
  "Group A sees value X, group B sees value Y" built from the groups of step 3.
- An ownership column holding an email: a rule with `{"$identity":"email"}` for the group of
  sales reps; readers without a verified email are refused, so ask whether that is acceptable.
- Managers/auditors: a rule with `{"true":true}`.
Ask for the `default` and recommend `{"false":true}` (no rows) over a refusal.
Sample values only with a read query the user agrees to; never paste data back into files.

## 6. Column rules (per table)
Suggest PII-like columns by name (`email`, `phone`, `birth`, `ssn`, `salary`, `margin`, `address`,
`iban`): which groups may see them. Everything else is visible to the groups with a rule. A table
with a cls-policy also needs an rls-policy. Warn: a cls-policy cannot be bound to a data app yet.

## 7. Scope
Default `targeted` (this project). Ask about `--target-project` grants or `organization` scope only
when the user brings it up, and say they need an organization admin and that an organization policy
affects every project on every backend.

## 8. Summary and dry-run
Run every write with `--dry-run`, print one table (table | kind | selector -> condition/columns |
default | create or update), list tables the app reads that have no policy, and ask for "go".

## 9. Apply and bind
Apply per table (`create`, or `update` when a policy for the table exists), collect the UUIDs, bind
(data app: `runtime.workspace.rlsPolicies`; other governed workspace: `rls bind`). Say that a
changed list needs a redeploy or restart and ask before deploying.

## 10. Close-out
- List project tables without a rls-policy (also any bucket or table created in this conversation)
  and offer to cover them: a governed reader gets nothing from them.
- When the user created new tables during the session, suggest policies for them, never silently.
- Give the manual check: sign in to the app as a user of each group and compare with the summary.
