# Data app: what to read, what to write

Component `keboola.data-apps`. Read with
`kbagent --json config detail --project P --component-id keboola.data-apps --config-id ID` (full
configuration) and `kbagent --json data-app detail --project P --app-id ID`.

## Preconditions (RLS works only when all hold)

| Check | Config path | If not |
|---|---|---|
| Storage access on | `runtime.workspace.enabled: true` | RLS has nothing to govern; offer to enable it |
| Every path requires SSO | `authorization.app_proxy.auth_rules[]`: `auth_required: true`, `auth[]` lists providers | the platform answers HTTP 400 at deployment: password providers, public paths and a rule without a provider are refused |
| SSO provider type | `authorization.app_proxy.auth_providers[]`: `type` is `oidc`, `gitlab`, `github` or `jumpcloud` | fix the provider first |
| Project feature | `data-apps-storage-workspace` | ask support or an admin; do not work around it |

Show the user what you found. Never change the authentication of an app silently.

## Which identity provider, which groups

- The signed token apps-proxy forwards carries `sub`, `idp` (issuer), `groups` (when the IdP
  sends them), and `email` only when the IdP verified it.
- OIDC / JumpCloud: groups come from the groups claim of the IdP. Keboola cannot list them:
  ask the user for the exact strings, case-sensitive. Entra ID sends group object ids unless the
  tenant is configured to send names; the claim must also be enabled in the tenant. A token
  whose groups header is too long (over 4096 bytes) carries no groups.
- GitLab: the provider's `groups` setting only gates login; group membership is not a rule.
- GitHub: no groups, no email; `sub` is the login, which can change hands. Use `["*"]` rules or a
  few named `subjects`, and say so.
- `allowedRoles` and login-gating settings are NOT policy rules.
- Administrators of the project read as `keboola|<user id>` (member id from
  `kbagent project member-list`, needs a Manage token). Decide with the user whether they get a rule.

## Which tables does the app read

Reads are not declared anywhere (the app runs SQL through Query Service against its workspace).
Build a candidate list and have the user confirm it:

1. `storage.input.tables[].source` and `storage.output.tables[].destination` of the config.
2. The app source: `parameters.dataApp.git` (repository URL, branch). When it is reachable,
   search the code for table ids (`in.c-...`, `out.c-...`) and SQL `FROM "bucket"."table"`.
3. The user: "does the app read anything else?".

Table keys are Storage ids `<stage>.<bucket>.<table>`; SQL names a table `"<bucket id>"."<table>"`
(`"in.c-sales"."orders"`). Aliases and linked buckets: do not rely on policies for them without
testing.

## Writing the binding

Put the RLS policy UUIDs into the configuration (merge, so nothing else is touched):

```bash
printf '{"runtime":{"workspace":{"rlsPolicies":%s}}}' '["UUID-1","UUID-2"]' > "$SCRATCH/bind.json"
kbagent --json config update --project P --component-id keboola.data-apps --config-id ID \
  --configuration @"$SCRATCH/bind.json" --merge --dry-run
```

Re-run without `--dry-run` after the user agrees, then read the config back
(`config detail`) and check that `runtime.workspace.rlsPolicies` is exactly the list: a merge may
append to rather than replace an existing list. The list is 1-100 unique UUIDs. `[]` is refused:
to switch RLS off remove the key. A changed list takes effect only on the next deployment
(`kbagent data-app deploy`); ask before deploying.

There is no `clsPolicies` key in the app configuration yet, so a cls-policy cannot be bound to a
data app. Create cls-policies anyway only when the user also uses a governed workspace (MCP,
kbagent) and say what applies where.

## Backends

Governed workspaces exist on Snowflake and, once Connection's BigQuery support is in the stack,
on BigQuery. Confirm the project backend (`kbagent --json project info`) before offering it for
BigQuery and tell the user when the stack does not support it yet.
