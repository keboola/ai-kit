---
name: rls-show
description: Show the row- and column-level security of a Keboola project — rls/cls policies, which tables they cover, which workspaces are bound, and which data apps have RLS switched on. Read-only. Use when the user wants to see or audit existing RLS/CLS policies.
allowed-tools:
  - Bash
  - AskUserQuestion
argument-hint: "[project-alias] [--table in.c-bucket.table] [--app APP_ID]"
---

# Show RLS/CLS

Read-only. Nothing in this command writes. Command details: the `kbagent` plugin,
the `rls-workflow` reference of the kbagent skill; the data model: the `rls-policies` skill of this plugin.

## 1. Preconditions

Run `kbagent rls --help`. If it fails with "No such command", the installed kbagent is too old: tell
the user to update kbagent (`kbagent update`) and stop. Pick the project: the argument, the only
registered alias, or ask with `kbagent --json project list`.

## 2. Policies

```bash
kbagent --json rls list --project ALIAS
kbagent --json cls list --project ALIAS
```

Print one row per policy: table, kind (rls/cls), scope, selector kinds (`groups`/`subjects`),
whether a `default` exists, schema version (flag `principal`/`principals` policies as legacy: they
still enforce, but cannot be edited into new rules). With `--table`, show `rls detail` /
`cls detail` of the matching policies in full.

## 3. Bindings and workspaces

```bash
kbagent --json rls bindings --project ALIAS
kbagent --json workspace list --project ALIAS
```

Show governed workspaces (`login_type` governed), their bindings and any binding whose
`workspace_exists` is false (leftovers: `rls bindings-sweep` removes them, only on request).
A governed workspace without a binding gets every policy of the project.

## 4. Data apps

```bash
kbagent --json data-app list --project ALIAS
kbagent --json config detail --project ALIAS --component-id keboola.data-apps --config-id CONFIG_ID
```

For each app (or the one in `--app`) report `runtime.workspace.enabled` and
`runtime.workspace.rlsPolicies` (the policy UUIDs, matched to the policies above by id). An app with
Storage access on and no `rlsPolicies` reads with every policy of the project.

## 5. Coverage gaps

List Storage tables (`kbagent --json storage tables --project ALIAS`) that no rls-policy covers.
A governed reader gets nothing from them (an administrator is refused, an ordinary reader gets an
empty result). Report the gaps; offer `/rls-build` to close them. Do not create anything here.
