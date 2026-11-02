# Data app: what to read, what to write

Component `keboola.data-apps`: read the app's configuration once and reuse it, plus the app detail.
Facts marked (?) are not verified against the platform docs: confirm with a test sign-in.

## Preconditions

| Check | Where | If not |
|---|---|---|
| App can use the user token | the app forwards `X-Kbc-App-User-Token`, per-user caches; supported app types: see the "Row-level security" section of the `dataapp-development` skill (`references/storage-access.md`) | Query Service refuses every query of an app that does not forward the token (HTTP 403 "Row-level security does not allow this query", logged as `ACCESS_DENIED`), so every user sees an error, not an empty page; tell the user |
| Storage access on | `runtime.workspace.enabled: true` | RLS has nothing to govern; offer to enable it |
| Every path requires SSO | `authorization.app_proxy.auth_rules[]`: `auth_required: true`, `auth[]` lists providers; providers in `auth_providers[]`, type oidc, gitlab, github or jumpcloud (provider list: `authentication.md` of `dataapp-development`) | the platform refuses the configuration with HTTP 400 on app update and on deployment when `rlsPolicies` is set and a path is public, has no provider, names an unknown provider or one of another type, or the app has no login rule at all |
| Project features | `row-level-security` (policies, the RLS switch in the app settings) and `data-apps-storage-workspace` (Storage access of the app) | ask support or an admin |

Show what you found. Never change an app's authentication silently.

## Identity provider and groups

- apps-proxy forwards a signed token with `sub`, `idp` (issuer), `groups` when the IdP sends them,
  and `email` only when verified (?). Keboola cannot list an IdP's groups: ask the user for the exact
  strings, case-sensitive. Entra ID sends group object ids unless the tenant is set up for names (?).
- GitLab `groups` and `allowedRoles` only gate login; they are not policy rules.
- GitHub: no groups, no email; `sub` is the login, which can change hands. Use `["*"]` or a few named
  `subjects` and say so.
- Administrators read as `keboola|<user id>` (the member id comes from the project members list).
  Decide with the user whether they get a rule.

## Which tables does the app read

Reads are not declared anywhere (the app runs SQL through Query Service). Build a candidate list and
have the user confirm it: `storage.input.tables[].source` and `storage.output.tables[].destination`
of the config; table ids and `FROM "<bucket id>"."<table>"` found in the app source
(`parameters.dataApp.git`) when it is reachable; and the user ("does it read anything else?").
Aliases and linked buckets: test before promising coverage.

## The binding list

`runtime.workspace.rlsPolicies` is a list of 1-100 unique policy UUIDs; `[]` is refused. Only the
listed policies apply to the app, and an app without the key is not governed at all (RLS off, every
row readable). A write of
the key must carry the COMPLETE list: whatever merges the configuration may replace a list instead of
merging it, so read the current UUIDs, add or remove, and write them all. A changed list takes effect
on the next deployment, and a deployment restarts the app, so its users lose their session: ask
before deploying. To switch RLS off, remove the key: prefer the Row-level security box of the app's
Advanced settings in the UI over rewriting the whole configuration.

## Column-level policies for a data app (pending)

A cls-policy cannot be bound to a data app yet, so the app reads every column of a table an
rls-policy opens. Say so plainly, and check the release notes before writing any key for it.
