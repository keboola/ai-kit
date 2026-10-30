---
name: rls-show
description: Show the row- and column-level security of a Keboola project — rls/cls policies, which tables they cover, which workspaces are bound, and which data apps have RLS switched on. Read-only. Use when the user wants to see or audit existing RLS/CLS policies.
allowed-tools:
  - Bash
  - AskUserQuestion
argument-hint: "[project-alias] [--table in.c-bucket.table] [--app APP_ID]"
---

# Show RLS/CLS

Read-only: nothing here writes. Model, rules and gotchas: the `rls-policies` skill; command flags: the
`rls-workflow` reference of the kbagent skill.

## 0. Project and conversation id

Pick the project: the argument, the only registered alias, or ask (`kbagent --json project list`).
Set `export KBAGENT_CONVERSATION_ID="$(uuidgen)"` in every Bash call (the harness does not keep shell
state), as `sl-build` does, and use `SCRATCH=$(mktemp -d)`.

## 1. Read everything once, in parallel

```bash
export KBAGENT_CONVERSATION_ID="$(uuidgen)"; P=ALIAS
kbagent --json rls list --project $P > $SCRATCH/rls.json &
kbagent --json cls list --project $P > $SCRATCH/cls.json &
kbagent --json rls bindings --project $P > $SCRATCH/bindings.json &
kbagent --json workspace list --project $P > $SCRATCH/workspaces.json &
kbagent --json data-app list --project $P > $SCRATCH/apps.json &
kbagent --json storage tables --project $P > $SCRATCH/tables.json &
wait
```

If `rls list` fails with "No such command", the installed kbagent is too old: tell the user to update
kbagent and stop. Then `kbagent --json config detail --project $P --component-id keboola.data-apps
--config-id ID` once per app, only for apps with Storage access on (or only for `--app`).

## 2. Report

- **Policies:** one row per policy: table, kind, scope, selector kinds (`groups`/`subjects`), whether a
  `default` exists, schema version (flag `principal`/`principals` policies as legacy: they still
  enforce, but their rules cannot be edited). With `--table`, `rls detail` / `cls detail` in full.
- **Workspaces and bindings:** governed workspaces (`login_type` governed) with their bindings, and
  bindings whose `workspace_exists` is false (leftovers; `rls bindings-sweep` removes them, only on
  request). A governed workspace without a binding gets every policy of the project.
- **Data apps:** per app `runtime.workspace.enabled` and `runtime.workspace.rlsPolicies` matched to the
  policies by id. An app with Storage access on and no `rlsPolicies` reads with every policy.
- **Coverage gaps:** Storage tables no rls-policy covers (default deny, see the skill). Offer
  `/rls-build` to close them. Create nothing here.
