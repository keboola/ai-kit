# Gotchas (data-app side; the kbagent side is in the `rls-workflow` reference of the kbagent skill)

| Symptom | Cause | Fix |
|---|---|---|
| App users get "Row-level security does not allow this query" | policy side: table without an rls-policy, no matching rule and no `default`, or a cls-policy that does not name the reader. App side (token not forwarded, background job): see "Row-level security" in `dataapp-development` `references/storage-access.md` | add the policy, a rule for the group, or a `default`; fix the app |
| An admin sees no data | admins are not exempt; they read as `keboola|<user id>` | add a rule for that subject or a group |
| Group rules never match | the token carries no `groups` (IdP does not send it, tenant not set up, header too long), or strings differ in case, or are ids | ask for the exact strings; `*` rules still match |
| Policy exists, app unfiltered or refused | the app config does not list its UUID, or the app was not redeployed | check `runtime.workspace.rlsPolicies`, redeploy |
| Earlier policies of the app vanished | `config update --merge` replaces a list: only the new UUID was sent | write the complete list |
| `rlsPolicies: []` is refused | the platform refuses an empty list | remove the key (see `data-app-discovery.md`) |
| Deployment fails with HTTP 400 | a path with `auth_required: false`, a password provider, or a rule without a provider (?) | all paths need SSO |
| 409 deleting a policy | it is listed in a binding | unbind, or remove the UUID from the app config |
| A cls-policy does nothing for an app | no configuration key binds cls-policies to an app yet | say so |
| A table created later is unreadable | new tables have no policy: default deny | offer a policy at the end of the conversation |
