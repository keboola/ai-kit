# Storage Access

**Use this when:** the app reads from or writes to Keboola Storage tables.

## Getting the env vars for local development

Production: Keboola auto-injects these as env vars from `dataApp.secrets` when the app deploys. Local dev: you set them yourself, once per machine, from values in the Keboola project UI.

### KBC_URL

The base URL of the Keboola project's stack — not the project-specific URL.

- Open the project in your browser.
- The URL bar shows `https://connection.<stack>.keboola.com/admin/projects/<id>/...`.
- `KBC_URL` is the prefix WITHOUT `/admin/...`: `https://connection.<stack>.keboola.com`.

Stack examples (replace `<stack>` with your actual stack):
- `us-east4.gcp.keboola.com`
- `north-europe.azure.keboola.com`
- `europe-west3.gcp.keboola.com`
- `eu-central-1.keboola.com` (legacy AWS EU)

### KBC_TOKEN

Storage API token. **Do NOT use the master token from your user account.** Create a dedicated, scoped token for the app.

How to create one:
1. Open the project → **Settings → API Tokens** (or the equivalent "Users & Settings" → "API Tokens" depending on UI version).
2. Click **New Token** (or "Create New Token").
3. Give it a descriptive name (e.g. `my-app-local-dev`).
4. Scope it minimally:
   - **Read-only apps:** read access to the buckets/tables the app needs. Don't grant write or admin permissions.
   - **RW apps (Storage Access):** the app's workspace is provisioned with its own DB user, so the token only needs read access — write permissions on tables come from the workspace grant.
5. Copy the token immediately — Keboola shows it once.
6. Treat it like a password: never commit it, never paste it in screenshots / chat.

For production, the same value goes into `dataApp.secrets` as `#KBC_TOKEN` (the `#` prefix marks it encrypted at rest).

### KBC_WORKSPACE_ID

A provisioned compute workspace (Snowflake by default; BigQuery on BigQuery-backed projects). Required for the workspace-query endpoint that powers RO reads.

How to provision:
1. Open the project → **Workspaces** (or "Sandboxes" / "Transformations → Workspaces" depending on UI version).
2. Click **New Workspace** (or "Create Workspace").
3. Choose the backend (Snowflake or BigQuery — matches your project).
4. Pick a size (XS or S is enough for an app cache pull).
5. Open the created workspace detail. The numeric `id` is shown in the URL (`.../workspaces/12345`) and in the workspace detail panel.
6. Use that numeric value — `12345`, not `WORKSPACE_12345` (the latter is the Snowflake schema name; the Storage API needs the numeric form; see [troubleshooting.md](troubleshooting.md) for the prefix-stripping pattern).

Notes:
- One workspace can serve multiple local-dev sessions; you don't need a new one per developer.
- For RW apps, do NOT use a generic workspace — the platform provisions an ephemeral, permission-scoped workspace at deploy time (see "Read-write direct access" below).

### BRANCH_ID

Defaults to `default` (production). Almost always leave it that way.

**Important context:** data apps themselves only live in the **production branch** — the platform does not deploy or run data apps from development branches. So `BRANCH_ID` is not about where the app runs (it always runs in production), but about which branch's tables the app reads from at runtime.

You only need to set `BRANCH_ID` explicitly if:

- The app needs to read tables that live in a **development branch** (e.g. previewing data from an in-progress migration before it lands in production).
- In that case, find the numeric branch ID in the project UI under **Development Branches** — the URL of the branch shows it.

For every other case → omit `BRANCH_ID` (or set it to `default`) and the app reads production tables.

## Preferred default for read-only apps: DuckDB-cached RO

For any read-only dashboarding app, this is the default. Don't query the warehouse on every render — cache once into an in-memory DuckDB and serve every dashboard query from local memory.

Why this is the default:
- Querying Snowflake on every render burns DWH credits. A dashboard with 5 KPIs viewed by 100 users per day is 500 queries/day for data that changed once. Multiply by every dashboard the customer runs.
- A single pull from Snowflake into an in-memory DuckDB costs ONE query and serves every subsequent dashboard render at local-process speed (typically sub-millisecond).
- Most dashboards tolerate minutes-old data; users do not notice a 30-minute refresh interval on aggregate KPIs.

The pattern:
1. On app start: `init()` creates an in-memory DuckDB with the right table schemas.
2. `refresh()` pulls from Snowflake once (via the RO workspace endpoint) and bulk-inserts the rows into DuckDB.
3. A background interval (`setInterval` in Node, `threading.Timer` in Python) re-runs `refresh()` every N minutes — typical interval 30-60 min.
4. An admin endpoint (`POST /api/refresh`) forces a refresh on demand for operators who can't wait for the next interval.
5. Every dashboard query runs against DuckDB, not Snowflake.

When NOT to use this default:
- The app writes back via Storage Access — see "Read-write direct access" below. Every read must be current; no caching.
- The user needs sub-minute freshness (live operational monitoring) — see "Direct RO workspace queries".
- The cached dataset would exceed container memory. Rule of thumb: pulling more than a few hundred MB at a time is the warning sign — either pull aggregates instead of raw rows, or fall back to "Direct RO workspace queries".

Full reference and runnable harness: [duckdb-caching.md](duckdb-caching.md) and `templates/duckdb-cache/`. This section is the "why" and "when"; that reference is the "how".

## Direct RO workspace queries

Use this when:
- You're using the MCP `modify_data_app` flow and the `{QUERY_DATA_FUNCTION}` placeholder gets injected automatically — most agent-driven Streamlit creation works this way.
- The cached dataset would be too large for an in-memory cache, OR the freshness requirement is sub-minute.
- You're prototyping and haven't wired DuckDB yet.

Two paths to call the workspace:

- **MCP-injected `query_data`** — when `modify_data_app` is involved, a `query_data(sql) -> pd.DataFrame` function is dropped into the source code via the `{QUERY_DATA_FUNCTION}` placeholder. Use it as-is; don't roll your own.
- **Direct API call** — for Python/JS apps without MCP injection, POST to `/v2/storage/branch/{branch}/workspaces/{workspace_id}/query` with `X-StorageApi-Token`.

Required env vars (Keboola auto-injects on deploy):
- `KBC_URL`, `KBC_TOKEN` — auth.
- `KBC_WORKSPACE_ID` (or `WORKSPACE_ID`) — workspace identifier.
- `BRANCH_ID` — Storage API branch.

Behind the scenes:
- Snowflake projects → Query Service API.
- BigQuery projects → Storage API (Query Service does not yet support BigQuery).

The function signature is consistent across backends; the agent doesn't need to know which one it's hitting.

Usage pattern in a Streamlit app:

```python
df = query_data('SELECT * FROM "in.c-main"."customers" LIMIT 100')
st.dataframe(df)
```

Direct API call shape:

```
POST {KBC_URL}/v2/storage/branch/{branch}/workspaces/{workspace_id}/query
Header: X-StorageApi-Token: {KBC_TOKEN}
Body: { "query": "<your SQL>" }
```

Robust JS implementation pattern:
- Resolve env vars with multiple fallback names: `KBC_URL` / `KBC_STACK_API_URL` / `STORAGE_API_URL`; `KBC_TOKEN` / `KBC_STORAGEAPI_TOKEN` / `STORAGE_API_TOKEN`; `KBC_WORKSPACE_ID` / `WORKSPACE_ID`; `KBC_BRANCH_ID` / `BRANCH_ID` (defaults to `default`).
- Normalize the workspace ID — Keboola sometimes exposes it as `WORKSPACE_<id>` (the Snowflake schema name). Strip that prefix; the Storage API expects the numeric ID. Regex: `/^WORKSPACE_(\d+)$/i`.
- Retry on 5xx (e.g. 2 retries, 800ms backoff).
- Queue queries so concurrent calls don't overwhelm the workspace.

```javascript
function resolveConfig() {
  const baseUrl =
    process.env.KBC_URL ||
    process.env.KBC_STACK_API_URL ||
    process.env.STORAGE_API_URL;
  const token =
    process.env.KBC_TOKEN ||
    process.env.KBC_STORAGEAPI_TOKEN ||
    process.env.STORAGE_API_TOKEN;
  const branchId =
    process.env.KBC_BRANCH_ID || process.env.BRANCH_ID || 'default';

  let workspaceId =
    process.env.KBC_WORKSPACE_ID || process.env.WORKSPACE_ID || '';
  // Strip "WORKSPACE_" prefix — Storage API wants the numeric ID, not the schema name.
  const m = workspaceId.match(/^WORKSPACE_(\d+)$/i);
  if (m) workspaceId = m[1];

  if (!baseUrl || !token || !workspaceId) {
    throw new Error('Missing required Keboola env vars (URL, token, or workspace ID)');
  }
  return { baseUrl, token, branchId, workspaceId };
}

async function runQuery(sql, { retries = 2, backoffMs = 800 } = {}) {
  const { baseUrl, token, branchId, workspaceId } = resolveConfig();
  const url = `${baseUrl}/v2/storage/branch/${branchId}/workspaces/${workspaceId}/query`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-StorageApi-Token': token,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) return res.json();
    if (res.status >= 500 && attempt < retries) {
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
      continue;
    }
    throw new Error(`Workspace query failed: ${res.status} ${await res.text()}`);
  }
}
```

## Read-write direct access (Storage Access)

Real-time read AND write to Keboola Storage. **Snowflake only.** BigQuery support is planned. No caching — every read must reflect the latest state.

Setup:
- Project Settings → Features → enable "Storage Access".
- App configuration → Advanced Settings → Storage Access section → add writable tables.
- Or programmatically: set `storage.output.tables[].destination` to the table ID and `unload_strategy: "direct-grant"`:
  ```json
  {
    "storage": {
      "output": {
        "tables": [
          { "destination": "out.c-data-app.records", "unload_strategy": "direct-grant" }
        ]
      }
    }
  }
  ```

Workspace lifecycle: **ephemeral**. A fresh workspace is created each time the app starts or wakes from sleep. The previous workspace is deleted. Permission changes take effect on the next start.

Env vars set when Storage Access is enabled:
- `KBC_WORKSPACE_MANIFEST_PATH` — path to a JSON manifest with `workspaceId` and other metadata. **Preferred source for the workspace ID.**
- `WORKSPACE_ID`, `BRANCH_ID`, `QUERY_SERVICE_URL`, `KBC_TOKEN`.

Library:
- Python: `keboola-query-service`
- JS/TS: `@keboola/query-service`

Minimal Python read example:

```python
import json, os
from keboola_query_service import Client

with open(os.environ["KBC_WORKSPACE_MANIFEST_PATH"]) as f:
    workspace_id = json.load(f)["workspaceId"]

client = Client(
    base_url=os.environ["QUERY_SERVICE_URL"],
    token=os.environ["KBC_TOKEN"],
)

results = client.execute_query(
    branch_id=os.environ["BRANCH_ID"],
    workspace_id=workspace_id,
    statements=['SELECT * FROM "in.c-main"."customers" LIMIT 100'],
)
rows = results[0].data
```

Minimal write example with allowlisted input — sanitized for SQL injection:

```python
ALLOWED_STATUSES = {"pending", "approved", "rejected"}
status = user_input
if status not in ALLOWED_STATUSES:
    raise ValueError(f"Invalid status: {status}")
record_id = int(user_input_id)  # int() coerces; raises if not numeric

client.execute_query(
    branch_id=os.environ["BRANCH_ID"],
    workspace_id=workspace_id,
    statements=[f'''
        UPDATE "in.c-main"."approvals"
        SET status = '{status}', updated_at = CURRENT_TIMESTAMP
        WHERE id = {record_id}
    '''],
)
```

**Critical caveat — SQL injection:** the Query Service accepts raw SQL and does NOT support parameterized queries / bind variables. The application MUST validate every untrusted value before interpolating:
- Numeric values: coerce with `int(...)` / `Number(...)` — raises/NaN on bad input.
- String enums: use an allowlist set; reject anything not in it.
- Arbitrary strings: don't interpolate. Wait for the planned `SQL.literal()` helpers in the Python and JS SDKs.

First-class `SQL.literal()` / `SQL.ident()` / `sql.format()` helpers are in development in the Python and JS Query Service SDKs. Once shipped, prefer them over manual sanitization. SDK source repos are listed in [glossary.md](glossary.md) §Libraries.

## Input mapping — discouraged for new apps

Snapshot at deploy time. Files appear at `/data/in/tables/<table-name>.csv`. NO write-back. NO fresh data until redeploy.

Use ONLY for static reference data loaded once at deploy time. For everything else, use the DuckDB-cached RO default or RW Storage Access.

Read pattern:

```python
import pandas as pd
df = pd.read_csv("/data/in/tables/customers.csv")
```

## Data access management — PLACEHOLDER

Per-user / row-level data access control at the app-storage layer is **not currently supported by the platform**. Column-level permissions are also missing.

Internal patterns differ between JS/Python apps and legacy Streamlit apps. They will be documented here once the patterns are firmed up and verified.

**Until then, this section is intentionally empty. Do not invent a pattern based on app-specific code you encounter in customer repos — those are convention-specific to that app, not platform features.**
