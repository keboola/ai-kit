---
name: rls-policies
description: >-
  Row-level and column-level security (RLS / CLS) for Keboola. Auto-loads when the user mentions:
  row-level security, column-level security, RLS, CLS, rls-policy, cls-policy, policy-binding,
  governed workspace, rlsPolicies, who can see which rows of a table, restrict rows per group,
  hide columns per group, OIDC groups for data access. Covers authoring and binding the policies
  (interview, discovery, kbagent commands, gotchas). Not for building the app's code
  (dataapp-development) and not for the semantic layer.
---

# RLS / CLS — Reference

Policies are metastore objects authored with `kbagent` (`rls` / `cls` command groups). All command
flags, the identity model and the rule grammar live in the `rls-workflow` reference of the `kbagent`
skill; `kbagent --json rls schema|cls schema --project P` is the authoritative live grammar and
doubles as the feature probe (an old kbagent fails with "No such command": say so and stop).
Enforcement is Query Service on a **governed workspace**: a data app with RLS on, the Keboola MCP
server's workspace, or a `kbagent workspace create --governed` workspace. This plugin owns what
kbagent does not have: the interview, the discovery of what a data app reads, bulk generation and
the binding to the app. `kbagent rls setup` (terminal only, one simple comparison per selector) is
the human alternative; this plugin is the agent-driven path. A runtime without kbagent maps the same
steps to its own tools; the policy JSON is identical.

Use `/rls-show` (read-only overview) and `/rls-build` (guided setup, explicit invocation only);
everything else is conversational.

## Working Directory Context

No script of this plugin depends on the working directory. Generated rule files go to a scratch
directory (`mktemp -d`), never into the user's repository. kbagent commands run from anywhere.

## Prerequisites

A project-admin (master) Storage token for writes; see `references/policy-model.md` for who may do
what. A data app additionally needs Storage access, SSO on every path and the project feature
`data-apps-storage-workspace`; the MCP workspace needs the project feature `row-level-security`.

## Rules that decide every conversation

1. **Default deny.** On a governed workspace a table without an rls-policy gives the reader nothing
   (an administrator is refused, an ordinary reader gets an empty result); a cls-policy alone grants
   nothing. With RLS on an app, EVERY table the app reads needs an rls-policy.
2. **Selectors.** Rules select readers by IdP `groups` or `subjects` (`<idp>|<sub>`), exactly one per
   rule; `["*"]` is every signed-in reader. Never an email. Groups and `*` are the practical choice
   for apps.
3. **Always write a `default`** (`{"false":true}` = no rows). Unknown groups never match a group
   rule; without a default such a reader is refused with an error.
4. **Administrators are not exempt**: they read as `keboola|<user id>`.
5. **The policy list is fixed per workspace.** A data app gets a new workspace per deployment, so a
   changed `rlsPolicies` list needs a redeploy. Edits of a policy's content apply to the next query
   (cached about a minute). A bound policy cannot be deleted until it is unbound.

## Data apps

Policies are bound to an app by listing their UUIDs in `runtime.workspace.rlsPolicies`; the operator
writes the workspace binding, so you never write one for an app. CLS is not bindable to an app yet.
Everything about the app side (preconditions, providers and groups, finding the tables, writing the
list) is in `references/data-app-discovery.md`.

## Interview

`references/interview.md` is the question script; `/rls-build` runs it and then applies. Show what
discovery found instead of asking for it.

## Gotchas

`references/gotchas.md`: read before the first write.
