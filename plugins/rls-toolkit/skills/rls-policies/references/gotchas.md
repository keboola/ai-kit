# Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| An ordinary app user gets an empty result | a table without an rls-policy, no rule matching the reader and no `default`, or `{"$identity":"email"}` for a reader without a verified email | add the policy, a rule for the group, or a `default` |
| A reader (every user of an app) gets "Row-level security does not allow this query" | the app does not forward the user token (HTTP 403, logged as `ACCESS_DENIED`; see "Row-level security" in `dataapp-development` `references/storage-access.md`), or an administrator (not exempt) matches no rule, or a cls-policy does not name the reader (refuses everyone) | fix the app, add a rule for that subject or group, or name the reader in the cls-policy |
| An admin sees no data | admins are not exempt; they read as `keboola|<user id>` | add a rule for that subject or a group |
| Group rules never match | the token carries no `groups` (IdP does not send it, tenant not set up, header too long), or strings differ in case, or are ids | ask for the exact strings; `*` rules still match |
| A new policy has no effect on an app | only the policies listed in `runtime.workspace.rlsPolicies` apply to an app, and the list is read at deployment | add the UUID (the complete list), redeploy |
| App reads every row | the app has Storage access but no `rlsPolicies` key: it is not governed | add the key with the policies and redeploy |
| Earlier policies of the app vanished | the list was written with only the new UUID: a merge replaces a list | write the complete list |
| `rlsPolicies: []` is refused | the platform refuses an empty list | remove the key (see `data-app-discovery.md`) |
| Deployment or app update fails with HTTP 400 | `rlsPolicies` is set and a path is public (`auth_required: false`), has no provider, names an unknown provider or one of another type than oidc, gitlab, github, jumpcloud, or the app has no login rule | all paths need SSO |
| 409 deleting a policy | it is listed in a binding | unbind, or remove the UUID from the app config |
| A cls-policy does nothing for an app | no configuration key binds cls-policies to an app yet | say so |
| A table created later is unreadable | new tables have no policy: default deny | offer a policy at the end of the conversation |
| A reader sees the conditions of a policy | the query history and status of Query Service still return the rewritten SQL, with the rule conditions, values and group names (a fix is tracked as AJDA-3699) | keep nothing secret in rule values or group names |
| An added policy removed access | several policies on one table combine with AND (CLS: intersection), an added policy only narrows | check the other policies of the table |
| A numeric range drops rows | `gt`/`gte`/`lt`/`lte` on an untyped table compare text (`'10' < '2'`) | use `eq`/`in`, or ranges only on typed numeric or date columns |
