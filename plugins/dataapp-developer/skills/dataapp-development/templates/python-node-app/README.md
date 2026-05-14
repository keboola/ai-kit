# Python + Node App Template

Combined Python (FastAPI) backend + Node.js (Express) frontend in one Keboola container. Use this when you genuinely need a Python backend alongside a JS frontend; for pure dashboarding, the simpler `nodejs-app/` template is preferred.

Pattern: FastAPI :8050 + Express :3000 in one Keboola container.

## Local development

Two terminals:

```bash
# Terminal 1 — backend
cd backend
uv sync
uv run uvicorn main:app --reload --port 8050
```

```bash
# Terminal 2 — frontend
cd frontend
npm install
node --watch server.js
```

Open http://localhost:3000. The frontend's Express server proxies `/api/*` to the backend so you don't need a local nginx.

Where to find each value (`KBC_URL`, `KBC_TOKEN`, `KBC_WORKSPACE_ID`): see `references/storage-access.md` §Getting the env vars for local development.

## Deployment

Push this directory to a Git repo. The `keboola-config/setup.sh` runs `uv sync` and `npm install` in parallel. Add Keboola secrets for `KBC_URL`, `KBC_TOKEN`, etc.

See `references/python-js-apps.md` (multi-server section) and `references/deployment-paths.md` in the dataapp-development skill.
