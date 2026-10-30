# Data app: what to read, what to write

Component `keboola.data-apps`. Read with
`kbagent --json config detail --project P --component-id keboola.data-apps --config-id ID` (full
configuration; read it once and reuse it) and `kbagent --json data-app detail --project P --app-id ID`.
Facts marked (?) are not verified against the platform docs: confirm with a test sign-in.

## Preconditions

| Check | Where | If not |
|---|---|---|
| App can use the user token | the app forwards `X-Kbc-App-User-Token`, per-user caches; supported app types: see the "Row-level security" section of the `dataapp-development` skill (`references/storage-access.md`) | binding policies to an app that does not forward the token makes it read nothing; tell the user |
| Storage access on | `runtime.workspace.enabled: true` | RLS has nothing to govern; offer to enable it |
| Every path requires SSO | `authorization.app_proxy.auth_rules[]`: `auth_required: true`, `auth[]` lists providers; providers in `auth_providers[]`, type oidc, gitlab, github or jumpcloud (provider list: `authentication.md` of `dataapp-development`) | the platform answers HTTP 400 at deployment (?): password providers, public paths, a rule without a provider |
| Project feature | `data-apps-storage-workspace` | ask support or an admin |

Show what you found. Never change an app's authentication silently.

## Identity provider and groups

- apps-proxy forwards a signed token with `sub`, `idp` (issuer), `groups` when the IdP sends them,
  and `email` only when verified (?). Keboola cannot list an IdP's groups: ask the user for the exact
  strings, case-sensitive. Entra ID sends group object ids unless the tenant is set up for names (?).
- GitLab `groups` and `allowedRoles` only gate login; they are not policy rules.
- GitHub: no groups, no email; `sub` is the login, which can change hands. Use `["*"]` or a few named
  `subjects` and say so.
- Administrators read as `keboola|<user id>` (member id: `kbagent project member-list`, Manage
  token). Decide with the user whether they get a rule.

## Which tables does the app read

Reads are not declared anywhere (the app runs SQL through Query Service). Build a candidate list and
have the user confirm it: `storage.input.tables[].source` and `storage.output.tables[].destination`
of the config; table ids and `FROM "<bucket id>"."<table>"` found in the app source
(`parameters.dataApp.git`) when it is reachable; and the user ("does it read anything else?").
Aliases and linked buckets: test before promising coverage.

## Writing the binding

`--merge` deep-merges objects only: a list REPLACES the existing list (kbagent `deep_merge`). So read
the current UUIDs from the config you already have, add or remove, and write the COMPLETE list:

```bash
printf '{"runtime":{"workspace":{"rlsPolicies":%s}}}' '["UUID-1","UUID-2"]' > "$SCRATCH/bind.json"
kbagent --json config update --project P --component-id keboola.data-apps --config-id ID \
  --configuration @"$SCRATCH/bind.json" --merge --dry-run
```

Rerun without `--dry-run` after the user agrees and read the config back once to verify. The list is
1-100 unique UUIDs; `[]` is refused. To switch RLS off, remove the key: kbagent has no unset, so ask
the user to use the Row-level security box of the app's Advanced settings in the UI, or (only after
saving `config detail` to scratch, showing a `--dry-run` diff and getting an explicit yes) write the
configuration back without the key and without `--merge`, which replaces the whole configuration.
A changed list takes effect on the next deployment. `kbagent data-app deploy` restarts the app and
its users lose their session: ask before running it.

## Column-level policies for a data app (pending)

A cls-policy cannot be bound to a data app: no configuration key exists for it, so the app reads
every column of a table an rls-policy opens. The keboola-operator is adding `clsPolicies` next to
`rlsPolicies` on the workspace (it requires `rlsPolicies`, is immutable, Sandbox only) and
sandboxes-service must copy it from the app configuration. Until a data-apps documentation page or a
successful deployment confirms the key, do not write any key for it. Create cls-policies only when
the user also uses a governed MCP/kbagent workspace (`kbagent rls bind --cls-policy`), and say
plainly that the app does not apply them.

## Backends

Confirm the project backend (`kbagent --json project info`) before offering governed workspaces on
BigQuery, and tell the user when the stack does not support it yet.
