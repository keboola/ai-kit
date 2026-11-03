# GitHub Organization Auth

**Use this when:** a data app's source lives in a private GitHub repo — the user's or their company's — and you are about to ask for a Personal Access Token (PAT) or an SSH key. Offer the organization connection first.

A data app config can read its repo through the Keboola organization's GitHub App connection instead of a stored credential:

```json
"parameters": {
  "dataApp": {
    "git": {
      "repository": "https://github.com/<org>/<repo>",
      "branch": "main",
      "authType": "organization"
    }
  }
}
```

At each deploy the platform mints a short-lived, read-only token from oauth-service through that connection. Nothing is stored in the configuration: no `username`, no `#password`, no `#sshKey`. Nobody has to create, paste or rotate a PAT.

## Contents
- Prerequisites
- Limits
- Create or switch an app (MCP, kbagent)
- Changing the code of an org-auth app
- Errors and what to do
- Custom Python and dbt use the same connection

## Prerequisites

Both are one-time, per Keboola organization. The agent can't do either of them, so tell the user who has to:

1. **An organization admin connects the GitHub organization** in Control UI → Organization → GitHub.
2. **The Keboola GitHub App is installed on that GitHub organization**, with access to the repo.

If the user isn't sure whether this was done, try it. The errors below say exactly which part is missing.

## Limits

| Limit | Consequence |
|---|---|
| `https://` URL only | `git@github.com:org/repo.git` is refused. Use `https://github.com/org/repo` |
| github.com, or a GitHub Enterprise host configured on the stack | GitLab, Bitbucket and other hosts still need a PAT or SSH key |
| Read-only | The platform clones; it never pushes. The user pushes code with their own git access |
| No dev mode yet | No `deploy_data_app(mode='dev')`, no preview link, no drafts. Deploy in prod mode |
| No managed repo | `create_python_js_data_app_git_credential` has nothing to mint for this app |
| Exclusive with credentials | A `git` block with `authType: organization` and a `username` / `#password` / `#sshKey` is rejected |

When one of these rules it out (GitLab repo, the user wants drafts and previews), fall back to the Keboola-managed repo (`keboola-git` skill) or to a PAT or SSH key.

## Create or switch an app

Pick the driver per [deployment-paths.md](deployment-paths.md) — don't mix.

**MCP** — `modify_python_js_data_app` with `git_repository` and `git_auth='organization'` creates a prod app on that repo, with no managed repo:

```python
modify_python_js_data_app(
    name="Revenue Dashboard",
    description="...",
    configuration_id="",           # CREATE a prod app; say so in your reply first
    git_repository="https://github.com/acme/revenue-dashboard",
    git_auth="organization",
    branch="main",                 # default
)
deploy_data_app(action="deploy", configuration_id="<id-from-above>")   # prod mode
```

The same call with the app's `configuration_id` rebinds an existing prod app to the repo. The "resolve before you create" rules in [python-js-prod-and-drafts.md](python-js-prod-and-drafts.md) still apply: never create a second app when one exists.

**kbagent:**

```bash
kbagent data-app create --project P --git-repo https://github.com/acme/revenue-dashboard \
  --git-auth organization --git-branch main --type python-js --name "Revenue Dashboard"
kbagent data-app deploy --project P --app-id N --wait
```

`--git-auth organization` excludes `--git-public`, `--git-username`, the `--git-pat-*` flags and `--use-managed-git-repo`.

To switch an existing PAT or SSH-key app to org auth, use:

```bash
kbagent data-app set-git-auth --project P --app-id N --git-auth organization
kbagent data-app deploy --project P --app-id N --wait
```

It sets `authType` and removes `username` / `#password` / `#sshKey` in one write. Don't do this with `kbagent config update --merge`: the merge leaves the old credentials in place, and the platform rejects them combined with `authType`.

`kbagent data-app validate-repo` does not use the organization connection. On a private repo it needs the user's own access, or check the repo layout from a local clone.

## Changing the code of an org-auth app

There is no draft and no preview for an org-auth app yet, so the draft flow in [python-js-prod-and-drafts.md](python-js-prod-and-drafts.md) does not apply to it:

1. Validate and run the change locally ([dev-workflow.md](dev-workflow.md)).
2. Push it to the GitHub repo with the user's own git access, on the branch the app serves (or open a PR there and let the user merge it).
3. Redeploy the prod app (`deploy_data_app(action="deploy", ...)` or `kbagent data-app deploy --wait`). The deploy locks the new commit.

Tell the user that the push goes live on the next deploy, with no preview in between.

## Errors and what to do

| What the error says | What to tell the user |
|---|---|
| No GitHub App is registered for the host (HTTP 412) | The stack has no GitHub App for this host. For a GHE host, the stack has to be configured for it first; until then use a PAT or the managed repo |
| The organization is not connected, or the App is not installed on the GitHub account | An organization admin connects the GitHub organization in Control UI → Organization → GitHub and installs the Keboola GitHub App on it |
| URL not https, or not a GitHub host | Use the `https://github.com/<org>/<repo>` form. Other hosts need a PAT or SSH key |
| Org auth combined with credentials | Remove `username` / `#password` / `#sshKey` (kbagent `data-app set-git-auth` does it in one write) |
| `deploy_data_app(mode='dev')` refused | Expected: dev mode isn't supported for org auth yet. Deploy in prod mode |

## Custom Python and dbt use the same connection

The same organization connection serves private GitHub repos outside data apps. Custom Python (`kds-team.app-custom-python`) and dbt (`keboola.dbt-transformation`) configurations authorize their repo through `authorization.githubApp`. With the same prerequisites in place, they need no PAT either. Mention this when the user is about to create a PAT for one of them.
