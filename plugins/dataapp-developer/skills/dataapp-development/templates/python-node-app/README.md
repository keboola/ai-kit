# Python Backend Overlay

A FastAPI backend added next to the default `react-vite-app/` template, in one Keboola container. Use it only when the app genuinely needs Python — an existing Python codebase, an ML model, FastAPI services. For dashboarding, `react-vite-app/` alone is enough.

## Apply it

1. Copy `templates/react-vite-app/` into the repo root.
2. Copy this directory over it. It adds `backend/` and replaces `keboola-config/nginx/sites/default.conf`, `setup.sh` and `setup-dev.sh`.
3. Delete `keboola-config/supervisord-dev/services/api.conf`, `server/kbcQuery.ts` with its `@keboola/api-client` dependency, and the `/api` routes in `server/index.ts` — Python owns `/api/*`.

## What runs where

| | Dev (`mode='dev'`) | Prod |
|---|---|---|
| nginx `/api/*` | FastAPI :8050 (`--reload`) | FastAPI :8050 |
| nginx `/` | Vite :3000 (HMR) | Express :3000 serving `dist/client/` |
| Setup | `uv sync` ∥ `npm install` | `uv sync` ∥ `npm install`, then `npm run build` |

- Express only serves the built client in prod; query the workspace from Python (`references/storage-access.md`).
- nginx answers the platform's `POST /` health check.

## Local development

```bash
cd backend && uv sync && uv run uvicorn main:app --reload --port 8050   # terminal 1
npm install && API_PROXY_TARGET=http://127.0.0.1:8050 npm run dev     # terminal 2
```

Open http://127.0.0.1:3000. Values for `KBC_URL`, `KBC_TOKEN`, `WORKSPACE_ID`: `references/storage-access.md` §Getting the env vars for local development.

See `references/python-js-apps.md` (multi-server section).
