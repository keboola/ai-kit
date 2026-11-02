# rls-toolkit Plugin

Row- and column-level security for Keboola: set up `rls-policy` / `cls-policy` objects in bulk for
the tables a data app reads, per IdP group, and bind them to the app. Query Service enforces them on
governed workspaces (data apps with RLS on, the Keboola MCP server's workspace, `kbagent workspace
create --governed`).

## Installation

```bash
/plugin install rls-toolkit
```

Install the `kbagent` plugin as well: the commands read and write through `kbagent rls` / `cls`.

## Commands

| Command | Description |
|---|---|
| `/rls-show` | Read-only overview: policies, data apps with RLS on, tables no policy covers |
| `/rls-build` | Guided setup: find what an app reads, ask who sees what, generate policies in bulk, dry-run, apply on "go", bind to the app |

Everything else is conversational: the `rls-policies` skill auto-loads on "row-level security",
"hide columns per group", "governed workspace" and similar, and carries the policy model, the
interview and the gotchas. The skill names no tool, so a runtime with its own policy tools can use
it; the kbagent commands are in `skills/rls-policies/references/kbagent.md` and in the two commands.

## Requirements

- kbagent with the `rls` / `cls` command groups (`kbagent rls schema` is the probe). No kbagent release
  has them yet (keboola/cli PRs #778, #892, #922, #923); until one is released and pinned in this
  marketplace the commands stop at the probe. The kbagent plugin is an external marketplace entry
  pinned by its own release job; this plugin does not bump it.
- Project feature `row-level-security`; for a data app also `data-apps-storage-workspace`
- A project-admin Storage token for writes; an organization admin for grants and organization scope
- For a data app: Storage access on, every path behind SSO (oidc, gitlab, github, jumpcloud)

## What it does and does not do

- Asks what a setup needs (where it is enforced, which IdP and groups, which tables, rows and/or
  columns, defaults, administrators, scope), reads the app configuration for providers and candidate
  tables, and proposes rules from column names and sampled values.
- Binds to a data app by writing the policy UUIDs to `runtime.workspace.rlsPolicies` and, for column
  policies, `runtime.workspace.clsPolicies` (independent of each other); a changed list needs a redeploy.
- Cannot list the groups of an identity provider (Keboola does not manage membership): it asks.
- Never writes before a dry-run summary and an explicit "go".
- `kbagent rls setup` is kbagent's own terminal-only wizard (one simple comparison per selector); this
  plugin is the agent-driven path with data app discovery and binding.
- Rule values are escaped literals in the rewritten SQL, and the query history of Query Service still
  shows that SQL to the reader (a fix is tracked as AJDA-3699): keep nothing secret in rule values.
