# Python App Template

Minimal Keboola-deployable Python (Flask) data app.

## Local development

```bash
uv sync
uv run python app.py
```

Open http://localhost:5000.

Where to find each value: see `references/storage-access.md` §Getting the env vars for local development.

## Deployment

Push this directory to a Git repo, then create a Python/JS App in Keboola pointing at the repo. Add any required env vars (`KBC_URL`, `KBC_TOKEN`, etc.) as `dataApp.secrets` (prefix each key with `#`).

See `references/python-js-apps.md` and `references/deployment-paths.md` in the dataapp-development skill for details.
