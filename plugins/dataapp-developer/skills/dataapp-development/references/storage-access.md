# Storage Access

**Use this when:** the app reads from or writes to Keboola Storage tables.

## Getting the env vars for local development

Production: Keboola auto-injects these as env vars from `dataApp.secrets` when the app deploys. Local dev: the **user** sets them yourself, once per machine, from values in the Keboola project UI.

The Python/JS templates load local env vars from `.env` or `.env.local` (both supported; `.env.local` overrides `.env` if both exist). Pick whichever fits your project. Both filenames must be gitignored. The Streamlit template uses `.streamlit/secrets.toml` instead, matching the Streamlit convention.

**Agent: pre-fill what you can, ask for what's missing, then offer to run.** When the local file is missing or incomplete, **do NOT grep the filesystem, scan shell history, or probe unrelated environment variables hoping to find something that looks like a token.** That's a security smell. Do this proactively instead:

1. **Pre-create `.env.local`** (or `.streamlit/secrets.toml` for Streamlit) with every required key. Resolve the values you can yourself: `mcp__keboola__get_project_info` returns `branch_id`, `workspace_id`, and the project URL (which gives you `KBC_URL` and lets you derive `QUERY_SERVICE_URL` by swapping `connection.` → `query.`). Use those to populate the file. Only the user's Storage API token (`KBC_TOKEN`) is genuinely user-input.
2. **Check whether `KBC_TOKEN` is already set** in the shell environment, in `.env.local`, or in `.streamlit/secrets.toml`. Looking up a specific named variable is fine; scanning every env var is not. If it's already there, skip the next step.
3. **If `KBC_TOKEN` is missing**, tell the user exactly which value you still need and point them at §`KBC_TOKEN` for where to fetch it in the Keboola UI. Wait for confirmation that they've filled it in.
4. **Once `.env.local` is complete, offer to start the app** with the right command for the framework so the user can preview it (`uv run streamlit run streamlit_app.py`, `npm run dev`, `node --watch server.js`, `uv run uvicorn ...`). Don't auto-start without asking — the user might want to inspect first.

This is non-negotiable for local-dev credentials regardless of which path the user chose (MCP, kbagent, or git). The goal is: user provides the one secret value, the agent does everything else.

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

Storage API token. **In production, the platform injects this automatically** — `KBC_TOKEN` is a reserved env var name and you **must NOT add `#KBC_TOKEN`** to `dataApp.secrets` (it would collide with the platform value).

For **local development** the token has to be project-wide. Narrow-scoped (single-bucket / single-table) Storage API tokens **do not work with the Query Service** — calls fail with auth errors. The Query Service evaluates access at the workspace level, and only project-wide tokens carry the required grants.

Two ways to obtain a usable token:

1. **Master token of your user account.** Refresh it via the Keboola UI (Settings → API Tokens → your own token → Refresh) or grab the current value via the **Keboola Dev Tools** Chrome extension. This token is full-power and tied to your identity; treat it like a password.
2. **Dedicated project-wide Storage API token.** Settings → API Tokens → New Token → check **Full Access** to all buckets and components. Give it a descriptive name (e.g. `my-app-local-dev`) so you can revoke it later without touching anyone else's tokens. Copy the value immediately — Keboola shows it once.

Whichever you pick, paste the value into `.env.local` as `KBC_TOKEN=...`. Treat it like a password: never commit it, never paste it in screenshots / chat / Slack. Add `.env.local` to `.gitignore` if it isn't already.

### WORKSPACE_ID

A provisioned compute workspace (Snowflake by default; BigQuery on BigQuery-backed projects). The right way to obtain one depends on whether the app reads or also writes.

**Note on naming:** the platform-injected env var is `WORKSPACE_ID` — **without** a `KBC_` prefix. (The manifest path env var is `KBC_WORKSPACE_MANIFEST_PATH`, which **does** carry the prefix — Keboola's naming isn't consistent here, this is just the convention.) Older code or earlier drafts of this skill may show `KBC_WORKSPACE_ID`; that's wrong. Use `WORKSPACE_ID` everywhere — local `.env` / `.streamlit/secrets.toml`, production `dataApp.secrets`, and code.

**Read-only data app — reuse the MCP session's workspace.** Call `mcp__keboola__get_project_info` and read the `workspace_id` field. That's the workspace the agent's MCP session is already using; it has read access to everything in the project. Paste it into `.env.local` and you're done. No need to create a new workspace just for local dev.

**Read-write data app — create a dedicated workspace.** The platform provisions an ephemeral, permission-scoped workspace at deploy time, but that workspace doesn't exist locally. For local testing of writes, you need to create your own workspace with grants matching the production setup:

- Via the UI: project → **Workspaces** → **New Workspace** → Snowflake/BigQuery → pick a size (XS or S is enough). Open the workspace detail and grant it write access on the same tables the app's `direct-grant` output mapping covers.
- Via kbagent (if you're already on that path): `kbagent workspace create ...` then grant the same tables.

In both cases, use the numeric ID (e.g. `12345`), not the Snowflake schema name (e.g. `WORKSPACE_12345`). See [troubleshooting.md](troubleshooting.md) for the prefix-stripping pattern if you ever encounter the latter.

Notes:
- One read-only workspace can serve multiple local-dev sessions across developers — no need to provision per-person.
- Never reuse a write-enabled local workspace for production data app deployment. The platform owns workspace provisioning for deployed apps and uses ephemeral, fresh-on-each-start workspaces with `direct-grant` output mappings (see "Read-write direct access" below).

### BRANCH_ID

Defaults to `default` (production). Almost always leave it that way.

**Important context:** data apps themselves only live in the **production branch** — the platform does not deploy or run data apps from development branches. So `BRANCH_ID` is not about where the app runs (it always runs in production), but about which branch's tables the app reads from at runtime.

You only need to set `BRANCH_ID` explicitly if:

- The app needs to read tables that live in a **development branch** (e.g. previewing data from an in-progress migration before it lands in production).
- In that case, find the numeric branch ID in the project UI under **Development Branches** — the URL of the branch shows it.

For every other case → omit `BRANCH_ID` (or set it to `default`) and the app reads production tables.

**Local dev with direct Query Service calls needs a numeric `BRANCH_ID`.** The string `"default"` is rejected by the Query Service with a parse error. Don't construct an HTTP call to `/v2/storage/dev-branches` — call `mcp__keboola__get_project_info` and read:

- `branch_id` — the numeric ID to paste into `.env.local`.
- `is_development_branch` — confirms which branch the MCP session is currently scoped to. **Must be `false`** before relying on `branch_id`. If `true`, the MCP is in a dev-branch context — switch to the production branch in your MCP setup and re-run, otherwise you'll paste a dev-branch ID into `.env.local` and the app will read dev-branch tables locally.

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
- **Query Service via the official SDK** — for Python/JS apps without MCP injection, call the Query Service API (`https://query.<stack>.keboola.com/api/v1/...`) using `keboola-query-service` (Python) or `@keboola/query-service` (JS/TS). The SDK handles submit + poll + paginate; you call `executeQuery({ branchId, workspaceId, statements })` and get back columns + rows.

**Do NOT post to `/v2/storage/branch/<b>/workspaces/<w>/query`.** That was an older Storage API workspace-query endpoint that survives in some docs and templates, but it returns `workspace.workspaceNotFound` 404s on most Snowflake projects today. Use the Query Service.

Required env vars (Keboola auto-injects on deploy when Storage Access is enabled):
- `KBC_URL`, `KBC_TOKEN` — auth + base host.
- `QUERY_SERVICE_URL` — Query Service host. If unset, derive from `KBC_URL` by swapping `connection.` → `query.` (`https://connection.us-east4.gcp.keboola.com` → `https://query.us-east4.gcp.keboola.com`).
- `KBC_WORKSPACE_MANIFEST_PATH` — JSON file with `{ "workspaceId": "..." }`. Preferred source per the docs; falls back to the `WORKSPACE_ID` env var (numeric).
- `BRANCH_ID` — **must be numeric.** Query Service rejects the string `"default"`. Get it from `mcp__keboola__get_project_info.branch_id`.

Behind the scenes:
- Snowflake projects → Query Service API (this is the path you'll be on >95% of the time).
- BigQuery projects → Storage API workspace-query endpoint (Query Service does not yet support BigQuery — this is the legacy path's one remaining use case).

The MCP-injected `query_data` function signature is consistent across backends; the SDK is also consistent. The agent doesn't need to know which one it's hitting unless they're on the BigQuery path explicitly.

Usage pattern in a Streamlit app (Snowflake project, Query Service path):

```python
df = query_data('SELECT * FROM "KBC_REGION_PROJID"."in.c-main"."customers" LIMIT 100')
st.dataframe(df)
```

**Always use the full fully-qualified name** — `"<DATABASE>"."<BUCKET>"."<TABLE>"`. Get the exact string from `mcp__keboola__get_table`'s `fully_qualified_name` field (or the equivalent `fqn` field returned by other MCP tools). The database prefix is required: without it, the session default database only sees in-project tables, so any Data Catalog (cross-project linked) tables fail to resolve. Data apps always run in the production branch, so the FQN you get from MCP against main is the right one for the deployed app.

### Query Service SDK call shape

Python (`keboola-query-service`):

```python
import os
from keboola_query_service import Client

base_url = os.environ.get("QUERY_SERVICE_URL") or os.environ["KBC_URL"].replace(
    "://connection.", "://query.", 1
)
client = Client(base_url=base_url, token=os.environ["KBC_TOKEN"])

results = client.execute_query(
    branch_id=os.environ["BRANCH_ID"],   # numeric, not "default"
    workspace_id=os.environ["WORKSPACE_ID"],
    statements=['SELECT * FROM "KBC_REGION_PROJID"."in.c-main"."customers" LIMIT 100'],
)
result = results[0]
cols = [c.name for c in result.columns]
rows = [dict(zip(cols, row)) for row in result.data]
```

JS/TS (`@keboola/query-service`):

```javascript
import { Client } from '@keboola/query-service';

const baseUrl =
  process.env.QUERY_SERVICE_URL ||
  process.env.KBC_URL.replace('://connection.', '://query.');
const client = new Client({ baseUrl, token: process.env.KBC_TOKEN });

const [result] = await client.executeQuery({
  branchId: process.env.BRANCH_ID,           // numeric
  workspaceId: process.env.WORKSPACE_ID,
  statements: ['SELECT * FROM "KBC_REGION_PROJID"."in.c-main"."customers" LIMIT 100'],
});
const cols = result.columns.map((c) => c.name);
const rows = result.data.map((row) =>
  Object.fromEntries(cols.map((name, i) => [name, row[i]])),
);
```

The SDKs handle the submit-job → poll-status → paginate-results dance internally. Don't hand-roll that — it's three endpoints, eventual consistency, and partial-page edge cases.

### How to know which backend you're on

Call `mcp__keboola__get_project_info` and read the `sql_dialect` field:
- `"Snowflake"` → use the **Query Service** as shown above. This is the default path for >95% of projects.
- `"BigQuery"` → use the **Storage API workspace-query endpoint** shown below. Query Service does not support BigQuery yet.

There are no other dialects today. If `sql_dialect` is missing or returns something else, stop and ask the user before guessing.

### BigQuery path — Storage API workspace-query endpoint

For BigQuery projects, the Query Service warnings above don't apply — you DO post to `{KBC_URL}/v2/storage/branch/<branch>/workspaces/<workspace>/query`. That endpoint is the only way to query a BigQuery workspace today. The call is synchronous (no submit/poll/paginate) and returns rows as dicts with native types — no string coercion needed.

Required env vars: `KBC_URL`, `KBC_TOKEN`, `WORKSPACE_ID` (numeric, strip any `WORKSPACE_` prefix), `BRANCH_ID` (can be the string `"default"` here — the Storage API accepts it, unlike Query Service).

Python:

```python
import os
import pandas as pd
import requests

def query_data(sql: str) -> pd.DataFrame:
    endpoint = (
        f"{os.environ['KBC_URL']}/v2/storage/branch/"
        f"{os.environ.get('BRANCH_ID', 'default')}/workspaces/"
        f"{os.environ['WORKSPACE_ID']}/query"
    )
    response = requests.post(
        endpoint,
        headers={"X-StorageAPI-Token": os.environ["KBC_TOKEN"]},
        json={"query": sql},
        timeout=60,
    )
    response.raise_for_status()
    body = response.json()
    if body.get("status") == "error":
        raise ValueError(body.get("message"))
    return pd.DataFrame(body["data"]["rows"])
```

JS/TS:

```javascript
async function runQuery(sql) {
  const endpoint =
    `${process.env.KBC_URL}/v2/storage/branch/` +
    `${process.env.BRANCH_ID || 'default'}/workspaces/` +
    `${process.env.WORKSPACE_ID}/query`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-StorageAPI-Token': process.env.KBC_TOKEN,
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`Workspace query failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  if (body.status === 'error') throw new Error(body.message);
  return body.data.rows;  // array of { column_name: value } with native types
}
```

A few things worth noting on the BQ path that differ from Query Service:

- **Rows arrive as objects keyed by column name**, not arrays + separate columns metadata. Iterate directly.
- **Cell values are native types** (numbers, booleans, ISO strings for timestamps) — the string-cell coercion you do on the Query Service path is unnecessary here.
- **No submit/poll/paginate.** The endpoint returns the full result in one synchronous response. For very large result sets, add a `LIMIT` on the SQL side; the response doesn't paginate.
- **The skill's templates (`templates/streamlit/`, `templates/nodejs-app/`) are wired for Snowflake / Query Service.** If you start from a template on a BigQuery project, you'll need to swap `data_loader.py` / `keboola-client.js` to use the pattern above and remove the `keboola-query-service` / `@keboola/query-service` dependency.

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

**Bucket stage doesn't restrict writes.** The destination can be in any stage — `out.`, `in.`, or otherwise — as long as the workspace has write privileges on it. The `out.` examples here are convention; writing back into an `in.` bucket your workspace owns is equally valid. The `direct-grant` strategy is what makes the grant work; the bucket-name prefix is just a label.

Workspace lifecycle: **ephemeral**. A fresh workspace is created each time the app starts or wakes from sleep. The previous workspace is deleted. Permission changes take effect on the next start.

Env vars set when Storage Access is enabled:
- `KBC_WORKSPACE_MANIFEST_PATH` — path to a JSON manifest with `workspaceId` and other metadata. **Preferred source for the workspace ID.**
- `WORKSPACE_ID`, `BRANCH_ID`, `QUERY_SERVICE_URL`, `KBC_TOKEN`.

`QUERY_SERVICE_URL` is the project's Query Service host — `https://query.<stack>.keboola.com`, derived from `KBC_URL` by replacing the `connection.` subdomain prefix with `query.` (e.g. `https://connection.keboola.com` → `https://query.keboola.com`, `https://connection.us-east4.gcp.keboola.com` → `https://query.us-east4.gcp.keboola.com`). In production Keboola injects this directly. In local dev you can either set it explicitly in `.env.local` or compute it from `KBC_URL` in code.

Library:
- Python: `keboola-query-service`
- JS/TS: `@keboola/query-service`

### Wrap the SDK in a single module

Concentrate all env-var reads and SDK construction in one wrapper module. The rest of the app calls `select(sql)` / `execute(sql)` — it never touches `os.environ` or the raw `Client`. Module-level singleton initialisation fails fast on missing env vars, before the first request.

**Python** (`storage.py`):

```python
"""Thin wrapper around keboola-query-service Client."""
import json
import os
from typing import Any

try:  # dev-only — silently ignored in container
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except ImportError:
    pass

from keboola_query_service import Client


class Storage:
    def __init__(self) -> None:
        self.branch_id = os.environ["BRANCH_ID"]
        with open(os.environ["KBC_WORKSPACE_MANIFEST_PATH"]) as f:
            self.workspace_id = json.load(f)["workspaceId"]
        self.client = Client(
            base_url=os.environ["QUERY_SERVICE_URL"],
            token=os.environ["KBC_TOKEN"],
        )

    def select(self, sql: str) -> list[dict[str, Any]]:
        result = self.client.execute_query(
            branch_id=self.branch_id,
            workspace_id=self.workspace_id,
            statements=[sql],
        )[0]
        cols = [c.name for c in result.columns]
        return [dict(zip(cols, row)) for row in result.data]

    def execute(self, sql: str) -> None:
        self.client.execute_query(
            branch_id=self.branch_id,
            workspace_id=self.workspace_id,
            statements=[sql],
        )


storage = Storage()  # module-level singleton
```

**Node.js / TypeScript** (`storage.ts`):

```typescript
import { readFileSync } from 'node:fs';
import { Client } from '@keboola/query-service';

const branchId = process.env.BRANCH_ID!;
const workspaceId = JSON.parse(
  readFileSync(process.env.KBC_WORKSPACE_MANIFEST_PATH!, 'utf8'),
).workspaceId as string;

const client = new Client({
  baseUrl: process.env.QUERY_SERVICE_URL!,
  token: process.env.KBC_TOKEN!,
});

export async function select<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const [result] = await client.executeQuery({ branchId, workspaceId, statements: [sql] });
  const cols = result.columns.map((c) => c.name);
  return result.data.map((row: unknown[]) =>
    Object.fromEntries(cols.map((name, i) => [name, row[i]])) as T,
  );
}

export async function execute(sql: string): Promise<void> {
  await client.executeQuery({ branchId, workspaceId, statements: [sql] });
}
```

Load `.env` once in your app entrypoint (`server.ts` / `server.js`) **before** importing `storage.ts` — keeping dotenv out of the wrapper makes it portable across ESM and CJS:

```typescript
import 'dotenv/config';
import { select, execute } from './storage.js';
```

Usage from the rest of the app:

```python
# Python
rows = storage.select('SELECT "id", "name" FROM "KBC_REGION_PROJID"."in.c-main"."customers" LIMIT 100')
storage.execute('INSERT INTO "KBC_REGION_PROJID"."out.c-data-app"."events" ("id","name") VALUES (\'abc-123\',\'Click\')')
```

```typescript
// TypeScript
const rows = await select<{ id: string; name: string }>(
  'SELECT "id", "name" FROM "KBC_REGION_PROJID"."in.c-main"."customers" LIMIT 100',
);
await execute(`INSERT INTO "KBC_REGION_PROJID"."out.c-data-app"."events" ("id","name") VALUES ('abc-123','Click')`);
```

### SQL injection — validate every interpolated value

The Query Service accepts raw SQL and does **NOT** support parameterized queries / bind variables. Every value the app interpolates into SQL must be validated and escaped explicitly. Concentrate validation in one module so route handlers can't accidentally bypass it.

**Python** (`validation.py`):

```python
"""Validate and escape every value that goes into SQL."""
from typing import Final

ALLOWED_STATUSES: Final[frozenset[str]] = frozenset({"pending", "approved", "rejected"})
MAX_TEXT_LEN: Final[int] = 200


class ValidationError(ValueError):
    pass


def parse_int(v, field: str) -> int:
    try:
        return int(v)
    except (TypeError, ValueError) as e:
        raise ValidationError(f"{field} must be an integer") from e


def parse_status(v) -> str:
    s = (v or "").strip().lower()
    if s not in ALLOWED_STATUSES:
        raise ValidationError(f"status must be one of {sorted(ALLOWED_STATUSES)}")
    return s


def escape_sql_text(v, field: str) -> str:
    """Returns inner content; caller wraps in single quotes."""
    if not isinstance(v, str):
        raise ValidationError(f"{field} must be a string")
    if len(v) > MAX_TEXT_LEN:
        raise ValidationError(f"{field} exceeds {MAX_TEXT_LEN} characters")
    return v.replace("'", "''")
```

**TypeScript** (`validation.ts`):

```typescript
export class ValidationError extends Error {}

const ALLOWED_STATUSES = new Set(['pending', 'approved', 'rejected']);
const MAX_TEXT_LEN = 200;

export function parseInt32(v: unknown, field: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < -2_147_483_648 || n > 2_147_483_647) {
    throw new ValidationError(`${field} must be a 32-bit integer`);
  }
  return n;
}

export function parseStatus(v: unknown): string {
  const s = String(v ?? '').trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(s)) {
    throw new ValidationError(`status must be one of ${[...ALLOWED_STATUSES].join(', ')}`);
  }
  return s;
}

export function escapeSqlText(v: unknown, field: string): string {
  if (typeof v !== 'string') throw new ValidationError(`${field} must be a string`);
  if (v.length > MAX_TEXT_LEN) throw new ValidationError(`${field} exceeds ${MAX_TEXT_LEN} characters`);
  return v.replace(/'/g, "''");
}
```

### Rules of thumb for SQL values

Apply in any language:

- **Numeric fields** — coerce to a native number (Python `int()` / `float()`, JS `Number()` + `Number.isFinite` / `Number.isInteger`), then interpolate as a bare numeric. Don't quote.
- **Dates / times** — parse strictly (Python `datetime.date.fromisoformat`, JS `new Date(iso)` + `isNaN(d.getTime())` rejection), then format to whatever the column expects.
- **Categorical fields** — enforce against a hard-coded allow-list (Python `frozenset`, JS `Set`). Reject anything not in it.
- **Free-text fields** — length-cap, then double single quotes (`'` → `''`). Wrap in single quotes at interpolation site.
- **Generated IDs** — use a UUID (`uuid.uuid4().hex` in Python, `crypto.randomUUID()` in Node ≥ 14.17). Never `MAX(id)+1` — race conditions, plus Storage columns are typically `STRING` anyway.

First-class `SQL.literal()` / `SQL.ident()` / `sql.format()` helpers are in development in the Python and JS Query Service SDKs. Once shipped, prefer them over manual sanitization. SDK source repos are listed in [glossary.md](glossary.md) §Libraries.

## Query Service return shape — cells come back as strings

Applies to the Snowflake Query Service path — both direct RO workspace queries to the Query Service and Storage Access reads/writes via `keboola-query-service` / `@keboola/query-service`. BigQuery responses (via the Storage API workspace endpoint) return native types and don't need this conversion.

The shape:

- `result.columns: [{ name, type, nullable, length? }]` — column metadata.
- `result.data: T[][]` — rows are **arrays of cells**, not objects. The cells are paired with `columns` by index.
- **Every cell value is a string regardless of SQL `CAST`.** A `COUNT(*)` result comes through as `"42"`, not `42`. A boolean as `"true"`. A timestamp as a string in the underlying database's serialization format.

This is documented behavior of the MCP-injected `query_data` function. Hand the raw strings to a chart library that expects numbers (e.g. `value.toFixed()`) and it crashes — usually as a silent white screen in React without an ErrorBoundary, or a less obvious type error in Streamlit.

**Python (recommended pattern for the MCP-injected `query_data`):**

```python
df = query_data('SELECT "id", "value", "created_at" FROM "KBC_REGION_PROJID"."in.c-main"."events"')
df['value'] = pd.to_numeric(df['value'], errors='coerce').fillna(0)
df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
```

The DataFrame's dtype stays `object` (string) until you explicitly convert. Convert at the boundary — once, right after the query — not inside every chart.

**JavaScript (when using `@keboola/query-service` directly):** zip `result.data` with `result.columns` to produce objects, and coerce numeric columns. Inspect the actual `column.type` values returned by the API for your project — they're driver-dependent (lowercase internal Snowflake names like `"text"`, `"fixed"`, `"real"`, `"timestamp_ntz"` have been observed). Don't hand the raw `result.data` straight to the UI layer.

```javascript
function toObjects(result) {
  const columns = result?.columns ?? [];
  const rows = result?.data ?? [];
  // Whitelist of column-type substrings that mean "this is numeric, coerce".
  // Inspect column.type from your actual API responses and expand as needed.
  const NUMERIC_TYPE = /^(fixed|real|number|float|double|decimal|integer|int|bigint|smallint|tinyint|numeric)$/i;
  const isNumeric = columns.map((c) => NUMERIC_TYPE.test(c?.type ?? ''));
  return rows.map((row) => {
    const out = {};
    for (let i = 0; i < columns.length; i++) {
      const raw = row[i];
      if (raw == null) {
        out[columns[i].name] = null;
      } else if (isNumeric[i] && typeof raw === 'string' && raw !== '') {
        const n = Number(raw);
        out[columns[i].name] = Number.isFinite(n) ? n : raw;
      } else {
        out[columns[i].name] = raw;
      }
    }
    return out;
  });
}
```

Over-coercing (calling `Number(raw)` on every cell) is just as bad as under-coercing — a zero-padded string like `"00"` becomes the number `0`, and any downstream `.localeCompare()` call crashes because numbers don't have it. Coerce only the columns you know are numeric.

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
