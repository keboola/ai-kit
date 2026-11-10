# Python/JS apps: the prod app and its drafts

**Use this when:** you are about to create, build into, or deploy a **Python/JS** Keboola App through the MCP data-app tools.

**kbagent has no draft command.** `kbagent data-app create` makes a prod app and `kbagent data-app deploy` deploys it. On Path C, say so before you change an app that has users, and ask: change the prod app directly, or use the Keboola MCP server to work on a draft.

Naming the right app in your reply is not the same as passing it in the call. Check the argument, not your intent.

## The invariant

`modify_python_js_data_app` has two behaviours, told apart by `configuration_id`:

| `configuration_id` | What happens |
|---|---|
| empty | **Creates a prod app and a new managed git repo.** Almost never what you want |
| set | **Updates that app's metadata and config.** No repo, no source code |

A draft is **not** made with this tool: `create_python_js_data_app_draft` makes one. The tool rejects `parent_configuration_id`.

An empty `configuration_id` is a create, whatever you concluded earlier in the session. So:

> **Never send an empty `configuration_id` without a sentence in your reply saying you are creating a new app and why no existing one fits.**

The create is effectively irreversible: the managed repo can only be attached when the app is created, never afterwards. A stray prod app is a stray repo.

## The model: one prod app, its drafts

- The **prod** config owns the single Keboola-managed git repo (`https://git.<stack>/keboola/app-<data_app_id>.git`) and the `main` branch.
- A **draft** belongs to the prod app. It is not a configuration of its own: it runs one branch of the prod app's repo on its own URL, apart from what users see.
- A draft starts in dev mode by itself. A push to its branch reaches it in about 5 seconds, with no deploy.
- A draft takes the prod app's **config** as a snapshot when it is created: Storage access, the `storage` mapping, authentication, image. A later change to the prod config does not reach a running draft; delete the draft and create it again on the same branch.
- A draft falls asleep after 15 minutes without requests and wakes on the next one. `run_state: stopped` is its normal resting state.
- Publishing does not remove a draft. You delete it yourself (§8).
- `get_data_apps(configuration_ids=[PROD])` returns the app's `drafts: [...]` (`draft_id`, `git_branch`, `url`, `run_state`, `created_at`). A draft has no name or description, so its **branch name is its label**: pick one that says what the change is (`add-recent-jobs`, not `draft-1`).
- The same call returns `legacy_drafts: [...]`: drafts from before, each a separate configuration. Never build on one; convert it (§Converting a legacy draft).

## Which app do I work on?

**Most sessions start with the prod app already existing.** The Keboola Apps page creates it, with the managed repo, and hands it to you. An app that is empty, still named "New App", never deployed, with no drafts, is the **normal starting state**. Never replace one: the replacement cannot be given a managed repo.

1. **Your context names an app** — the page you were opened on, a configuration id in the request, an app named in the conversation. Use it. Do not call `get_data_apps` to confirm and do not ask the user.
2. **Nothing names one** — call `get_data_apps`. Exactly one Python/JS prod app means use it, however empty it looks.
3. **Several are plausible and none is named** — ask the user which one.
4. **The project has no Python/JS prod app at all** — only now do you create one.

An empty prod app and a fully built one take the same path from here.

## Continue its draft, or start one?

A new draft every session strands the previous one: it stays on the app, keeps its branch, and boots cold. `get_data_apps(configuration_ids=[PROD])` lists its `drafts` and `legacy_drafts`. `drafts_unavailable: true` or `legacy_drafts_unavailable > 0` means the list is incomplete, not empty: call it again before you conclude there are none. Count drafts of both kinds, and take the first case that applies:

1. **The request names a draft** — continue that one.
2. **No drafts** — start one (steps 2–5 below).
3. **Exactly one** — continue it, unless the user asks for a separate change beside it.
4. **Several** — ask the user which to continue, or whether to start a new one, naming each by its `git_branch`.

A legacy draft is converted (§Converting a legacy draft) before you continue it.

To continue `DRAFT_ID`:

1. Its branch is the `git_branch` of its entry in `drafts`. Never derive it from the draft's URL: the hostname is not the branch.
2. `create_python_js_data_app_git_credential(configuration_id=PROD)` for a clone URL (step 3 below).
3. Check the branch out and merge `main` into it, so the draft builds on what is live. Resolve a conflict before going on:

   ```bash
   git clone "$URL" app && cd app
   git checkout <branch>
   git merge --no-edit origin/main
   git push origin <branch>
   ```

4. Edit, commit, and `git push origin <branch>`. The draft picks it up (step 6). Not the commands in step 4: they start a new branch off `main` and would drop the draft's commits. Reusing a clone you already have? Check it first: [existing-clone.md](existing-clone.md).

## Converting a legacy draft

A legacy draft is a configuration of its own, pinned to a branch of the prod app's repo. Its code lives on that branch, so a draft on the same branch carries on where it left off.

1. **Read it.** Its branch is the `git_branch` of its entry in `legacy_drafts` (`parameters.dataApp.git.branch` in its config). Mint a push credential on `PROD` for `$URL` (step 3 below), then check the branch is on the remote: `git ls-remote --heads "$URL" <branch>`. Without it, there is nothing to convert: tell the user and start a new draft.
2. **Compare its config with the prod app's.** The new draft takes the **prod** config, so anything set on the legacy draft alone is lost: Storage access, writable `storage` tables, secrets, authentication, image. Storage access the app needs can go onto the prod config (§2). For anything else, tell the user what changes and ask before you put it on prod.
3. **Prepare the branch, then create the draft on it.** Clone it and give it `keboola-config/supervisord-dev/` if it lacks one (step 4, the checklist at its end): a legacy draft's branch often predates it. Then `create_python_js_data_app_draft(configuration_id=PROD, git_branch=<branch>)` (step 5), and wait until it reports `run_state: running` in `get_data_apps(configuration_ids=[PROD])`.
4. **Delete the legacy draft** only when step 2 found nothing that is lost, or the user agreed to lose it: `delete_python_js_data_app_draft(configuration_id=<legacy draft's configuration_id>)`. It removes the legacy configuration and its running app, never the branch, and cannot be undone: secrets on it cannot be recovered. Otherwise keep it and work on the new draft; say the old one stays.
5. Tell the user in one line that the draft moved, and that its preview now has a new URL.

## Building into an existing prod app

`PROD` is the prod app's `configuration_id`, `DRAFT_ID` the draft's `draft_id`.

### 1. Name the app — your first write

The app the Apps page created is still "New App" at `new-app-<id>`. Name it on the prod config as soon as the request says what the app is for, before the draft and before any code:

- Until the first deploy the rename moves the slug too, so `new-app-<id>` follows the name. A deployed app, or one with a custom slug, keeps its slug.
- Skip it only when the app already has a real name.
- Keep the app's description if it has one; otherwise write one.

```python
modify_python_js_data_app(
    configuration_id=PROD,              # set -> UPDATE, never a create
    name="Recent Jobs",
    description="Dashboard of the last 100 jobs",
    change_description="Name the app",
)
```

### 2. Set the config on the prod app, before the draft

The draft copies the prod config when you create it, so config goes on `PROD`, first:

```python
modify_python_js_data_app(
    configuration_id=PROD,
    storage_access=True,              # when the app reads Storage
    storage={                         # when the app writes to Storage
        "output": {
            "tables": [
                {"destination": "out.c-data-app.records", "unload_strategy": "direct-grant"},
            ]
        }
    },
    change_description="Storage access + writable tables for the app",
)
```

- A changed prod config reaches users at the next prod deploy, not before. It reaches the draft only when the draft is created again.
- Need a config change once the draft runs? Change `PROD`, then `delete_python_js_data_app_draft(configuration_id=PROD, draft_id=DRAFT_ID)` and `create_python_js_data_app_draft` on the same branch. The code is on the branch; nothing is lost but the URL.
- `storage` **replaces** the whole block on update: send the complete mapping, not a delta.

### 3. Mint a push credential

```python
create_python_js_data_app_git_credential(configuration_id=PROD)
```

**Always against `PROD`.** It returns a `git_clone_url` carrying a one-time secret: hold it in a shell variable, never commit, echo to a file, or log it.

### 4. Push the source to the draft branch

The branch has to be on the remote **before** the draft is created: a draft never creates a branch. Which command starts it depends on whether the repo has any commits yet. A new app's repo starts with one initial commit on `main`, so after `git clone` check `git rev-parse --verify origin/main`: if it exists, use the second block, even for an app nobody has built yet.

**Older prod app whose repo is still empty, no `origin/main`:**

```bash
git clone "$URL" app && cd app
git checkout -b main
git commit --allow-empty -m "init main"
git push origin main                                       # main first: the first branch pushed becomes the default
git checkout -b add-recent-jobs
cp -R <dataapp-development>/templates/react-vite-app/. .   # the default stack, then your code on top
git add -A && git commit -m "Initial app"
git push origin add-recent-jobs
```

The empty `main` carries no app code, so it breaks no rule about pushing to `main`. Skip it and the draft branch becomes the repo's default: the repo then refuses to delete it after publishing (§8), and your token cannot change the default.

**Repo with an `origin/main` (a new app's repo, or an app built before):**

```bash
git clone "$URL" app && cd app
git checkout -B add-recent-jobs --no-track origin/main
# edit the source here
git add -A && git commit -m "Add recent-jobs view"
git push origin add-recent-jobs
```

Branch off `origin/main` explicitly. A bare `git checkout <branch>` can land you on a stale branch an earlier draft left behind. An empty commit means nothing changes for the user, so confirm `git status` saw your files before pushing. `main` is never a draft branch: it is the prod app's.

The branch needs `keboola-config/supervisord-dev/` before you create the draft: without it the draft never starts and stays `pending`. Every template ships it ([python-js-apps.md](python-js-apps.md) §Keboola-hosted dev mode), but an app built before, or outside a template, may not have it. Check the clone:

1. `keboola-config/supervisord-dev/` exists: nothing to do.
2. Only `keboola-config/supervisord/` exists: copy it to `supervisord-dev/`, give its programs hot reload (`uvicorn --reload`, `streamlit run --server.runOnSave=true`, Vite with polling), commit and push it before you create the draft: a running draft keeps the commands it started with. A plain copy starts the draft but serves no push until it is restarted. It reaches `main` when the draft is published.
3. Neither exists: write `supervisord-dev/` from the matching template.

Pushes over ~15MB fail with HTTP 413. That, the build-at-deploy recipe, and the log signals that prove a deploy worked are in the `keboola-git` skill.

### 5. Create the draft

```python
create_python_js_data_app_draft(configuration_id=PROD, git_branch="add-recent-jobs")
```

Returns `draft_id`, `url` and `run_state`. The tool waits for the `url`, a few seconds; the draft reports `run_state: running` 40–125 seconds after the create.

- **Never retry it blind.** Every call makes another running draft, even on the same branch. When the call fails or times out, `get_data_apps(configuration_ids=[PROD])` first: a draft on your branch already there is yours.
- "Branch does not exist": the push in step 4 did not happen or went to another name.
- `run_state` still `pending` after ~2 minutes: [troubleshooting.md](troubleshooting.md) §Draft stays `pending`.
- Never change `authentication_type` to get a draft to load: the preview link opens it whatever its auth ([authentication.md](authentication.md) §Python/JS).

### 6. Iterate and look at it

Push to the branch and the draft serves it in about 5 seconds: no deploy, no new draft. A `package.json` change re-installs. To see what it shows, open it in your own browser through `get_data_app_preview_link(configuration_id=PROD, draft_id=DRAFT_ID)`: [dev-workflow.md](dev-workflow.md) §Verify a draft.

### 7. Ship it

Ship only when the user asks to publish: the draft is how they review the change.

```bash
git fetch origin && git checkout -B main origin/main && git merge --no-edit origin/<branch> && git push origin main
```

Merge `origin/<branch>`, the commits the draft served, not your local branch: in a clone you reuse, the draft may have been pushed from elsewhere. The local `main` may be missing or behind too, hence `checkout -B main origin/main`. A merge conflict or a rejected push stops the chain: resolve it, and do not deploy or clean up (§8) until `origin/main` holds the branch head.

```python
deploy_data_app(action="deploy", configuration_id=PROD)
```

The prod config is the one the draft ran with (§2), unless it changed since the draft was created. When the app reads Storage, `storage_access` must be on `PROD`: without it prod fails at request time with `missing required env vars: WORKSPACE_ID`. Writable tables need the `storage` output mapping on `PROD`: without it the writes fail while reads keep working. Both look like code regressions and are not.

### 8. Confirm prod, then clean up

Otherwise the draft stays on the app as one more to choose from, still running. In order:

1. **Confirm prod is healthy** — `get_data_apps(configuration_ids=[PROD])` reports it running. If it does not, read the terminal log in that detail, fix, and redeploy. Until prod is green the draft is your fallback.
2. **Delete the draft** — `delete_python_js_data_app_draft(configuration_id=PROD, draft_id=DRAFT_ID)`. It stops the draft and never touches the branch.
3. **Delete the branch** — `git push origin --delete <branch>`, unless another entry in `drafts` or `legacy_drafts` still has that `git_branch`: then keep it. The repo refuses deleting only its default branch, which is `main` when step 4 pushed it first.

The push credential from step 3 stays valid. The MCP tools cannot revoke it: tell the user it can be revoked under the app's Git settings in Keboola if they want it gone.

## Creating a prod app (only when `get_data_apps` returns none)

```python
modify_python_js_data_app(
    name="Recent Jobs",
    description="...",
    configuration_id="",                # CREATE...
    # This is a PROD app with its own new repo.
    # Only correct when get_data_apps showed the project has no Python/JS app.
    # Say so in your reply before you send this.
)
```

Returns `configuration_id`, `data_app_id`, `repo_url`. Then go back to step 2 above: the app you just made is the prod app, and the work still happens on a draft.

`slug` is optional and derived from `name` when omitted, so pass one only when the URL matters to the user. An explicit slug is a DNS label: lowercase letters, digits and inner hyphens, at most 50 characters to fit the UI's URL-prefix limit (the tool accepts 63, the deploy does not).

## Notes on the update path

`modify_python_js_data_app` with `configuration_id` set changes `name`, `description`, `authentication_type`, `auto_suspend_after_seconds`, `storage`, `storage_access`, and `branch`. It never carries source code: for Python/JS apps **source only ever reaches the platform through git**, unlike the Streamlit `source_code` argument. `slug` on update:

1. **Omitted, prod app never deployed, slug still matches the old name** — the slug follows the new `name`.
2. **Omitted, anything else** (deployed, or a custom slug) — the slug stays.
3. **Passed** — accepted. Pass it only when the user asked for that URL. After the next deploy the app moves to the new URL and the old one stops working: tell the user both.

`branch` on update repoints an **external-git** app, an app on a customer-provided repo. It is rejected for the prod app on a Keboola-managed repo, whose branch the platform owns. Redeploy afterwards to serve the new branch.

## Apps on organization auth have no drafts yet

A prod app on the customer's GitHub repo with `git_auth="organization"` has no managed repo, so `create_python_js_data_app_git_credential` has nothing to mint, and dev mode, previews and drafts aren't supported for it yet. Don't create a draft for it. The change loop is: push to the app's branch, then redeploy prod. Without local git access (a hosted sandbox such as Kai), never ask for a GitHub token: describe the change, let the user push it, and redeploy after they confirm. Rebinding works only for an app already on an external repo (`get_data_apps`: `is_managed_git_repo: false`). A prod app on the managed repo can't be rebound, and a new org-auth app next to it is a second app: create it only when the user agrees. Otherwise stay on the managed repo and its drafts. Details: [github-organization-auth.md](github-organization-auth.md).

---

The invariant at the top of this file exists because of a measured failure: an agent opened on an empty prod app's page resolved that app correctly, said so in its reply, then called `modify_python_js_data_app` with an empty `configuration_id` instead of building into it. The project ended with two apps ([AJDA-3263](https://linear.app/keboola/issue/AJDA-3263/)).
