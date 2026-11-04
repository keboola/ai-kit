# GitHub Organization Auth

**Use this when:** a data app's source lives in a private GitHub repo — the user's or their company's — and you are about to ask for a Personal Access Token (PAT) or an SSH key. Offer the organization connection first.

A data app config can read its repo through the Keboola organization's GitHub App connection instead of a stored credential:

```json
"parameters": {
  "dataApp": {
    "git": {
      "repository": "https://github.com/<org>/<repo>",
      "branch": "main",
      "authType": "organization",
      "private": true
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
- Side note: Custom Python and dbt use the same connection

## Prerequisites

Both are one-time, per Keboola organization, and done in this order. The agent can't do either of them. They need a person who is **both a Keboola organization admin and an owner of the GitHub organization**, so tell the user who that has to be:

1. **Install the Keboola GitHub App** on the GitHub organization, with access to the repo ("Install GitHub App").
2. **Connect the GitHub organization** to the Keboola organization ("Connect GitHub organization").

Both buttons are on the organization's GitHub tab: `https://connection.<stack>/control/organizations/<org-id>?tab=github`. Give the user that URL or the docs page (https://help.keboola.com/management/organization/#connect-github). Don't point them to a menu path: most customer admins don't see the link to that page in the menu.

**Confirm both before you create the app.** A missing connection, an App that doesn't cover the repo, or a host the stack has no GitHub App for is only detected when the app deploys, not when it is created. So ask the user, or their organization admin, whether the GitHub organization is connected and the App is installed. If they aren't sure and want to try anyway, what a failed try leaves behind depends on the path:

- **MCP:** `modify_python_js_data_app` has already created the app when `deploy_data_app` fails. Tell the user first that a failed try leaves an app they'll have to delete or switch to another auth.
- **kbagent:** `data-app create --wait` deletes the new app when its first deploy fails, unless you pass `--keep-on-failure`. A failed try leaves nothing to clean up.

## Limits

| Limit | Consequence |
|---|---|
| `https://` URL only | `git@github.com:org/repo.git` is refused. Use `https://github.com/org/repo` |
| github.com or a GitHub Enterprise host the stack is configured for | The MCP accepts only `github.com` and `*.ghe.com`. A GHE Server host on its own domain works through kbagent, not the MCP. GitLab, Bitbucket and other hosts still need a PAT or SSH key. The stack checks the host at deploy time |
| Read-only | The platform clones; it never pushes. Code reaches the repo through the user's own GitHub access, never through a token in the chat |
| No dev mode yet | No `deploy_data_app(mode='dev')`, no preview link, no drafts. Deploy in prod mode |
| No managed repo | `create_python_js_data_app_git_credential` has nothing to mint for this app |
| Not for an app on a Keboola-managed repo | The managed repo is fixed when the app is created. That app can't be switched to org auth (see below) |
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

The same call with the app's `configuration_id` rebinds an existing prod app, but **only an app that is already on an external repo** (bound with a PAT or SSH key). Check first: rebind only when `get_data_apps` shows the app with `is_managed_git_repo: false`. Its stored credentials are dropped.

**An app on a Keboola-managed repo can't be rebound** (`is_managed_git_repo: true`, or not reported). That covers every app created from the Keboola Apps page or by Kai. The MCP and kbagent both refuse it. You have two options:

- **Stay on the managed repo.** Push the code from GitHub into it (the `keboola-git` skill). That keeps drafts and previews.
- **Create a new app on the GitHub repo**, but only after the user agrees to it. Say in your reply why: the existing app's managed repo can't be swapped for an external one. Also say that this makes a second app next to the managed one, and that the managed app stays until they delete it.

The "resolve before you create" rules in [python-js-prod-and-drafts.md](python-js-prod-and-drafts.md) still apply. This is the one case where a create can be the right answer when an app already exists, and it needs the user's yes.

**kbagent:**

```bash
kbagent data-app create --project P --name "Revenue Dashboard" --slug revenue-dashboard \
  --git-repo https://github.com/acme/revenue-dashboard --git-auth organization --git-branch main \
  --type python-js --wait
```

`create` deploys the app as part of the call, so don't run a separate `data-app deploy` after it. `--slug` is required. `--git-auth organization` excludes `--git-public`, `--git-username`, the `--git-pat-*` flags and `--use-managed-git-repo`.

To switch an existing app on an external repo (PAT or SSH key) to org auth, use:

```bash
kbagent data-app git-auth-set --project P --app-id N --git-auth organization --dry-run   # inspect the write
kbagent data-app git-auth-set --project P --app-id N --git-auth organization
kbagent data-app deploy --project P --app-id N --wait
```

It sets `authType` and removes `username` / `#password` / `#sshKey` in one write. Unlike `create`, it never deploys, so the explicit deploy is needed. An app with an `ssh://` URL also needs `--git-repo https://github.com/<org>/<repo>`. It refuses an app on a Keboola-managed repo (see above). Don't switch with `kbagent config update --merge`: the merge can't delete keys, so the old credentials stay next to `authType`, and the deploy fails.

`kbagent data-app validate-repo` never uses the organization connection. To validate an org-auth repo with it, use a PAT that can read the repo, or check the layout from a local clone.

**Streamlit:** `modify_streamlit_data_app` has no git mode, so the MCP path can't set up org auth for a Streamlit app. Use kbagent with `--type streamlit` in place of `--type python-js`. Everything else in the create snippet stays the same.

## Changing the code of an org-auth app

There is no draft and no preview for an org-auth app yet, so the draft flow in [python-js-prod-and-drafts.md](python-js-prod-and-drafts.md) does not apply to it:

1. Validate and run the change locally ([dev-workflow.md](dev-workflow.md)).
2. Push it to the GitHub repo on the branch the app serves (or open a PR there and let the user merge it), with git access that is already set up locally.
   **No local git access** (a hosted sandbox such as Kai, or no GitHub credentials configured)? Then don't ask for a token: no plaintext credential may enter the chat or the sandbox. Describe the change, or hand over the changed files, and let the user push it. Redeploy once they say it's pushed.
3. Redeploy the prod app (`deploy_data_app(action="deploy", ...)` or `kbagent data-app deploy --wait`). The deploy locks the new commit.

Tell the user that the push goes live on the next deploy, with no preview in between.

## Errors and what to do

The **When** column says where each error shows up:

- **Create / rebind:** `modify_python_js_data_app`, `kbagent data-app create` or `git-auth-set`. These refuse the request before anything is written.
- **Deploy:** `deploy_data_app`, the deploy inside `kbagent data-app create --wait`, `deploy --wait`, or `kbagent data-app runs`.

| When | What the error says | What to tell the user |
|---|---|---|
| Deploy | No GitHub App is registered for the host (HTTP 412) | The stack has no GitHub App for this host. For a GHE host, the stack has to be configured for it first; until then use a PAT or the managed repo |
| Deploy | The organization is not connected, or the App is not installed on the GitHub account | A Keboola organization admin who owns the GitHub organization installs the Keboola GitHub App, then connects the GitHub organization, on `https://connection.<stack>/control/organizations/<org-id>?tab=github` (see Prerequisites) |
| Create / rebind | URL not `https://HOST/OWNER/REPO`, or (MCP only) a host other than `github.com` / `*.ghe.com`. kbagent doesn't check the host; a host the stack has no GitHub App for fails at deploy (row above) | Use the `https://github.com/<org>/<repo>` form. Other hosts need a PAT or SSH key |
| Create / rebind | Org auth combined with credentials | Remove `username` / `#password` / `#sshKey` (kbagent `data-app git-auth-set` does it in one write) |
| Create / rebind | Rebind or `git-auth-set` refused for a managed repo | Expected: an app on a Keboola-managed repo can't switch. Stay on the managed repo, or create a new app with the user's agreement |
| Deploy | `deploy_data_app(mode='dev')` refused | Expected: dev mode isn't supported for org auth yet. Deploy in prod mode |

## Side note: Custom Python and dbt use the same connection

The same organization connection serves private GitHub repos outside data apps. Custom Python (`kds-team.app-custom-python`) and dbt (`keboola.dbt-transformation`) use it when you set `authType: "organization"` in their git settings: dbt `parameters.git.authType`, and the `authType` field of Custom Python's git settings. In the UI it is shown as **Organization GitHub connection** / **Use the organization's GitHub App**. With the same prerequisites in place, they need no PAT either. Don't write `authorization.githubApp` into a configuration: the platform injects it at run time, and a value written there does nothing.
