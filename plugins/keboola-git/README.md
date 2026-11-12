# Keboola Git Plugin

Access **Keboola-managed Git (Forgejo)** repos for python-js data apps through the
`kbagent` CLI. Keboola data apps can host their source in a Keboola-managed repo instead of
GitHub; this plugin gives Claude Code the context to provision those repos, mint push
credentials, push source in with raw `git`, and deploy — including the non-obvious
**~15MB / HTTP 413** push cap that forces a **build-at-deploy** approach for repos that
commit their build.

## 🎯 Available Skill

### `keboola-git`
**Activation**: Automatic when working with a Keboola-managed git repo for a data app — provisioning, finding its clone URL, minting a push credential, pushing source, handling HTTP 413, or deploying from the managed repo.

Covers:
- Provision a managed repo via `kbagent data-app create --use-managed-git-repo`; find existing apps via `data-app list`.
- Every `data-app create` makes a new app **and a new repo** — resolve the existing app before creating; this skill's flow targets the prod app's `main`.
- Mint a one-time push credential with `data-app git-credentials-create` and push to the URL from `data-app git-repo` (`https://git.<stack>/keboola/app-<id>.git`).
- Raw `git clone` / `remote add` / `push keboola HEAD:main` (kbagent has no repo-copy helper), after joining the initial commit a new app's repo starts with.
- The **15MB / HTTP 413 cap** and the **build-at-deploy** recipe (untrack `frontend/.next`, build in `keboola-config/setup.sh`).
- Deploy + verify from the logs (`Compiled successfully`, `Completed: setup_sh`, `node-frontend entered RUNNING`) — not an HTTP probe, since `GET /` hits the platform login gate and `POST /` is an nginx health rule.
- **Or don't copy at all**: a GitHub repo can back the app directly with organization auth (`kbagent data-app create --git-auth organization`). There's no PAT and no 15MB cap, but it's prod-only for now. The skill offers it before copying.
- A full command catalog and gotchas table in [`skills/keboola-git/references/managed-git.md`](./skills/keboola-git/references/managed-git.md).

## ⚡ Command

### `/keboola-git-copy`
Bidirectional copy of a data app's source between GitHub and Keboola git.

```
/keboola-git-copy to-keboola|to-github --source <repo-url-or-path> --branch <branch> --project <alias> [--app-id <id>] [--app-name <name>]
```

- **`to-keboola`** (GitHub → Keboola): first offer deploying straight from the GitHub repo with organization auth; otherwise resolve/provision the app, mint a credential, clone the source, run the size guard, apply build-at-deploy if a build is committed, push to `main`, then offer to deploy and verify.
- **`to-github`** (Keboola → GitHub): clone the managed `main` and push to a **user-owned scratch/feature branch only** — confirms before any shared-repo push, never force-pushes.

## ✅ Prerequisites

- **kbagent** installed and on `PATH` (`kbagent --version`). Install the `kbagent` plugin from this marketplace with `/plugin install kbagent@keboola-claude-kit`, then run `/kbagent:setup` to install the CLI. Not the `keboola-cli` plugin in this repo — that one wraps the older `kbc` CLI.
- Project registered: `kbagent --json project add --alias <alias> --url <stack-url> --token-env KBC_TOKEN`.
- `export KBAGENT_CONVERSATION_ID=$(uuidgen)` once per shell session.
- An **admin** Storage token for the project: `data-app git-credentials-create` refuses other tokens.
- This plugin is **kbagent-CLI driven** — it ships **no MCP server**.

## 🔒 Safety

- Push credentials are one-time secrets: held in a shell variable only, never committed or logged; rotate (re-mint) if exposed.
- Never force-push. The repo's default branch (`main`) cannot be deleted; a draft branch can.
- Reverse copies default to a user-owned scratch repo + feature branch; shared-repo pushes require confirmation.

## Related

- [`dataapp-developer`](../dataapp-developer) — `dataapp-development` skill for `keboola-config/` (setup.sh, nginx, supervisord), Streamlit, and the Python/JS prod-app-and-drafts rules.
