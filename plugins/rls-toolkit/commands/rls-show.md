---
name: rls-show
description: Show the row- and column-level security of a Keboola project — rls/cls policies, which tables they cover, and which data apps have RLS switched on. Read-only. Use when the user wants to see or audit existing RLS/CLS policies.
allowed-tools:
  - Bash
  - AskUserQuestion
argument-hint: "[project-alias] [--table in.c-bucket.table] [--app APP_ID]"
---

# Show RLS/CLS

Read-only: nothing here writes. Model, rules and gotchas: the `rls-policies` skill; the kbagent commands
in `skills/rls-policies/references/kbagent.md`.

## 0. Project, conversation id and scratch directory

Pick the project: the argument, the only registered alias, or ask (`kbagent --json project list`).
The harness keeps no shell state, so set up once and print both values: a conversation id (`uuidgen`) and
a scratch directory (`mktemp -d`). Write the literal values into every later command: `--conversation-id
ID` on each kbagent call and the scratch path (`<SCRATCH>` below).

## 1. Read everything once, in parallel

```bash
P=ALIAS
kbagent --conversation-id CONV --json rls list --project $P > <SCRATCH>/rls.json &
kbagent --conversation-id CONV --json cls list --project $P > <SCRATCH>/cls.json &
kbagent --conversation-id CONV --json data-app list --project $P > <SCRATCH>/apps.json &
kbagent --conversation-id CONV --json storage tables --project $P > <SCRATCH>/tables.json &
wait
```

If `rls list` fails with "No such command", the installed kbagent has no `rls` commands: tell the user to
update kbagent and stop. Then `kbagent --conversation-id CONV --json config detail --project $P --component-id
keboola.data-apps --config-id ID` once per app, only for apps with Storage access on (or only for `--app`).

## 2. Report

- **Policies:** one row per policy: table, kind, scope, selector kinds (`groups`/`subjects`), whether a
  `default` exists, schema version (flag `principal`/`principals` policies as legacy: they still
  enforce, but their rules cannot be edited). With `--table`, `rls detail` / `cls detail` in full.
- **Data apps:** per app `runtime.workspace.enabled` and `runtime.workspace.rlsPolicies` matched to the
  policies by id. An app with Storage access on and no `rlsPolicies` is not governed: RLS is off and it
  reads every row. A policy that no app lists does nothing for any app.
- **Coverage gaps:** Storage tables no rls-policy covers (default deny, see the skill). Offer
  `/rls-build` to close them. Create nothing here.
