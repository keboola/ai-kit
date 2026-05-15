# Streamlit Apps

**Use this when:** you're building, modifying, or debugging a Streamlit app on Keboola.

This reference covers Keboola-specific concerns for Streamlit apps: how they get deployed, what's already in the image, how secrets and themes work, and how to keep local dev in parity with production. For the iterative change loop (validate -> build -> verify) on an existing app, see [dev-workflow.md](dev-workflow.md).

## Deployment modes

Keboola supports two ways to ship Streamlit code into a data app slot. The choice is a one-line decision in the configuration UI, but it changes how you manage code, dependencies, and secrets.

**Code mode** lets you paste Python source directly into the Keboola UI. This is the fastest path for a single-file prototype or a demo. The UI also exposes a Packages field for extra pip dependencies that aren't pre-installed in the base image. Code mode has two real limitations:

- There is no file tree. Anything beyond a single `streamlit_app.py` -- multiple pages, helper modules, static assets, custom themes via `.streamlit/config.toml` -- has nowhere to live.
- Theme overrides have to be smuggled in via `parameters.dataApp.streamlit.config.toml` as a TOML string in the JSON editor (see Theming below).

**Git Repository mode** points the data app at a GitHub repository. The repo can be public or private. For private repos, Keboola accepts either:

- A GitHub username + Personal Access Token (PAT) pair, or
- An SSH private key for deploy-key style access.

Git mode is the right choice whenever the app has more than one file, needs a real `pyproject.toml`, or wants a committed `.streamlit/config.toml` and `.streamlit/secrets.toml.example`.

Regardless of mode, **never paste secrets into a public repo**. API tokens, database passwords, and OAuth client secrets belong in `dataApp.secrets` on the configuration -- they get injected as environment variables at runtime. The repo only sees a `.streamlit/secrets.toml.example` with placeholder values.

## Base image and packages

The Keboola Streamlit base image already includes the libraries most data apps need, so you usually don't need to declare them. Pre-installed across all backend versions:

- Streamlit core stack: `streamlit`, `pandas`, `numpy`, `matplotlib`, `plotly`, `scikit-learn`, `seaborn`
- Utilities: `graphviz`, `deepmerge`, `python-dotenv`, `toml`
- Keboola helpers: `keboola.component`, `streamlit-aggrid`, `streamlit-keboola-api`, `streamlit_authenticator`

If you need anything else -- `duckdb`, `pydeck`, `altair`, an LLM SDK, an HTTP client -- declare it in the **Packages** field on the configuration. The field accepts pip-style lines, one per package, and runs at container start.

From backend version 1.15.0 onward, the runtime exposes a Python version selector with **3.10**, **3.11**, and **3.13** available; **3.10** is the default. Lock the version explicitly if your dependencies require a specific minor release.

## Secrets

Secrets reach a Streamlit app on Keboola through `st.secrets`, but how they get there depends on the deployment mode. There are two upload paths and they behave differently.

**1. Direct UI upload of `secrets.toml`.** In the configuration UI you can paste or upload a `secrets.toml` file. Keboola parses it and stores each value as a flat, top-level secret. Importantly, **TOML sections are not preserved**. A file like:

```toml
[snowflake]
account = "abc-12345"
user = "data_app_user"
```

is imported as two flat keys: `snowflake.account` collapses to `account`, and you access it as `st.secrets["account"]`, not `st.secrets["snowflake"]["account"]`. If you rely on grouped access, either flatten the keys yourself (`snowflake_account`, `snowflake_user`) or use the repo path below.

**2. Repo-based `.streamlit/secrets.toml`.** For Git-deployed apps you can commit a `.streamlit/secrets.toml` (only when the repo is private, obviously). Streamlit reads it directly and nested groups work the way the TOML spec says they do:

```toml
[snowflake]
account = "abc-12345"
user = "data_app_user"
```

```python
account = st.secrets["snowflake"]["account"]
```

Two more rules apply regardless of upload path:

- **Do not name a secret `KBC_TOKEN`.** The platform sets it automatically -- you get a scoped Storage API token at runtime without doing anything. Naming a custom secret `KBC_TOKEN` either fails or shadows the platform value.
- **The `#`-prefix convention** from `dataApp.secrets` strips the `#` and uppercases the name when exporting as an environment variable. So a secret called `#my_api_key` lands in the container as `MY_API_KEY`. Use this for anything you also want to read via `os.environ` rather than `st.secrets`.

## Theming

Two paths to a custom theme, depending on how much control you want and which deployment mode you're in.

**1. Theming UI.** The configuration has a Theming tab with a small palette of presets -- Keboola, Light Red, Light Purple, Light Blue, Dark Green, Dark Amber, Dark Orange -- plus color pickers for the four customizable channels (primary, background, secondary background, text). This is the right tool for picking a brand color and moving on.

**2. Raw `config.toml`.** For finer control:

- **Git-deployed apps** commit `.streamlit/config.toml` to the repo. Streamlit reads it normally.
- **Code-deployed apps** set `parameters.dataApp.streamlit.config.toml` in the JSON config editor as a TOML-formatted string.

The default **Keboola** theme uses:

- Primary color: `#1F8FFF`
- Background: `#FFFFFF`
- Secondary background: `#E6F2FF`
- Text: `#222529`
- Font: sans serif

A minimal `.streamlit/config.toml` for the Keboola theme looks like:

```toml
[theme]
primaryColor = "#1F8FFF"
backgroundColor = "#FFFFFF"
secondaryBackgroundColor = "#E6F2FF"
textColor = "#222529"
font = "sans serif"
```

One important behavior: **the Theming UI overwrites the `[theme]` section on save, but preserves other sections** like `[server]` or `[browser]`. So you can safely set server-side options alongside the theme without losing them when a colleague tweaks colors in the UI:

```toml
[theme]
primaryColor = "#1F8FFF"
backgroundColor = "#FFFFFF"
secondaryBackgroundColor = "#E6F2FF"
textColor = "#222529"
font = "sans serif"

[server]
maxUploadSize = 500

[browser]
gatherUsageStats = false
```

The 500 MB upload limit and the analytics opt-out survive a Theming UI save -- only `[theme]` gets rewritten.

## AgGrid Enterprise

AgGrid Enterprise is licensed platform-wide, so any data app can use the enterprise features (set filters, master-detail, range selection, server-side row model) without bringing its own license key. The key is exposed through the `keboola-streamlit` helper:

```python
import streamlit as st
from keboola_streamlit import KeboolaStreamlit

URL = st.secrets["kbc_url"]
TOKEN = st.secrets["kbc_token"]

keboola = KeboolaStreamlit(URL, TOKEN)
license_key = keboola.aggrid_license_key
```

Pass `license_key` straight into the AgGrid component:

```python
from st_aggrid import AgGrid, GridOptionsBuilder

gb = GridOptionsBuilder.from_dataframe(df)
gb.configure_default_column(filterable=True, sortable=True)
grid_options = gb.build()

AgGrid(
    df,
    gridOptions=grid_options,
    license_key=license_key,
    enable_enterprise_modules=True,
)
```

Without `enable_enterprise_modules=True` the license key is ignored and you fall back to the community feature set.

## Storage access from Streamlit

For the full pattern -- which workspace gets mounted, how RO/RW differs across Snowflake and BigQuery, and which Keboola SDK to use -- see [storage-access.md](storage-access.md).

Short version: by default a Streamlit data app gets a read-only workspace. On Snowflake projects you query it through the Query Service; on BigQuery projects you go through the Storage API. The runtime injects three environment variables that the SDKs consume directly: `KBC_URL`, `KBC_TOKEN`, and `KBC_WORKSPACE_ID`. In production these come from the platform; for local development you set them in `.streamlit/secrets.toml` and read them via the env-parity pattern below.

## Local development

Running the app on your laptop should look like Keboola without trying to be Keboola. Same code, same secrets shape, same `streamlit_app.py` entrypoint -- only the source of the credentials changes.

```bash
# Install
uv sync
# (or fallback: pip install -e .)

# Set local credentials
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# Edit secrets.toml with real KBC_URL, KBC_TOKEN, KBC_WORKSPACE_ID

# Run
streamlit run streamlit_app.py
```

Then open http://localhost:8501.

See [storage-access.md](storage-access.md) §Getting the env vars for local development for where to find each value in the Keboola UI.

The key pattern for keeping prod and local in sync is **read config from env first, fall back to `st.secrets`**:

```python
import os
import streamlit as st

kbc_token = os.environ.get('KBC_TOKEN') or st.secrets.get('KBC_TOKEN')
kbc_url = os.environ.get('KBC_URL') or st.secrets.get('KBC_URL')
kbc_workspace_id = os.environ.get('KBC_WORKSPACE_ID') or st.secrets.get('KBC_WORKSPACE_ID')
```

In Keboola the env vars are populated from `dataApp.secrets` and the first lookup wins. Locally, env vars are typically unset, so the code falls through to `st.secrets`, which Streamlit loads from `.streamlit/secrets.toml`. Same module, both environments, no `if PRODUCTION:` branching.

Hot reload comes for free -- save the file and Streamlit re-runs the script. No watcher to configure.

A starter `.streamlit/secrets.toml.example` to commit:

```toml
# Copy to .streamlit/secrets.toml and fill in real values.
# Never commit secrets.toml -- it should be in .gitignore.
KBC_URL = "https://connection.keboola.com"
KBC_TOKEN = "your-storage-api-token"
KBC_WORKSPACE_ID = "1234567"
```

For the inner-loop workflow on an existing app -- changing a query, adding a filter, fixing a layout -- see [dev-workflow.md](dev-workflow.md), which covers the validate -> build -> verify cycle with the right Playwright + MCP checkpoints. For deciding when a Streamlit app is the right tool at all (versus a FastAPI service or a Next.js frontend), see [choosing-app-type.md](choosing-app-type.md).

## Capturing errors for platform logs

**Streamlit silently swallows uncaught exceptions into its UI.** It shows the traceback to the user in the browser but does NOT write it to `stdout` / `stderr` by default. Platform-side log readers (the Terminal Log tab, `mcp__keboola__get_data_apps([cfg_id]).deployment_info.logs`) therefore see nothing — making remote debugging impossible.

Wrap `main()` in a logging decorator that catches, logs, then re-raises so Streamlit still shows the error in the UI:

```python
import functools
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def log_exceptions(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Unhandled exception: {e}", exc_info=True)
            raise  # re-raise so Streamlit still shows it in the UI
    return wrapper


@log_exceptions
def main():
    # all your Streamlit code here
    ...


main()
```

Apply the same wrapper to long-running callback functions, background threads, or any code path that runs outside of Streamlit's main rerun loop. Python/JS apps (Flask, FastAPI, Express) don't need this — their frameworks already log uncaught exceptions to `stderr`, which supervisord forwards to platform logs.

For reading the logs once they're emitted, see [troubleshooting.md](troubleshooting.md) §Reading logs.
