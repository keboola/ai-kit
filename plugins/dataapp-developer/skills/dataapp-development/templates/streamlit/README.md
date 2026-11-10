# Streamlit App Template

Minimal Keboola-deployable Streamlit data app.

**Row-level security is not supported in this template yet.** The template sends the user token with every query and keys its cache per user, but Streamlit gets the token once per page load and it expires after 5 minutes. For per-user data or a governed workspace, use `templates/react-vite-app/`.

## Tests

```bash
uv run --group dev pytest -q tests
``` See `references/streamlit-apps.md` §Row-level security — not supported yet.

## Local development

```bash
uv sync
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# Fill in KBC_URL, KBC_TOKEN, WORKSPACE_ID
streamlit run streamlit_app.py
```

Open http://localhost:8501.

Where to find each value: see `references/storage-access.md` §Getting the env vars for local development.

## Deployment

Push this directory to a Git repo, then create a Streamlit App in Keboola pointing at the repo. Add the same env vars as `dataApp.secrets` (prefix each key with `#`).

See `references/streamlit-apps.md` and `references/deployment-paths.md` in the dataapp-development skill for details.
