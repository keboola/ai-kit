# Streamlit App Template

Minimal Keboola-deployable Streamlit data app.

## Local development

```bash
uv sync
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# Fill in KBC_URL, KBC_TOKEN, KBC_WORKSPACE_ID
streamlit run streamlit_app.py
```

Open http://localhost:8501.

Where to find each value: see `references/storage-access.md` §Getting the env vars for local development.

## Deployment

Push this directory to a Git repo, then create a Streamlit App in Keboola pointing at the repo. Add the same env vars as `dataApp.secrets` (prefix each key with `#`).

See `references/streamlit-apps.md` and `references/deployment-paths.md` in the dataapp-development skill for details.
