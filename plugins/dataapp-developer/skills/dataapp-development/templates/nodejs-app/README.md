# Node.js App Template (dashboarding default)

The preferred shape for dashboarding apps: single Express server serving both `/api/*` JSON endpoints and a static frontend with Tailwind + Chart.js loaded via CDN. No bundler, no build step.

## Local development

```bash
npm install
# Create .env (or .env.local) with KBC_URL, KBC_TOKEN, WORKSPACE_ID
npm run dev
```

The `dev` and `start` scripts load both `.env` and `.env.local` via Node's built-in `--env-file-if-exists` flag (`.env.local` overrides `.env` if both exist). Both filenames should be gitignored.

Open http://localhost:3000.

Where to find each value: see `references/storage-access.md` §Getting the env vars for local development.

## Deployment

Push this directory to a Git repo, then create a Python/JS App in Keboola pointing at the repo. Add `KBC_URL`, `KBC_TOKEN`, `WORKSPACE_ID` as `dataApp.secrets` (prefix each key with `#`).

See `references/python-js-apps.md`, `references/storage-access.md`, and `references/duckdb-caching.md` (when you're ready to add caching) in the dataapp-development skill.
