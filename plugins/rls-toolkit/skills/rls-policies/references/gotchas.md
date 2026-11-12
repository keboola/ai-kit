# Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| An ordinary app user gets an empty result | a table without any policy, no rule matching the reader and no `default`, or `{"$identity":"email"}` for a reader without a verified email. A table with only a cls-policy that names the reader returns ALL its rows, not none | add the policy, a rule for the group, or a `default`; add an rls-policy to limit the rows of a cls-policy-only table |
| A reader (every user of an app) gets "Row-level security does not allow this query" | the app does not forward the user token (HTTP 403, logged as `ACCESS_DENIED`; see "Row-level security" in `dataapp-development` `references/storage-access.md`), or an administrator (not exempt) matches no rule, or a cls-policy does not name the reader (refuses everyone) | fix the app, add a rule for that subject or group, or name the reader in the cls-policy |
| An admin sees no data | admins are not exempt; they read as `keboola|<user id>` | add a rule for that subject or a group |
| Group rules never match | the token carries no `groups` (IdP does not send it, tenant not set up, header too long), or strings differ in case, or are ids | ask for the exact strings; `*` rules still match |
| A new policy has no effect on an app | only the policies listed in `runtime.workspace.rlsPolicies` apply to an app, and the list is read at deployment | add the UUID (the complete list), redeploy |
| App reads every row | the app has Storage access but no `rlsPolicies` key: it is not governed | add the key with the policies and redeploy |
| Earlier policies of the app vanished | the list was written with only the new UUID: a merge replaces a list | write the complete list |
| `rlsPolicies: []` is refused | the platform refuses an empty list | remove the key (see `data-app-discovery.md`) |
| Deployment or app update fails with HTTP 400 | `rlsPolicies` is set and a path is public (`auth_required: false`), has no provider, names an unknown provider or one of another type than oidc, gitlab, github, jumpcloud, or the app has no login rule | all paths need SSO |
| 409 deleting a policy | it is listed in a binding | unbind, or remove the UUID from the app config |
| A cls-policy does nothing for an app | its UUID is not in `runtime.workspace.clsPolicies` (the rls list does not carry it), or the app was not redeployed | add it to `clsPolicies`, redeploy |
| A table created later is unreadable | new tables have no policy: default deny | offer a policy at the end of the conversation |
| An added policy removed access | several policies on one table combine with AND (CLS: intersection), an added policy only narrows | check the other policies of the table |
| A query is refused with the generic 403 although the table has a policy | the policy engine (v0.1.8 and later) refuses `IDENTIFIER()` / `TABLE()` outside `FROM`, `AI_*` / BigQuery `AI.*`, `TO_FILE`, `READ_*` file readers, `SECRET`, session-context functions (`CURRENT_USER`, `CURRENT_ROLE`, `CURRENT_STATEMENT`), `NEXTVAL`, `$x` / `@@x` variables, control characters, unquoted names with non-ASCII characters or `$$`, and a statement over 32 KiB, 200 CTEs or 300 table references | send one plain `SELECT` without them |
| A table is more open than its policies say | a binding is an allowlist: it keeps only the policies it lists, and a list that is absent (`clsPolicies` or `rlsPolicies`) contributes none, so a policy left out is not applied | list every policy that must apply |
| A numeric range drops rows | `gt`/`gte`/`lt`/`lte` on an untyped table compare text (`'10' < '2'`) | use `eq`/`in`, or ranges only on typed numeric or date columns |
