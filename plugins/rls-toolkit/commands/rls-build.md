---
name: rls-build
description: Guided setup of row- and column-level security for a Keboola data app (or a governed workspace) — find what the app reads, ask who sees what, generate the rls/cls policies in bulk, dry-run, apply on "go", and bind them to the app. Explicit invocation only.
allowed-tools:
  - Bash
  - AskUserQuestion
argument-hint: "[project-alias] [--app APP_ID]"
---

# Build RLS/CLS

Explicit invocation only. Follow the interview in
`skills/rls-policies/references/interview.md` step by step; the data model, rule grammar and
gotchas are in the `rls-policies` skill. Never write anything before the user has seen the summary
table and answered "go". Command flags: the `kbagent` plugin, the `rls-workflow` reference of the kbagent skill.

## 1. Preconditions

1. `kbagent rls --help` works (else: update kbagent, stop).
2. Pick the project (argument, only alias, or ask) and check the token is a master/admin token:
   `kbagent --json project info --project ALIAS` -> `is_master_token`. Policies can only be
   written by a project admin; grants to other projects and organization scope need an
   organization admin.
3. Read the live schema version: `kbagent --json rls schema --project ALIAS`. Author with
   `groups` / `subjects` only. Never author `principal` / `principals` (email); kbagent refuses them.

## 2. Target

Ask where the policies are enforced: a data app (list `kbagent --json data-app list`), the MCP
workspace, or another governed workspace. For a data app run the discovery in
`references/data-app-discovery.md`: providers, SSO on every path, Storage access, candidate tables.
Show what you found and ask the user to correct it.

## 3. Interview and generation

Run the questions of `references/interview.md` (groups, tables, rows, columns, defaults, admin,
scope). Write one rules file per table in a scratch directory
(`SCRATCH=$(mktemp -d)`; files `rls_<bucket>_<table>.json`, `cls_<bucket>_<table>.json`), never in
the user's repository.

## 4. Dry-run and summary

For every file run the same command with `--dry-run` and collect the previews:

```bash
kbagent --json rls create --project ALIAS --table-id in.c-bucket.table --rules @FILE --dry-run
kbagent --json cls create --project ALIAS --table-id in.c-bucket.table --rules @FILE --dry-run
```

Print one summary table: table | kind | group or subject -> condition / columns | default | action
(create, or update when a policy for that table exists: find it with `rls list`). Say what is NOT
covered (tables the app reads with no policy). Ask for "go". Apply nothing without it.

## 5. Apply

On "go", per table: `rls create` or `rls update` (never delete+create), then `cls create|update`.
Collect the policy ids (UUIDs) from the results; keep the ids of the RLS policies for step 6.
Stop at the first failure and report what was already written (re-running is idempotent: existing
policies are updated).

## 6. Bind

- **Data app:** write the RLS policy UUIDs into the app configuration at
  `runtime.workspace.rlsPolicies` (details and the exact command in
  `references/data-app-discovery.md`). `--merge` replaces a list, so read the current UUIDs and
  write the COMPLETE list. Tell the user that a changed list takes effect only after the app is
  redeployed or restarted, and ask before running `kbagent data-app deploy`.
  CLS policies cannot be bound to a data app yet (no `clsPolicies` key in the app configuration,
  see "Column-level policies for a data app (pending)" in `references/data-app-discovery.md`); say
  so, and keep them for governed workspaces of MCP/kbagent.
- **Governed workspace (MCP, kbagent):** `kbagent rls bind --project ALIAS --workspace-id WS
  --rls-policy ID --cls-policy ID --stack-id STACK --dry-run`, then without `--dry-run`. A wrong
  stack id writes a binding nothing reads, so confirm the stack id with the user.

## 7. Close-out

1. Re-run the coverage check of `/rls-show` and offer policies for tables that still have none,
   including any bucket or table created earlier in this conversation.
2. Give the user the manual check: query as a user of each group through the app (or
   `kbagent workspace query` for a governed workspace) and compare with the summary table.
