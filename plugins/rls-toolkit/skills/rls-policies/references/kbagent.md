# kbagent mapping

How the steps of this skill run with the `kbagent` CLI (the `rls` / `cls` command groups). Command
flags, the identity model and the combination rules live in the `rls-workflow` reference of the
`kbagent` skill; `kbagent --json rls schema|cls schema --project P` is the authoritative live grammar
and doubles as the feature probe: an old kbagent fails with "No such command", so say so and stop.
These command groups need a kbagent release that contains them.

One conversation id per run: generate it once (`uuidgen`, print it) and pass the same literal value
as `--conversation-id CONV` on every kbagent call, or set `KBAGENT_CONVERSATION_ID` in the harness env.
A new id per call correlates nothing, and an `export ...` in front of a command stops it matching a
`Bash(kbagent ...)` allow rule. The command examples below leave `--conversation-id CONV` out to stay
readable: add it to every one you run. The harness keeps no shell state either: create the scratch directory
once (`mktemp -d`), print its path and use that literal path (written `<SCRATCH>` below) in every
later call. Rule files and read results go there.

## Reads

| Need | Command |
|---|---|
| Is the token a master token | `kbagent --json project info --project P` (`is_master_token`) |
| Existing policies | `kbagent --json rls list --project P`, `kbagent --json cls list --project P`; one in full: `rls detail` / `cls detail` |
| Candidate tables | `kbagent --json storage tables --project P`, columns: `storage table-detail --table-id ID` |
| Data apps | `kbagent --json data-app list --project P`, `data-app detail --app-id ID` |
| App configuration | `kbagent --json config detail --project P --component-id keboola.data-apps --config-id ID` (read once, reuse) |
| Member id of an administrator | `kbagent project member-list` (needs a Manage token) |
| Sample values of a column | `kbagent workspace query` with a read query the user agrees to |

## Writes

Per table, one rules file in `<SCRATCH>` (`rls_<bucket>_<table>.json`, `cls_<bucket>_<table>.json`):

```bash
kbagent --json rls create --project P --table-id in.c-bucket.table --rules @FILE [--default JSON] --dry-run
kbagent --json cls create --project P --table-id in.c-bucket.table --rules @FILE --dry-run
kbagent --json rls update --project P --policy-id UUID --rules @FILE [--default JSON] --dry-run
kbagent --json cls update --project P --policy-id UUID --rules @FILE --dry-run
```

- `update` and `delete` need `--policy-id`: take it from `<SCRATCH>/rls.json` / `cls.json` (the `list`
  result). Never delete and create to change a policy: the UUID would change.
- `update` is a partial update; a `default` cannot be removed with it. `dialect` defaults to the
  project backend; kbagent refuses `principal` / `principals`.
- Rerunning a failed batch is idempotent. Stop at the first failure and report what was written.

## Binding

- **Data app:** write the complete list to `runtime.workspace.rlsPolicies`. `--merge` deep-merges
  objects only and a list REPLACES the existing list (kbagent `deep_merge`):

  ```bash
  printf '{"runtime":{"workspace":{"rlsPolicies":%s}}}' '["UUID-1","UUID-2"]' > <SCRATCH>/bind.json
  kbagent --json config update --project P --component-id keboola.data-apps --config-id ID \
    --configuration @<SCRATCH>/bind.json --merge --dry-run
  ```

  Rerun without `--dry-run` after the user agrees and read the config back once. kbagent has no
  unset: to switch RLS off ask the user to use the Row-level security box of the app's Advanced
  settings, or (only after saving `config detail` to scratch, showing a `--dry-run` diff and getting
  an explicit yes) write the configuration back without the key and without `--merge`, which replaces
  the whole configuration. `kbagent data-app deploy` restarts the app and its users lose their
  session: ask before running it.
- **Other governed workspace (MCP, kbagent):** `kbagent rls bind --project P --workspace-id WS
  --rls-policy ID --cls-policy ID --stack-id STACK --dry-run`, then without `--dry-run`. Confirm the
  stack id with the user: a wrong one writes a binding nothing reads.

`kbagent rls setup` is kbagent's own terminal-only wizard (one simple comparison per selector); the
commands of this plugin are the agent-driven path with data app discovery and binding.
