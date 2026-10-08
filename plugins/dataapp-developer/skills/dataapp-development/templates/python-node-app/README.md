# Python Backend Overlay

A FastAPI backend added next to the default `react-vite-app/` template, in one Keboola container. Use it only when the app genuinely needs Python — an existing Python codebase, an ML model, FastAPI services. For dashboarding, `react-vite-app/` alone is enough.

## Apply it

1. Copy `templates/react-vite-app/` into the repo root.
2. Copy this directory over it. It adds `backend/` and replaces `keboola-config/nginx/sites/default.conf`, `setup.sh` and `setup-dev.sh`.

## What runs where

| | Dev (`mode='dev'`) | Prod |
|---|---|---|
| nginx `/api/*` | FastAPI :8050 (`--reload`) | FastAPI :8050 |
| nginx `/` | Vite :3000 (HMR) | Express :3000 serving `dist/client/` |
| Setup | `uv sync` ∥ `npm install` | `uv sync` ∥ `npm install`, then `npm run build` |

- Python owns `/api/*`. Express in `server/index.ts` only serves the built client and answers `POST /`; its own `/api/*` routes are unreachable behind nginx, so move them to `backend/main.py`.
- `server/kbcQuery.ts` is unused here — query the workspace from Python (`references/storage-access.md`).

## Local development

```bash
cd backend && uv sync && uv run uvicorn main:app --reload --port 8050   # terminal 1
npm install && API_PROXY_TARGET=http://127.0.0.1:8050 npm run dev:vite  # terminal 2
```

Open http://127.0.0.1:3000. Values for `KBC_URL`, `KBC_TOKEN`, `WORKSPACE_ID`: `references/storage-access.md` §Getting the env vars for local development.

See `references/python-js-apps.md` (multi-server section).
