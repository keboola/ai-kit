---
name: rls-policies
description: >-
  Row-level and column-level security (RLS / CLS) reference for Keboola. Auto-loads when the user
  mentions: row-level security, column-level security, RLS, CLS, rls-policy, cls-policy,
  policy-binding, governed workspace, restrict rows per user or group, hide columns, data app
  per-user data, who can see which rows, protect tables of a data app, OIDC groups for data
  access, rlsPolicies. Provides the policy model, the interview to set policies up for a data
  app, the kbagent commands and the operational gotchas.
---

# RLS / CLS — Reference

Policies are metastore objects authored with `kbagent` (`rls` / `cls` command groups, from the
`kbagent` plugin: the `rls-workflow` reference of the kbagent skill has every flag). Enforcement is Query Service on a
**governed workspace**: a data app with RLS switched on, the Keboola MCP server's workspace, or a
workspace created with `kbagent workspace create --governed`. This plugin adds what kbagent does
not have: the interview, the discovery of what a data app reads, bulk generation and the binding
to the app.

Use the commands for structured work: `/rls-show` (read-only overview) · `/rls-build` (guided
setup, explicit invocation only). Everything else is conversational with this skill.

## Working Directory Context

No script of this plugin depends on the working directory. Generated rule files go to a scratch
directory (`mktemp -d`), never into the user's repository. kbagent commands run from anywhere.

## Prerequisites

- The `kbagent` plugin installed and a kbagent release that has `kbagent rls`
  (`kbagent rls --help` succeeds). If not: `kbagent update`, otherwise stop and say so.
- A project-admin (master) Storage token for writes. Organization scope and grants to other
  projects need an organization admin (the metastore answers 403 otherwise).
- Project feature `row-level-security` for the MCP workspace to be governed (a data app does not
  need it; the data-app route needs `data-apps-storage-workspace` and Storage access).

## The model in one screen

| Object | One per | Holds |
|---|---|---|
| `rls-policy` | table | `rules[]`, each `{groups|subjects, condition}`, optional `default` condition |
| `cls-policy` | table | `rules[]`, each `{groups|subjects, visible_columns[]}` |
| `policy-binding` | governed workspace | UUID lists of the policies that workspace gets |

Details, the condition grammar and examples: `references/policy-model.md`.

Rules that decide every conversation:

1. **Default deny.** On a governed workspace a table without an rls-policy gives the reader
   nothing (an administrator is refused, an ordinary reader gets an empty result). A cls-policy
   alone grants nothing. So with RLS on an app, EVERY table the app reads needs an rls-policy.
2. **Selectors.** A rule selects readers by IdP `groups` or by `subjects` (`<idp>|<sub>`), exactly
   one of the two per rule; `["*"]` is every signed-in reader. An email is not a selector in a
   new policy. Group rules and `["*"]` are the practical choice for apps.
3. **Unknown groups never match.** A user whose token carries no `groups` claim matches only `*`
   rules (then the `default`). Always write a `default` (`{"false":true}` = no rows); without
   one the reader is refused with an error.
4. **Rules combine.** Matching rules of one policy OR together (CLS columns unite). Several
   policies on one table AND together (CLS intersect): an extra policy only narrows.
5. **Administrators are not exempt.** An administrator behind a Storage token is
   `keboola|<user id>`; give admins an explicit rule if they should read.
6. **Table key** is the Storage id `<stage>.<bucket>.<table>` (`in.c-crm.orders`) on every
   backend; matching is exact and case-sensitive. One policy per table and kind.
7. **A bound policy cannot be deleted** until it is unbound (409).
8. **Policy list is fixed per workspace.** A data app gets a new workspace per deployment; a
   changed `rlsPolicies` list needs a redeploy or restart. Edits of a policy's content apply to
   the next query (policies are cached about a minute).

## Data apps

Data-app route: policies are bound by listing their UUIDs in the app configuration
(`runtime.workspace.rlsPolicies`); the operator turns that into the workspace binding. You do not
write a binding for an app. CLS is not bindable to an app yet (operator and sandboxes-service
work pending; `references/data-app-discovery.md` has the section). Config paths, SSO preconditions,
provider facts and how to find the tables an app reads: `references/data-app-discovery.md`.

## Interview

`references/interview.md` is the question script (target, providers and groups, tables, rows,
columns, defaults, admin, scope, summary, "go"). Ask with AskUserQuestion, one decision per
question, and show what discovery already found instead of asking for it.

## Commands used

```bash
kbagent --json rls schema|list|detail --project P            # read; schema = live grammar + version
kbagent --json rls create|update --project P --table-id T --rules @FILE [--default JSON] [--dry-run]
kbagent --json cls create|update --project P --table-id T --rules @FILE [--dry-run]
kbagent --json rls delete|cls delete --project P --policy-id ID [--dry-run]
kbagent --json rls bind|unbind|bindings --project P [--workspace-id WS --rls-policy ID --stack-id S]
kbagent --json config detail|update --project P --component-id keboola.data-apps --config-id ID
kbagent --json data-app list|detail|deploy --project P [--app-id ID]
kbagent --json storage tables|table-detail --project P
```

Always `--dry-run` a write first. Use `update`, never delete+create (a new UUID would break
bindings and app configs). Without kbagent (for example inside another agent) the same JSON
payloads go to the Metastore REST API: `POST /api/v1/repository/{rls-policy|cls-policy}` with
`{name: <table id>, branch: "main", scope, schemaVersion, data}` and header `X-StorageApi-Token`;
read `GET /api/v1/schema/rls-policy` first for the version in force.

## Gotchas

`references/gotchas.md` — read before the first write.
