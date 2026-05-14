# Storage Access

**Use this when:** the app reads from or writes to Keboola Storage tables.

## Default: RO workspace

When using MCP `modify_data_app`, a `query_data(sql) -> pd.DataFrame` function is injected automatically into the source code via the `{QUERY_DATA_FUNCTION}` placeholder. Use it; don't roll your own.

Behind the scenes:
- Snowflake projects: the function uses the Query Service API.
- BigQuery projects: it uses the Storage API (Query Service does not yet support BigQuery).

The function signature is consistent across backends; the agent doesn't need to know which one it's hitting.

Required env vars (auto-injected by Keboola when the app deploys):
- `KBC_URL`, `KBC_TOKEN` — auth.
- `KBC_WORKSPACE_ID` (or `WORKSPACE_ID`) — workspace identifier.
- `BRANCH_ID` — Storage API branch.

Usage pattern in a Streamlit app:

```python
df = query_data('SELECT * FROM "in.c-main"."customers" LIMIT 100')
st.dataframe(df)
```

## Direct workspace queries (Python/JS without MCP injection)

For Python/JS apps where MCP can't inject the function, query the workspace directly via the Storage API:

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

## RW direct access (Storage Access)

Real-time read AND write to Keboola Storage. **Snowflake only.** BigQuery support is planned.

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

The `query-service-api-python-sdk` and `query-service-api-js-sdk` have first-class `SQL.literal()` / `SQL.ident()` / `sql.format()` helpers in development. Once shipped, prefer them over manual sanitization.

## Input mapping — discouraged for new apps

Snapshot at deploy time. Files appear at `/data/in/tables/<table-name>.csv`. NO write-back. NO fresh data until redeploy.

Use ONLY for static reference data loaded once at deploy time. For everything else, use RO workspace or RW Storage Access.

Read pattern:

```python
import pandas as pd
df = pd.read_csv("/data/in/tables/customers.csv")
```

## Data access management — PLACEHOLDER

Per-user / row-level data access control at the app-storage layer is **not currently supported by the platform**. Column-level permissions are also missing.

Internal patterns differ between JS/Python apps and legacy Streamlit apps. They will be documented here once the patterns are firmed up and verified.

**Until then, this section is intentionally empty. Do not invent a pattern based on app-specific code you encounter in customer repos — those are convention-specific to that app, not platform features.**
