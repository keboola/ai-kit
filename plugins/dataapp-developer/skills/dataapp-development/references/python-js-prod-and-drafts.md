# Python/JS apps: the prod app and its drafts

**Use this when:** you are about to create, build into, or deploy a **Python/JS** Keboola App through the MCP data-app tools (directly, or via `kbagent --json tool call`).

Naming the right app in your reply is not the same as passing it in the call. Check the argument, not your intent.

## The invariant

`modify_python_js_data_app` is one tool with three behaviours, told apart by two arguments:

| `configuration_id` | `parent_configuration_id` | What happens |
|---|---|---|
| empty | not set | **Creates a prod app and a new managed git repo.** Almost never what you want |
| empty | a prod app's id | **Creates a draft** against that prod app's existing repo. No second repo |
| set | rejected | **Updates that app's metadata.** No repo, no source code |

An empty `configuration_id` is a create, whatever you concluded earlier in the session. So:

> **Never send an empty `configuration_id` without either `parent_configuration_id`, or a sentence in your reply saying you are creating a new app and why no existing one fits.**

The create is effectively irreversible: the managed repo can only be attached when the app is created, never afterwards. A stray prod app is a stray repo.

## The model: one prod app, its drafts

- The **prod** config owns the single Keboola-managed git repo (`https://git.<stack>/keboola/app-<data_app_id>.git`) and the `main` branch.
- A **draft** is a separate configuration with **no repo of its own**. Its `parameters.dataApp.git` block points at the prod app's repo, pinned to its own branch, with a freshly minted token. Drafts are how you iterate without touching what users see.
- `get_data_apps` on a prod app returns a `drafts: [...]` array.

Because a draft carries its own git block, the platform classifies it as an **external-git** app. That matters in one place only: `branch` on update (see the last section).

## Which app do I work on?

**Most sessions start with the prod app already existing.** The Keboola Apps page creates it, with the managed repo, and hands it to you. An app that is empty, still named "New App", never deployed, with `drafts: []`, is the **normal starting state**. Never replace one: the replacement cannot be given a managed repo.

1. **Your context names an app** — the page you were opened on, a configuration id in the request, an app named in the conversation. Use it. Do not call `get_data_apps` to confirm and do not ask the user.
2. **Nothing names one** — call `get_data_apps`. Exactly one Python/JS prod app means use it, however empty it looks.
3. **Several are plausible and none is named** — ask the user which one.
4. **The project has no Python/JS prod app at all** — only now do you create one.

An empty prod app and a fully built one take the same path from here.

## Building into an existing prod app

`PROD` is the prod app's `configuration_id`, `DRAFT` the draft's.

### 1. Name the app (optional, usually wanted)

The app the Apps page created is unnamed. Rename it on the prod config:

```python
modify_python_js_data_app(
    configuration_id=PROD,              # set -> UPDATE, never a create
    name="Recent Jobs",
    description="Dashboard of the last 100 jobs",
    change_description="Name the app",
)
```

### 2. Create the draft

```python
modify_python_js_data_app(
    name="Recent Jobs (draft)",
    description="...",
    configuration_id="",                # empty -> CREATE
    parent_configuration_id=PROD,       # ...and this is what makes it a draft, not a second app
    branch="add-recent-jobs",           # optional; defaults to a generated draft-<hex>
    authentication_type="basic-auth",   # never "no-auth" on a draft; the MCP rejects it
)
```

Returns the draft's `configuration_id` and a `git_clone_url` already carrying a token for the **prod app's** repo. That URL is what you push with, so you usually do not need step 3.

- `branch` must not be `main`. That one is the prod app's.
- Omit `branch` and you get a unique `draft-<hex>`, which cannot collide with a branch an earlier draft left behind. Pass a readable name when it helps the user read the repo.

### 3. Mint a fresh push credential (only if you need one)

Use this when the URL from step 2 has been lost or rotated, or when you are pushing to a prod app you did not just draft from:

```python
create_python_js_data_app_git_credential(configuration_id=PROD)
```

**Always against `PROD`.** Drafts own no repo, so minting against a draft is wrong.

Either way the URL carries a one-time secret: hold it in a shell variable, never commit, echo to a file, or log it.

### 4. Push the source to the draft branch

`$URL` below is the `git_clone_url` from step 2 (or step 3). Which command starts the branch depends on whether the repo has any commits yet.

**Fresh prod app from the Apps page, repo still empty, no `origin/main`:**

```bash
git clone "$URL" app && cd app
git checkout -b add-recent-jobs
# write the app source into ./ here (templates/nodejs-app/, keboola-config/, ...)
git add -A && git commit -m "Initial app"
git push origin add-recent-jobs
```

**Prod app that has been built before:**

```bash
git clone "$URL" app && cd app
git checkout -B add-recent-jobs --no-track origin/main
# edit the source here
git add -A && git commit -m "Add recent-jobs view"
git push origin add-recent-jobs
```

Branch off `origin/main` explicitly. A bare `git checkout <branch>` can land you on a stale branch an earlier draft left behind. An empty commit means nothing changes for the user, so confirm `git status` saw your files before pushing.

The pre-receive hook declines branch deletes, and pushes over ~15MB fail with HTTP 413. Both, plus the build-at-deploy recipe and the log signals that prove a deploy worked, are in the `keboola-git` skill.

### 5. Deploy the draft as a preview

```python
deploy_data_app(action="deploy", configuration_id=DRAFT, mode="dev")
```

`mode="dev"` deploys the draft as a development deployment so the user can see it without disturbing prod. This argument is not yet confirmed against a live stack (see [TODO.md](../TODO.md)); if the call rejects it, drop `mode` and deploy the draft plainly. If the preview does not load, the fix is never `authentication_type="no-auth"` — the in-platform preview authenticates on top of the draft's configured auth, and the MCP rejects `"no-auth"` on drafts anyway (see [authentication.md](authentication.md) §Python/JS). Hot reload off the branch is **not automatic**: it needs `keboola-config/supervisord-dev/<program>.conf` in the repo, and commit locking otherwise pins each deploy to a SHA. See [python-js-apps.md](python-js-apps.md) §Keboola-hosted dev mode and §Git commit locking. Without those configs, redeploy after each push.

### 6. Ship it

Merge the branch into `main`, push, then deploy prod:

```python
deploy_data_app(action="deploy", configuration_id=PROD)
```

## Creating a prod app (only when `get_data_apps` returns none)

```python
modify_python_js_data_app(
    name="Recent Jobs",
    description="...",
    configuration_id="",                # CREATE...
    # ...and no parent_configuration_id, so this is a PROD app with its own new repo.
    # Only correct when get_data_apps showed the project has no Python/JS app.
    # Say so in your reply before you send this.
)
```

Returns `configuration_id`, `data_app_id`, `repo_url`. Then go back to step 2 above: the app you just made is the prod app, and the work still happens on a draft.

`slug` is optional and derived from `name` when omitted. It is immutable after create, so pass one only when the URL matters to the user.

## Notes on the update path

`modify_python_js_data_app` with `configuration_id` set changes `name`, `description`, `authentication_type`, `auto_suspend_after_seconds`, `storage`, and `branch`. It never carries source code: for Python/JS apps **source only ever reaches the platform through git**, unlike the Streamlit `source_code` argument. `slug` and `parent_configuration_id` are rejected on update.

`branch` on update repoints an **external-git** app, which means a draft, or an app on a customer-provided repo. It is rejected for the prod app on a Keboola-managed repo, whose branch the platform owns. Redeploy afterwards to serve the new branch.

---

The invariant at the top of this file exists because of a measured failure: an agent opened on an empty prod app's page resolved that app correctly, said so in its reply, then called `modify_python_js_data_app` with an empty `configuration_id` and no `parent_configuration_id`. The project ended with two apps ([AJDA-3263](https://linear.app/keboola/issue/AJDA-3263/)).
