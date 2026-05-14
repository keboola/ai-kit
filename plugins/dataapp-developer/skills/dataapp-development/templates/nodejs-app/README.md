# Node.js App Template (dashboarding default)

The preferred shape for dashboarding apps: single Express server serving both `/api/*` JSON endpoints and a static frontend with Tailwind + Chart.js loaded via CDN. No bundler, no build step.

Modeled on [`keboola-rnd/kai-pricing-calculator-app` on the `nodejs-pricing-simulator` branch](https://github.com/keboola-rnd/kai-pricing-calculator-app/tree/nodejs-pricing-simulator).

## Local development

```bash
npm install
# Create .env (or .streamlit/secrets.toml) with KBC_URL, KBC_TOKEN, KBC_WORKSPACE_ID
node --watch server.js
```

Open http://localhost:3000.

## Deployment

Push this directory to a Git repo, then create a Python/JS App in Keboola pointing at the repo. Add `KBC_URL`, `KBC_TOKEN`, `KBC_WORKSPACE_ID` as `dataApp.secrets` (prefix each key with `#`).

See `references/python-js-apps.md`, `references/storage-access.md`, and `references/duckdb-caching.md` (when you're ready to add caching) in the dataapp-development skill.
