# rls-toolkit Plugin

Row- and column-level security for Keboola: set up `rls-policy` / `cls-policy` objects in bulk for
the tables a data app reads, per IdP group, and bind them to the app. Query Service enforces them on
governed workspaces (data apps with RLS on, the Keboola MCP server's workspace, `kbagent workspace
create --governed`).

## Installation

```bash
/plugin install rls-toolkit
```

Install the `kbagent` plugin as well: all reads and writes go through `kbagent rls` / `cls`.

## Commands

| Command | Description |
|---|---|
| `/rls-show` | Read-only overview: policies, bindings, governed workspaces, data apps with RLS, tables no policy covers |
| `/rls-build` | Guided setup: find what an app reads, ask who sees what, generate policies in bulk, dry-run, apply on "go", bind to the app |

Everything else is conversational: the `rls-policies` skill auto-loads on "row-level security",
"hide columns per group", "governed workspace" and similar, and carries the policy model, the
interview and the gotchas.

## Requirements

- kbagent with the `rls` / `cls` command groups (`kbagent rls --help` must work)
- A project-admin Storage token for writes; an organization admin for grants and organization scope
- For a data app: Storage access on, every path behind SSO (oidc, gitlab, github, jumpcloud)

## What it does and does not do

- Asks the questions a setup needs: where it is enforced, which IdP and groups, which tables, rows
  and/or columns, defaults, administrators, scope. It reads the app configuration to find the
  providers and the candidate tables, and proposes rules from column names and sampled values.
- Default deny is taught everywhere: with RLS on an app every table it reads needs an rls-policy.
- Binds to a data app by writing the policy UUIDs to `runtime.workspace.rlsPolicies`; the app must
  be redeployed for a changed list. CLS cannot be bound to a data app yet.
- Cannot list the groups of an identity provider (Keboola does not manage membership): it asks.
- Never writes before a dry-run summary and an explicit "go".

## Versioning

Current version: **1.0.0** — first release: `rls-policies` skill, `/rls-show`, `/rls-build`.
