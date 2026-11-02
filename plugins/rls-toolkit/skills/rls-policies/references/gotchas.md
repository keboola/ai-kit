# Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| An ordinary app user gets an empty result | policy side: a table without an rls-policy, no rule matching the reader and no `default`, or `{"$identity":"email"}` for a reader without a verified email. App side (token not forwarded, background job): see "Row-level security" in `dataapp-development` `references/storage-access.md` | add the policy, a rule for the group, or a `default`; fix the app |
| A reader gets "Row-level security does not allow this query" | an administrator (not exempt) on a table without a matching rule, or a cls-policy that does not name the reader (refuses everyone) | add a rule for that subject or group, or name the reader in the cls-policy |
| An admin sees no data | admins are not exempt; they read as `keboola|<user id>` | add a rule for that subject or a group |
| Group rules never match | the token carries no `groups` (IdP does not send it, tenant not set up, header too long), or strings differ in case, or are ids | ask for the exact strings; `*` rules still match |
| Policy exists, app unfiltered or refused | the app config does not list its UUID, or the app was not redeployed | check `runtime.workspace.rlsPolicies`, redeploy |
| Earlier policies of the app vanished | the list was written with only the new UUID: a merge replaces a list | write the complete list |
| `rlsPolicies: []` is refused | the platform refuses an empty list | remove the key (see `data-app-discovery.md`) |
| Deployment fails with HTTP 400 | a path with `auth_required: false`, a password provider, or a rule without a provider (?) | all paths need SSO |
| 409 deleting a policy | it is listed in a binding | unbind, or remove the UUID from the app config |
| A cls-policy does nothing for an app | no configuration key binds cls-policies to an app yet | say so |
| A table created later is unreadable | new tables have no policy: default deny | offer a policy at the end of the conversation |
| A reader sees the conditions of a policy | the query history and status of Query Service still return the rewritten SQL, with the rule conditions, values and group names (a fix is tracked as AJDA-3699) | keep nothing secret in rule values or group names |
| An added policy removed access | several policies on one table combine with AND (CLS: intersection), an added policy only narrows | check the other policies of the table |
