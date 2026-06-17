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

### 2. Single Node.js + static frontend (Python/JS type)

**The preferred default for dashboarding apps.** Pick when:
- The app primarily renders data — charts, tables, KPIs.
- You don't need a heavy Python backend.
- You want one process, no bundler, fast cold start.

Stack: Express (or similar) on a single port, serving both `/api/*` JSON endpoints and a static frontend (`public/index.html` + `public/app.js`) with Tailwind and Chart.js loaded via CDN. Pairs naturally with DuckDB caching.

**Read next:** [python-js-apps.md](python-js-apps.md). Template at `templates/nodejs-app/`.

### 3. Combined Python + Node (Python/JS type)

**Pick when you need a Python backend.** This is heavier — two processes, two language toolchains. Use it when:
- The team has an existing Python codebase you're wrapping a UI around.
- An ML model needs to live in Python.
- You need FastAPI/Flask services alongside the frontend.
- The frontend justifies a bundler (Next.js, Vite + React + shadcn/ui).

**Read next:** [python-js-apps.md](python-js-apps.md) (multi-server section). Template at `templates/python-node-app/`.

## Decision criteria

| Criterion | Streamlit | Single Node + static | Python + Node |
|---|---|---|---|
| Team language | Python only | JS comfortable | Both |
| UI complexity | Low (sidebar + main) | Medium (custom layout) | High (custom framework) |
| Frontend bundler | No | No | Yes |
| Backend language | Python | Node | Python + Node |
| Deploy mode | Code or Git | Git only | Git only |
| MCP support today | Yes (`modify_streamlit_data_app`) | No (use kbagent or git) | No (use kbagent or git) |
| Cold-start time | Fast | Fastest | Slowest |

## Migration notes

- **Streamlit → Python/JS** is a common path once a Streamlit app outgrows its sidebar-and-main shape. Migrating from Streamlit to single Node + static can give a team layout control and reduce cold-start time.
- **Streamlit is on a deprecation path.** New apps that exceed the simple-UI threshold should default to Python/JS. Existing Streamlit apps don't need to be migrated until you hit a Streamlit limitation.
- The Python/JS app type does not currently support paste-in-UI "Code" deployment; only Git deployment. Streamlit retains "Code" mode.

For read-only dashboarding apps (all three shapes), default to a DuckDB cache in front of the workspace — see [duckdb-caching.md](duckdb-caching.md). Querying Snowflake on every render is wasteful; caching is the default, not an optimization.
