# Streamlit App Template

Minimal Keboola-deployable Streamlit data app.

Row-level security: every query sends the signed-in user's token, which `keboola-streamlit` renews through the apps proxy before it expires, and the result cache is keyed per user. See `references/streamlit-apps.md` §Row-level security.

## Tests

```bash
uv run --group dev pytest -q tests
```

## Local development

```bash
uv sync
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# Fill in KBC_URL, KBC_TOKEN, BRANCH_ID
# The app's workspace: the platform mounts its manifest; locally, write one with the app's workspace ID
echo '{"workspaceId": "12345", "governed": false}' > workspace-manifest.json
KBC_WORKSPACE_MANIFEST_PATH=workspace-manifest.json streamlit run streamlit_app.py
```

Open http://localhost:8501.

Where to find each value: see `references/storage-access.md` §Getting the env vars for local development.

## Deployment

Push this directory to a Git repo, then create a Streamlit App in Keboola pointing at the repo. Add the same env vars as `dataApp.secrets` (prefix each key with `#`).

See `references/streamlit-apps.md` and `references/deployment-paths.md` in the dataapp-development skill for details.
