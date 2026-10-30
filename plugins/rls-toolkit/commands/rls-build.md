---
name: rls-build
description: Guided setup of row- and column-level security for a Keboola data app (or a governed workspace) — find what the app reads, ask who sees what, generate the rls/cls policies in bulk, dry-run, apply on "go", and bind them to the app. Explicit invocation only.
allowed-tools:
  - Bash
  - AskUserQuestion
argument-hint: "[project-alias] [--app APP_ID]"
---

# Build RLS/CLS

Explicit invocation only. The questions are in `skills/rls-policies/references/interview.md`; the model,
rules and gotchas in the `rls-policies` skill; command flags in the `rls-workflow` reference of the
kbagent skill. This command owns the mechanics. Never write before the user has seen the summary table
and answered "go".

## 1. Preconditions and one read

Pick the project (argument, only alias, or ask). Set `export KBAGENT_CONVERSATION_ID="$(uuidgen)"` in
every Bash call and `SCRATCH=$(mktemp -d)`. Run in parallel and keep the results in `$SCRATCH`, then
reuse them (create versus update, coverage gap, discovery):

```bash
kbagent --json project info --project $P > $SCRATCH/project.json &   # is_master_token must be true
kbagent --json rls schema --project $P > $SCRATCH/schema.json &      # also the kbagent version probe
kbagent --json rls list --project $P > $SCRATCH/rls.json &
kbagent --json cls list --project $P > $SCRATCH/cls.json &
kbagent --json storage tables --project $P > $SCRATCH/tables.json &
wait
```

A failing `rls schema` with "No such command" means the kbagent is too old: update it, stop. A non-master
token cannot write policies (grants and organization scope need an organization admin).
Author with `groups` / `subjects` only; kbagent refuses `principal` / `principals`.

## 2. Target and interview

Where to enforce: a data app (`data-app list`), the MCP workspace, another governed workspace. For an app
run `references/data-app-discovery.md` (reuse one `config detail`). Then run the interview. Write one
rules file per table into `$SCRATCH` (`rls_<bucket>_<table>.json`, `cls_<bucket>_<table>.json`), never in
the user's repository.

## 3. Dry-run and summary

Run the dry-runs of independent tables in parallel (up to four), same commands as the apply:

```bash
kbagent --json rls create --project $P --table-id in.c-bucket.table --rules @FILE [--default JSON] --dry-run
kbagent --json cls create --project $P --table-id in.c-bucket.table --rules @FILE --dry-run
```

Print one table: table | kind | selector -> condition or columns | default | create, or update when
`$SCRATCH/rls.json` already has a policy for that table. List tables the app reads that have no policy.
Ask for "go". Apply nothing without it.

## 4. Apply

On "go", per table `rls create|update`, then `cls create|update` (never delete + create: the UUID would
change); independent tables may run in parallel. Collect the policy UUIDs from the results. On the first
failure stop and report what was written (rerunning is idempotent).

## 5. Bind

- **Data app:** write the complete list of RLS UUIDs to `runtime.workspace.rlsPolicies` as described in
  "Writing the binding" of `data-app-discovery.md`, redeploy only after the user agrees. CLS: say it is not
  applied to the app yet and keep the ids.
- **Governed workspace (MCP, kbagent):** `kbagent rls bind --project $P --workspace-id WS --rls-policy ID
  --cls-policy ID --stack-id STACK --dry-run`, then without `--dry-run`. Confirm the stack id with the user:
  a wrong one writes a binding nothing reads.

## 6. Close-out

Compute the coverage gap from `$SCRATCH/tables.json` and the policies now present (re-read only
`rls list` and `storage tables`), including any bucket or table created earlier in this conversation, and
offer policies for them. Give the manual check: sign in to the app as a user of each group (or
`kbagent workspace query` for a governed workspace) and compare with the summary table.
