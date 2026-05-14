# Deployment Paths

**Use this when:** you need to pick the right tool for creating, deploying, or managing a Keboola App — depends on which client environment you're running in.

There are three deployment paths, distinguished by what the agent has access to: MCP tools only, MCP plus a local filesystem, or a CLI-driven flow without (or alongside) MCP. Pick the path that matches your client, then pick the tools within that path.

## Path A — Claude Desktop / web (MCP-only, no filesystem)

This is the constrained path: you have Keboola MCP and nothing else. No local files, no git, no shell. Everything happens through MCP tool calls against the Keboola project.

Available tools:

- `modify_data_app` — creates or updates the source code IN the data app configuration (no separate git repo).
- `deploy_data_app(action="deploy", configuration_id=...)` — deploys or restarts the app.
- `deploy_data_app(action="stop", configuration_id=...)` — suspends.
- `get_data_apps([cfg_id])` — returns the latest 20 log lines for debugging.
- `query_data`, `get_table`, `get_project_info` — for validating data before writing code.

After `modify_data_app`, ALWAYS call `deploy_data_app(action="deploy")` — without this, changes do not take effect. The existing running app keeps serving the previous code.

For new apps, pass `configuration_id=""`. For updates, pass the existing configuration ID and a non-empty `change_description`.

**Authentication note:** new apps default to basic-auth. On UPDATE, pass `authentication_type="default"` to preserve the existing setup — `basic-auth` would silently downgrade an OIDC app.

**Limitations:** Streamlit type only. No Git deployment mode via MCP. No Python/JS type via MCP today (planned — see [python-js-apps.md](python-js-apps.md) "Deployment via MCP — PLACEHOLDER").

**Debug loop:** if the app fails to start or behaves wrong after deploy, call `get_data_apps(<cfg_id>)` for the latest 20 log lines, fix the `source_code`, call `modify_data_app` again with a `change_description`, then `deploy_data_app(action="deploy")`. Repeat. There is no way to attach to a shell or read arbitrary log files from this path.

Minimal example call signature (annotated, not executable):

```python
modify_data_app(
    name="My App",
    description="...",
    source_code="""
import streamlit as st
{QUERY_DATA_FUNCTION}  # required placeholder — MCP injects the query function
# ... your app code using query_data(sql)
""",
    packages=["pandas", "plotly"],
    authentication_type="basic-auth",  # or "no-auth" / "default" on update
    configuration_id="",  # empty for new app
    change_description="",
)

# Then:
deploy_data_app(action="deploy", configuration_id="<id-from-above>")
```

## Path B — Claude Code / local agent with filesystem + MCP

The most flexible path. Edit code locally with Read/Edit/Write tools. Use Playwright MCP for visual verification. Use Keboola MCP for storage validation.

For **Streamlit** apps:

- Code mode: edit local file, then push to git OR use `modify_data_app` to paste the contents into the data app config.
- Git mode: edit local file, `git push`, then `deploy_data_app` via MCP picks up the new commit.

For **Python/JS** apps:

- Must use git (no Code mode for this type). Edit locally, push to customer git, deploy. Today this means using `kbagent` (Path C) — MCP doesn't yet support Python/JS app deployment.

Best fit for:

- Iterating on existing apps with complex changes.
- Multi-file refactors.
- Apps with custom `keboola-config/` setup.
- Anything where visual verification matters (Playwright MCP).

**Typical loop:**

1. Validate data with `query_data` / `get_table` (MCP).
2. Edit code locally with Read/Edit/Write.
3. Push to git (Python/JS) or paste via `modify_data_app` (Streamlit Code mode).
4. `deploy_data_app(action="deploy", ...)` via MCP, or `kbagent data-app deploy --wait` if Path C.
5. Open the running app in Playwright MCP, take a screenshot, iterate.

## Path C — CLI agent (kbagent)

Full lifecycle via the `kbagent data-app` command group. Use this when:

- You're working in an agentic CLI environment without MCP (or in addition to MCP).
- You need fine-grained control over secrets, deployment versions, simpleAuth passwords.
- You want to validate the repo before burning a deploy cycle.

Commands:

| Goal                            | Command                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Inventory                       | `kbagent data-app list --project P`                                                                |
| Inspect                         | `kbagent data-app detail --project P --app-id N`                                                   |
| Pre-flight repo before create   | `kbagent data-app validate-repo --git-repo URL --type python-js`                                   |
| Create new app from git repo    | `kbagent data-app create ...`                                                                      |
| Redeploy latest code            | `kbagent data-app deploy --project P --app-id N --wait`                                            |
| Wake auto-suspended app         | `kbagent data-app start --app-id N`                                                                |
| Suspend                         | `kbagent data-app stop --app-id N`                                                                 |
| Read basic-auth password        | `kbagent data-app password --app-id N`                                                             |
| Set / rotate secrets            | `kbagent data-app secrets-set --app-id N --secret '#KEY=VAL'` then `data-app deploy --wait`        |
| List secrets (metadata only)    | `kbagent data-app secrets-list --app-id N`                                                         |
| Remove a secret                 | `kbagent data-app secrets-remove --app-id N --key '#KEY' --yes`                                    |
| Delete app                      | `kbagent data-app delete --app-id N`                                                               |

Typical create flow:

```bash
kbagent data-app validate-repo --git-repo URL --git-branch main --type python-js
kbagent data-app create --project P --git-repo URL --git-branch main --type python-js --name "My App"
kbagent data-app deploy --project P --app-id N --wait
kbagent data-app password --app-id N    # if basic-auth
```

**Best practices:**

- Run `kbagent data-app validate-repo --git-repo URL --git-branch BRANCH --type python-js` BEFORE `create`. It walks the repo via GitHub API and emits BLOCKING / WARN / OK per check (golden-rule structure, no `pip install` in setup.sh, port-match, etc.). Saves a full deploy cycle on a misconfigured repo.

- `--git-pat-env GITHUB_PAT_DATAAPP` is the preferred private-repo auth — the plaintext token never appears in argv:

  ```bash
  export GITHUB_PAT_DATAAPP=ghp_xxx
  kbagent data-app create --project P --git-repo URL --git-username myuser --git-pat-env GITHUB_PAT_DATAAPP ...
  ```

- For Storage config fields (size, auto-suspend, git block), use `kbagent config update` then `kbagent data-app deploy`:

  ```bash
  kbagent config update --component-id keboola.data-apps --config-id ID --set 'runtime.backend.size="medium"' --merge
  kbagent data-app deploy --project P --app-id N --wait
  ```

  The deployment record's `configVersion` does NOT auto-advance when Storage advances. You must redeploy to pick up the new config.

- Detailed gotchas (per-project KMS encryption, transient `state == stopped` during initial deploy, auto-injected `parameters.id`) live in the kbagent skill's `references/data-app-workflow.md`. Don't duplicate them here — link there if needed.

---

## How to choose

| Your client                                | Recommended path                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Claude Desktop / claude.ai (no filesystem) | Path A (MCP-only) — Streamlit only                                     |
| Claude Code or local IDE agent             | Path B (filesystem + MCP) for Streamlit; Path C (kbagent) for Python/JS |
| Agentic CLI without MCP                    | Path C (kbagent) for everything                                        |
| CI/CD pipeline                             | Path C (kbagent) — non-interactive, scriptable                         |

If both Path B and Path C are available, prefer Path B for one-off changes and Path C when you need batch operations, validate-repo, or non-interactive scripting.

**Decision shortcuts:**

- You can't write to a local filesystem -> Path A.
- You're building a Python or JS (non-Streamlit) app -> Path C (until MCP gains support).
- You want to iterate on a Streamlit dashboard with screenshots -> Path B.
- You're scripting deploys in CI -> Path C.
- You need to set or rotate secrets -> Path C.

See [streamlit-apps.md](streamlit-apps.md) and [python-js-apps.md](python-js-apps.md) for the per-type build details once you've picked a path.
