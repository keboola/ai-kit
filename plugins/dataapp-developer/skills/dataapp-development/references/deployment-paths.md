# Deployment Paths

**Use this when:** you need to pick the right tool for creating, deploying, or managing a Keboola App — depends on which client environment you're running in.

There are three deployment paths, distinguished by what the agent has access to: MCP tools only, MCP plus a local filesystem, or a CLI-driven flow without (or alongside) MCP. Pick the path that matches your client, then pick the tools within that path.

## Pick one path per session — don't mix

When more than one path is available — typical of Claude Code in a Keboola working directory — the agent may have multiple ways to talk to the same Keboola project, and they may point at **different branches or even different projects**. Mixing them within one session is a recipe for silent inconsistency: validating against branch X via MCP, then deploying via kbagent that's wired to branch Y, will produce confusing failures.

### Detect available paths at session start

Run **both** checks in order — don't stop after the first hit. Many agents will see MCP tools and forget kbagent is also there.

1. **kbagent CLI** — run `which kbagent` (Bash). If it returns a path, run `kbagent project list` and capture every alias + project ID + branch. Each alias is a separate candidate path.
2. **Any Keboola MCP** — scan the available tool surface for tools matching `mcp__*[Kk]eboola*` (typically `mcp__keboola-*` for project-local servers, `mcp__claude_ai_Keboola_*` for hosted ones). The config could come from project-local `.mcp.json`, user-level Claude settings, or an org-level marketplace install — all three surface tools the same way. Each distinct prefix is a separate candidate path. Don't condition detection on `.mcp.json` alone.
3. **Filesystem** — implicit by being able to `Write` / `Edit` files. Not a separate path on its own, but it enables kbagent and the local-iteration workflow.

### When more than one is present, ask the user — and list ALL of them

Before any project-mutating call, surface the choice. If kbagent and an MCP are both available, the question MUST include both. Don't silently drop kbagent because you found the MCP first.

When phrasing the question, present each path with its trade-offs honestly. Always offer kbagent when it's available — don't gatekeep — but make sure the user knows what each path costs them:

> I see both an MCP server (`keboola-test` → branch 35403) and kbagent (`new-branches` alias → project 3047, branch 37363) available, with filesystem access. Two viable paths:
>
> - **MCP-only**: compose source into `modify_data_app`, deploy via `deploy_data_app`, debug via platform logs. No CLI work on your machine, no local environment to manage.
> - **kbagent + local iteration**: edit `streamlit_app.py` locally, run with `streamlit run` against the workspace, deploy via `kbagent data-app deploy` when it works. Faster iteration loop for non-trivial apps — but you'll be filling in `.env.local`, running shell commands, and debugging CLI output. Expect to hit a few CLI gotchas along the way.
>
> Which would you like? Note: these paths may resolve to different branches or projects.

Let the user decide based on their own comfort with the CLI workflow. Don't pre-pick MCP "to be safe" — the user knows their own context better than the agent does. The job is to surface the trade-off, not to steer.

### Why kbagent + filesystem often beats MCP-only locally

The trade-off is not just "which works" — it's iteration speed.

| Path | Iteration loop | Best for |
|---|---|---|
| **MCP-only (Path A)** | Each edit → `modify_data_app` → `deploy_data_app` → wait for container spin-up → check logs via MCP → repeat | Small or quick apps where the first try is close. Demos. No filesystem assumed. |
| **kbagent + filesystem (Path B/C)** | Edit `streamlit_app.py` locally → `streamlit run` against real workspace creds in `.env.local` → verify in browser → only then `kbagent data-app deploy` or `git push` | Non-trivial apps. You catch SQL errors, missing columns, layout bugs locally where the loop is seconds. Only ship a working version. |

The MCP loop can be much slower for any app that needs more than one or two corrections — every cycle pays the platform's container spin-up cost (tens of seconds). The local-iterate-then-deploy loop runs at editor speed.

### Commit to the chosen path

Once the user picks, **don't use the others, not even for unrelated operations like data validation.** Mixed paths against potentially different branches lead to "the schema looked right when I checked but the deploy can't see the table" failure modes that are hard to diagnose. One tool surface per session.

## Path A — Claude Desktop / web (MCP-only to reach Keboola)

The defining constraint of this path is **the only channel to Keboola is MCP**. The agent may have a sandbox filesystem (Claude Desktop now does), a Python runner, a Bash tool — but none of those connect to your Keboola project. They run in the agent's local workspace, isolated. Anything that needs to reach Keboola — source code, deploy commands, log reads — has to go through an MCP tool call.

This matters most for the `modify_data_app` flow: the `source_code` argument **is** the deployment artifact. Writing the same code to the sandbox FS first and then re-emitting it as the tool argument doubles output tokens for no benefit. The sandbox FS is useful for scratchpad iteration (cheap `str_replace` edits before a single expensive emit) but the artifact lives in the tool call, not the file.

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

**Don't write the source to a local file first.** Even when the runtime gives you a sandbox filesystem (Claude Desktop does), the `source_code` argument is the source of truth — the platform stores it directly in the data-app configuration. Drafting to `/home/claude/streamlit_app.py` and then re-emitting it as the tool argument doubles your output tokens for no benefit. Compose the code directly into the `modify_data_app` call. If you want a review step before deploy, draft the code in your reply, get user confirmation, then make the tool call once.

The one legitimate exception: if the source is large enough that you genuinely need cheap iterative edits before a single expensive emit (e.g. via `str_replace` against a sandboxed file), use the local copy as a scratchpad — but only that, and only if the iteration savings beat the redundant emit. For small apps (<100 lines), compose-in-tool is always cheaper.

Local files only become deployment artifacts on Paths B and C (git push or kbagent). The "local development" instructions in [streamlit-apps.md](streamlit-apps.md) and [python-js-apps.md](python-js-apps.md) apply to those paths, not to Path A.

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

**Heads-up: this path expects CLI comfort.** Shell commands, local environment management, hand-edited `.env` files, debugging kbagent output — none individually hard, but they add up. If the user is happy with that workflow, this is the fastest iteration loop on offer. If they're not, Path A (MCP-only) is a lower-friction alternative — surface the trade-off when both are available and let them choose.

Full lifecycle via the `kbagent data-app` command group. Use this when:

- You're working in an agentic CLI environment without MCP (or in addition to MCP).
- You need fine-grained control over secrets, deployment versions, simpleAuth passwords.
- You want to validate the repo before burning a deploy cycle.
- You want the fast local-iteration loop (`streamlit run` against real workspace creds) and you can handle CLI errors when they happen.

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
| Claude Desktop / claude.ai (no filesystem or with sandbox) | Path A (MCP-only) — Streamlit only. Compose code in-tool; don't drift into "local dev" mode even when a sandbox FS is available. |
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
