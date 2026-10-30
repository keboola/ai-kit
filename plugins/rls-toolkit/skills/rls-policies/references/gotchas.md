# Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| App users see "Row-level security does not allow this query" | table without an rls-policy, no matching rule and no `default`, or a cls-policy that does not name the reader | add the policy, a rule for the reader's group, or a `default` |
| An admin sees no data | admins are not exempt; they read as `keboola|<user id>` | add a rule for that subject or a group |
| Group rules never match | the token carries no `groups` claim (IdP does not send it, tenant not configured, header over 4096 bytes), or the strings differ in case or are ids | ask the user for the exact strings; `*` rules still match |
| Policy exists, app still unfiltered or refused | the app config does not list its UUID, or the app was not redeployed after the list changed | check `runtime.workspace.rlsPolicies`, redeploy |
| `rlsPolicies: []` is refused | the platform refuses an empty list | remove the key to switch RLS off |
| Deployment fails with HTTP 400 | a path with `auth_required: false`, a password provider, or a rule without a provider | all paths need SSO of type oidc, gitlab, github or jumpcloud |
| 409 deleting a policy | it is listed in a binding | unbind first (`rls unbind`, or remove the UUID from the app config) |
| 409 creating a policy | a policy of that kind already exists for the table in the project (per the kbagent docs) | `rls update` it |
| `rls update` cannot drop `default` | the metastore partial update cannot delete a key | recreate the policy |
| `principal` / `principals` refused | email is not a selector in schema 1.2.0 | use `groups` or `subjects` |
| Schema looks like 1.1.0 | the stack's metastore is older | `--dry-run` says so; wait for 1.2.0, do not author `principal` |
| `rls bind` writes but nothing changes | wrong `--stack-id` | confirm the stack id; check with a query as the bound identity |
| Binding disappears from view after workspace changes | the KID contains the workspace id; a new workspace has a new KID | bind again; `rls bindings-sweep` removes orphans |
| Policy ignored on a table reached through an alias or a linked bucket | matching is by the table's own Storage id | test it; do not promise coverage |
| Organization policy blocks another backend | an organization policy is loaded by every project on any backend | prefer `targeted` |
| A table the app creates later is unreadable | new tables have no policy: default deny | offer a policy at the end of the conversation |
