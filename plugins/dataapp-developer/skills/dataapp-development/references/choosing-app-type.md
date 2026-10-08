# Choosing an App Type

**Use this when:** you don't yet know whether to build a Streamlit app or a Python/JS app, or when migrating from one to the other.

## Decision hierarchy

There are three viable shapes for a Keboola App. Pick the lowest one in this list that meets your needs — simpler is better.

### 1. Streamlit (Python)

**Pick when:**
- The team is Python-only.
- The UI is mostly sidebar filters + main pane with charts/tables.
- The app is internal or a quick prototype.
- You want the paste-in-UI **Code** deployment mode for the very simplest apps.

**Read next:** [streamlit-apps.md](streamlit-apps.md).

### 2. React + Vite + Express (Python/JS type)

**The default for every Python/JS app.** Pick when:
- The app renders data — charts, tables, KPIs — or needs any custom layout.
- You don't need a Python backend.

Stack: one Node container — React + Vite + Tailwind client, Express serving it and the `/api/*` JSON endpoints. Everything is bundled at build time; nothing loads from a CDN. Kai builds the same stack, so an app moves between agents without a rewrite. Pairs naturally with DuckDB caching.

**Read next:** [python-js-apps.md](python-js-apps.md). Template at `templates/react-vite-app/`.

### 3. React + Vite + Express with a Python backend (Python/JS type)

**Pick when you need a Python backend.** Heavier — two processes, two language toolchains. Use it when:
- The team has an existing Python codebase you're wrapping a UI around.
- An ML model needs to live in Python.
- You need FastAPI/Flask services alongside the frontend.

**Read next:** [python-js-apps.md](python-js-apps.md) (multi-server section). Overlay at `templates/python-node-app/`, applied on top of `templates/react-vite-app/`.

## Decision criteria

| Criterion | Streamlit | React + Vite + Express | + Python backend |
|---|---|---|---|
| Team language | Python only | JS comfortable | Both |
| UI complexity | Low (sidebar + main) | Any (custom layout) | Any (custom layout) |
| Frontend bundler | No | Yes (Vite) | Yes (Vite) |
| Backend language | Python | Node | Python + Node |
| Deploy mode | Code or Git | Git only | Git only |
| MCP support today | Yes (`modify_streamlit_data_app`) | Yes (`modify_python_js_data_app` + git) | Yes (`modify_python_js_data_app` + git) |
| Cold-start time | Fast | Fast (build runs once per prod deploy) | Slowest |

## Migration notes

- **Streamlit → Python/JS** is a common path once a Streamlit app outgrows its sidebar-and-main shape. Migrating from Streamlit to React + Vite + Express gives a team layout control.
- **Streamlit is on a deprecation path.** New apps that exceed the simple-UI threshold should default to Python/JS. Existing Streamlit apps don't need to be migrated until you hit a Streamlit limitation.
- The Python/JS app type does not currently support paste-in-UI "Code" deployment; only Git deployment. Streamlit retains "Code" mode.
- A Python/JS app is a **prod** config that owns the git repo plus **drafts** that branch off it. Before any `modify_python_js_data_app` call, read [python-js-prod-and-drafts.md](python-js-prod-and-drafts.md): an empty `configuration_id` creates a second app, and the app you want usually exists already.

For read-only dashboarding apps (all three shapes), default to a DuckDB cache in front of the workspace — see [duckdb-caching.md](duckdb-caching.md). Querying Snowflake on every render is wasteful; caching is the default, not an optimization.
