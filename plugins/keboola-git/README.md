# Keboola Git Plugin

Access **Keboola-managed Git (Forgejo)** repos for python-js data apps through the
`kbagent` CLI. Keboola data apps can host their source in a Keboola-managed repo instead of
GitHub; this plugin gives Claude Code the context to provision those repos, mint push
credentials, push source in with raw `git`, and deploy — including the non-obvious
**~15MB / HTTP 413** push cap that forces a **build-at-deploy** approach for repos that
commit their build.

## 🎯 Available Skill

### `keboola-git`
**Activation**: Automatic when working with a Keboola-managed git repo for a data app — provisioning, finding `repo_url`, minting a `git_clone_url`, pushing source, handling HTTP 413, or deploying from the managed repo.

Covers:
- Provision a managed repo via `modify_python_js_data_app`; find existing ones via `get_data_apps`.
- Mint a one-time push credential with `create_python_js_data_app_git_credential` (`git_clone_url` = `https://kai:<secret>@git.<stack>/keboola/app-<id>.git`).
- Raw `git clone` / `remote add` / `push keboola HEAD:main` (kbagent has no repo-copy helper).
- The **15MB / HTTP 413 cap** and the **build-at-deploy** recipe (untrack `frontend/.next`, build in `keboola-config/setup.sh`).
- Deploy + verify: `deploy_data_app`, logs, password, `POST /` probe.
- A full command catalog and gotchas table in [`skills/keboola-git/references/managed-git.md`](./skills/keboola-git/references/managed-git.md).

## ⚡ Command

### `/keboola-git-copy`
Bidirectional copy of a data app's source between GitHub and Keboola git.

```
/keboola-git-copy to-keboola|to-github --source <repo-url-or-path> --branch <branch> --project <alias> [--config <cfg>] [--app-name <name>]
```

- **`to-keboola`** (GitHub → Keboola): resolve/provision the app, mint a credential, clone the source, run the size guard, apply build-at-deploy if a build is committed, push to `main`, then offer to deploy and verify.
- **`to-github`** (Keboola → GitHub): clone the managed `main` and push to a **user-owned scratch/feature branch only** — confirms before any shared-repo push, never force-pushes.

## ✅ Prerequisites

- **kbagent** installed and on `PATH` (`kbagent --version`). See the `keboola-cli` plugin / kbagent docs.
- Project registered: `kbagent --json project add --project <alias> --stack <stack-url> --storage-token "$KBC_TOKEN"`.
- `export KBAGENT_CONVERSATION_ID=$(uuidgen)` once per shell session.
- A **manage token** in the environment for `data-app logs` / `password` / `delete` (used with `--allow-env-manage-token`).
- This plugin is **kbagent-CLI driven** — it ships **no MCP server**.

## 🔒 Safety

- `git_clone_url` credentials are one-time secrets: held in a shell variable only, never committed or logged; rotate (re-mint) if exposed.
- Never force-push; the Forgejo pre-receive hook declines branch deletes.
- Reverse copies default to a user-owned scratch repo + feature branch; shared-repo pushes require confirmation.

## Related

- [`dataapp-developer`](../dataapp-developer) — `dataapp-deployment` skill for `keboola-config/` (setup.sh, nginx, supervisord) and `dataapp-dev` for Streamlit.
- [`keboola-cli`](../keboola-cli) — broader kbagent project management and review.
