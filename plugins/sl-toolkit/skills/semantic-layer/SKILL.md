---
name: semantic-layer
description: >-
  Semantic layer reference for Keboola. Auto-loads when the user mentions:
  semantic layer, semantic model, SL, metastore, semantic-metric, semantic-dataset,
  semantic-relationship, semantic-glossary, semantic-constraint,
  inspect model, validate model, threshold constraints, metric sql, model entities,
  add dataset, create metric, update metric, delete metric, remove constraint.
  Provides API reference, payload shapes, CRUD procedures, validation rules, and
  operational gotchas so Claude can work with the metastore directly.
---

# Semantic Layer — Reference

Use the commands in this plugin for structured operations:
`/sl-show` · `/sl-validate` · `/sl-build`

For **add / edit / remove** operations, work conversationally — this skill provides
the full CRUD procedures below. No slash command needed.

---

## Auth & Setup

Resolve `TOKEN`, `STACK`, and `METASTORE` using this fallback chain — stop at the first that works:

**1. Environment variables** (no kbagent needed):
```python
import re, os
token     = os.environ.get('KBC_TOKEN', '')
stack_url = os.environ.get('KBC_STACK_URL') or os.environ.get('KBC_URL', '')
if token and stack_url:
    m      = re.search(r'connection\.([\w-]+)\.(gcp|aws|azure)\.keboola\.com', stack_url)
    region = m.group(1) if m else 'us-east4'
    cloud  = m.group(2) if m else 'gcp'
    TOKEN     = token
    STACK     = f'https://connection.{region}.{cloud}.keboola.com'
    METASTORE = f'https://metastore.{region}.{cloud}.keboola.com'
```

**2. kbagent config file** (if kbagent is installed):
```python
import json, re, os
cfg_path = os.path.expanduser('~/Library/Application Support/keboola-agent-cli/config.json')
if os.path.exists(cfg_path):
    cfg = json.load(open(cfg_path))
    for alias in sorted(cfg['projects']): print(alias)  # list for user to pick
    p      = cfg['projects'][PROJECT]   # PROJECT = alias chosen by user from list above
    m      = re.search(r'connection\.([\w-]+)\.(gcp|aws|azure)\.keboola\.com', p['stack_url'])
    region = m.group(1) if m else 'us-east4'
    cloud  = m.group(2) if m else 'gcp'
    TOKEN     = p['token']
    STACK     = f'https://connection.{region}.{cloud}.keboola.com'
    METASTORE = f'https://metastore.{region}.{cloud}.keboola.com'
```

**3. Ask the user** (fallback when neither above works):
Ask for:
- **Storage API token** — Keboola UI → Settings → API Tokens
- **Connection URL** — e.g. `connection.europe-west3.gcp.keboola.com`

Derive STACK and METASTORE from the region and cloud in the connection URL.

Once resolved: `H = {'X-StorageAPI-Token': TOKEN, 'Content-Type': 'application/json'}`

> kbagent is **not required** for CRUD operations or `/sl-show`/`/sl-validate`.
> It is only needed for `/sl-build` (schema + SQL discovery) and `/sl-validate --deep`
> (phantom-field checks against Snowflake).

---

## API Primitives

```python
import urllib.request, json

def api_get(path):
    req = urllib.request.Request(f"{METASTORE}{path}", headers={'X-StorageAPI-Token': TOKEN})
    return json.loads(urllib.request.urlopen(req, timeout=15).read()).get('data', [])

def api_post(path, body):
    req = urllib.request.Request(
        f"{METASTORE}{path}", json.dumps(body).encode(), H, method='POST')
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def api_patch(path, body):
    req = urllib.request.Request(
        f"{METASTORE}{path}", json.dumps(body).encode(), H, method='PATCH')
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def api_delete(path):
    req = urllib.request.Request(f"{METASTORE}{path}", headers=H, method='DELETE')
    urllib.request.urlopen(req, timeout=15)

def db_name():
    """Resolve Snowflake DB for the current project: KEBOOLA_<projectId>.
    Caches to /tmp/sl_db_name.txt for the run. Falls back to 'KEBOOLA' on failure."""
    import sys
    cache = '/tmp/sl_db_name.txt'
    if os.path.exists(cache):
        return open(cache).read().strip()
    try:
        req = urllib.request.Request(f"{STACK}/v2/storage/tokens/verify",
                                      headers={'X-StorageApi-Token': TOKEN})
        pid = json.loads(urllib.request.urlopen(req, timeout=15).read())['owner']['id']
        name = f'KEBOOLA_{pid}'
    except Exception as e:
        print(f"⚠ db_name resolve failed ({e}); falling back to KEBOOLA", file=sys.stderr)
        name = 'KEBOOLA'
    open(cache, 'w').write(name)
    return name
```

**Endpoints:**
```
GET    /api/v1/repository/{type}       → {"data": [...]}
POST   /api/v1/repository/{type}       → {"data": {item}}
PATCH  /api/v1/repository/{type}/{id}  → {"data": {item}}   # in-place update
DELETE /api/v1/repository/{type}/{id}
```

**Types:** `semantic-model` · `semantic-dataset` · `semantic-metric` ·
`semantic-relationship` · `semantic-glossary` · `semantic-constraint`

**Filtering by model:** use `i.get('attributes', {}).get('modelUUID') == UUID`
on the returned list — the `?modelId` query param is unreliable.

**POST envelope (all types except semantic-model):**
```json
{
  "name": "<item name or term>",
  "data": { ...item fields..., "modelUUID": "<UUID>" },
  "branch": "main",
  "schemaVersion": "1.0.0",
  "scope": "project"
}
```

**POST envelope for semantic-model:**
```json
{
  "name": "<model name>",
  "data": { "name": "<model name>", "description": "...", "sql_dialect": "Snowflake" },
  "branch": "main",
  "schemaVersion": "1.0.0",
  "scope": "project"
}
```

---

## Payload Shapes

### semantic-dataset
```json
{
  "name": "fact_revenue",
  "tableId": "out.c-gold.FACT_REVENUE",
  "fqn": "\"KEBOOLA_293\".\"out.c-gold\".\"FACT_REVENUE\"",
  "description": "...",
  "grain": "one row per transaction",
  "primaryKey": ["PK_REVENUE"],
  "fields": [
    { "name": "PK_REVENUE", "type": "string",  "role": "key",       "description": "..." },
    { "name": "AMOUNT",     "type": "decimal",  "role": "measure",   "description": "..." },
    { "name": "PERIOD",     "type": "string",   "role": "dimension", "description": "..." },
    { "name": "INS_DT",     "type": "datetime", "role": "timestamp", "description": "..." }
  ]
}
```

**FQN** — split tableId on last dot only; first segment is the project-specific Snowflake DB:
```python
def fqn(tid, db):
    t = tid.split('.')
    return f'"{db}"."{".".join(t[:-1])}"."{t[-1]}"'
# fqn("out.c-gold.FACT_REVENUE", db_name())
# → "KEBOOLA_293"."out.c-gold"."FACT_REVENUE"
```
Resolve the DB once per run via `db_name()` (defined in API Primitives above) — it queries
the storage token-verify endpoint and caches `KEBOOLA_<projectId>` to `/tmp/sl_db_name.txt`.
**Never hardcode `KEBOOLA`** — real projects use `KEBOOLA_<projectId>` (e.g. `KEBOOLA_293`)
and a bare `KEBOOLA` reference will fail at Snowflake query time.

**Field roles:**
- `PK_*/FK_*` → `key`
- `*_DATE / DATE_* / INS_DT / UPD_DT` → `timestamp`
- Numeric amounts / values / rates → `measure`
- Everything else → `dimension`

**Field types:** use actual Snowflake type from `column_details[].type`.
`STRING`→`string` · `NUMERIC`→`decimal` or `integer` · never override STRING to boolean/date.

### semantic-metric
```json
{
  "name": "Total Revenue",
  "sql": "SUM(\"FACT_REVENUE\".\"AMOUNT\")",
  "dataset": "out.c-gold.FACT_REVENUE",
  "description": "..."
}
```
- `dataset` field is the **tableId**, not the dataset name
- `SUM`/`AVG`/`COUNT(DISTINCT)` on real columns only
- Never `SUM` a `_PCT`/ratio column — use `AVG`
- VERSION tables: only generate `SUM(CASE WHEN "T"."<col>" = '<value>' THEN ...)` metrics
  **after probing the column's actual distinct values**. Use the kbagent `query_data` MCP
  tool from `/sl-build` Step 2.5 (writes `/tmp/sl_version_samples.json`) — or for ad-hoc use:
  ```python
  import subprocess, json, csv, io
  payload = json.dumps({'query_name': f'probe {COL}',
      'sql_query': f'SELECT DISTINCT "{COL}" AS V FROM "{SCHEMA}"."{TABLE}" LIMIT 20'})
  r = subprocess.run(['kbagent','--json','tool','call','query_data',
                      '--project', PROJECT, '--input', payload],
                     capture_output=True, text=True)
  d = json.loads(r.stdout)['data']
  samples = set()
  for res in d.get('results', []):
      if res.get('isError'): continue
      for piece in res.get('content', []):
          p = json.loads(piece) if isinstance(piece, str) else piece
          csv_text = p.get('csv_data', '') if isinstance(p, dict) else ''
          for row in csv.DictReader(io.StringIO(csv_text)):
              if row.get('V'): samples.add(row['V'])
  ```
  Apply the VERSION rule **only if** `samples` contains a recognized literal — case-insensitive
  match against `{actual, budget, plan, forecast, baseline, target}`. Substitute the actual
  literal value from `samples` (preserve case) into the SQL. **If none match**, skip the
  VERSION-conditional metric and note in the model description: *"VERSION-style breakdown
  not generated for `<col>` — distinct values were `<samples>`."*

### semantic-relationship
```json
{
  "name": "fact_revenue_to_time",
  "from": "out.c-gold.FACT_REVENUE",
  "to":   "out.c-gold.DIM_DATE",
  "on":   "\"FACT_REVENUE\".\"PERIOD\" = \"DIM_DATE\".\"PK_DATE\"",
  "type": "left"
}
```
- `from`/`to` are tableIds · `on` uses bare table names (last segment of tableId)
- `type`: `left` or `inner`

### semantic-glossary
```json
{ "term": "EBITDA", "definition": "Earnings before interest, taxes, depreciation and amortization." }
```

### semantic-constraint
```json
{
  "name": "net_margin_critical",
  "constraintType": "range",
  "metrics": ["Net Profit Margin"],
  "ruleExpression": { "bounds": { "min": -2.0, "max": 0.05 } },
  "severity": "error"
}
```
- `severity` API accepts only: `error` / `warning` / `info`
- Encode 4-level health bands in the **name suffix**: `_critical` / `_warning` / `_healthy` / `_review`
- Downstream pipelines parse the suffix; `severity` is secondary
- `metrics[]` must contain **exact metric names** — any mismatch creates orphan FKs in DIM_METRIC_THRESHOLD
- `bounds`: omit `max` for open-ended upper bound (store as NULL downstream, never as 0)

---

## Validation Rules

When checking a model, flag these as errors:

- **PHANTOM FIELD** — field name not present in actual Snowflake table columns
- **DANGLING REL** — relationship `from`/`to` tableId not in any dataset
- **REL PHANTOM** — column in relationship `on` clause not in its table
- **DANGLING METRIC** — metric `dataset` tableId not in any dataset
- **METRIC PHANTOM** — column referenced in metric `sql` not in its table
- **AGG ON STRING** — `SUM`/`AVG` directly on a STRING column
- **SUM ON PCT** — `SUM(...)` where column name contains `PCT`
- **DUPLICATES** — duplicate `name` within datasets/metrics/relationships, or `term` in glossary
- **CONSTRAINT ORPHAN** — constraint `metrics[]` entry has no matching semantic-metric name

Warn (non-blocking):
- Constraint name lacks `_critical/_warning/_healthy/_review` suffix

---

## CRUD Operations

Use these procedures when the user asks to add, edit, or remove model entities conversationally.
Always resolve TOKEN, METASTORE, and MODEL_UUID first (see Auth & Setup above).

### Add an entity

Build the payload using the shapes above. Show the user the payload before POSTing.
**All CRUD blocks assume `api_get`/`api_post`/`api_delete` from API Primitives are defined.**

```python
import urllib.error

TYPE = 'semantic-metric'   # replace with actual type
ITEM = { }                 # replace with actual payload

body = {
    "name": ITEM.get('name') or ITEM.get('term'),
    "data": {**ITEM, "modelUUID": MODEL_UUID},
    "branch": "main", "schemaVersion": "1.0.0", "scope": "project"
}
try:
    r = api_post(f"/api/v1/repository/{TYPE}", body)
    print(f"✓ Created {r['data']['id']}")
except urllib.error.HTTPError as e:
    print(f"✗ {e.code}: {e.read().decode()[:300]}")
```

**Before adding a constraint** — verify every name in `metrics[]` is an existing semantic-metric
or the constraint will create orphan FKs in downstream DIM_METRIC_THRESHOLD tables.

### Edit an entity

**Edit in place with `PATCH`.** Send only the fields that change — the object keeps its UUID and
gains a revision, so history is preserved and anything referencing it by UUID stays valid.
Always show the diff to the user and get confirmation before proceeding.

```python
import urllib.error, re

# 1. Fetch and find item
TYPE = 'semantic-metric'   # replace with actual type
all_items = api_get(f"/api/v1/repository/{TYPE}")
items  = [i for i in all_items if i.get('attributes', {}).get('modelUUID') == MODEL_UUID]
target = next((i for i in items
               if i['attributes'].get('name','').lower() == TARGET_NAME.lower()), None)
if not target:
    print("Not found. Available:", [i['attributes'].get('name') for i in items])

# 2. Decide the change (a partial patch — not the whole object)
OLD_NAME = target['attributes'].get('name', '')
CHANGES  = {}                       # e.g. {'sql': '<new sql>'} or {'name': 'Total Revenue'}
NEW_NAME = CHANGES.get('name', OLD_NAME)

# 3. If renaming a metric — find constraints to cascade-update
is_rename = TYPE == 'semantic-metric' and NEW_NAME != OLD_NAME
affected_constraints = []
if is_rename:
    all_c = api_get("/api/v1/repository/semantic-constraint")
    affected_constraints = [
        c for c in all_c
        if c.get('attributes', {}).get('modelUUID') == MODEL_UUID
        and OLD_NAME in (c.get('attributes', {}).get('metrics') or [])
    ]
    old_code = re.sub(r"[^A-Z0-9]+", "_", OLD_NAME.upper())
    new_code = re.sub(r"[^A-Z0-9]+", "_", NEW_NAME.upper())
    print(f"CODE_METRIC: {old_code} → {new_code}  ⚠ update any pipeline SQL joining on this key")
    if affected_constraints:
        print(f"Constraints to auto-update: {[c['attributes']['name'] for c in affected_constraints]}")

# 4. PATCH in place. Include `name` at the envelope top level only when it changed,
#    so the metastore's own `meta.name` stays in sync with the payload.
body = {"data": CHANGES}
if is_rename or 'term' in CHANGES:
    body["name"] = CHANGES.get('name') or CHANGES.get('term')
try:
    r = api_patch(f"/api/v1/repository/{TYPE}/{target['id']}", body)
    print(f"✓ Updated {r['data']['id']} (revision {r['data'].get('meta', {}).get('revision')})")
except urllib.error.HTTPError as e:
    # Nothing was deleted, so there is nothing to roll back — the object is untouched.
    print(f"✗ PATCH failed ({e.code}): {e.read().decode()[:300]}")
    raise

# 5. Cascade constraint updates on rename — also in place
for c in affected_constraints:
    metrics = [NEW_NAME if m == OLD_NAME else m for m in (c['attributes'].get('metrics') or [])]
    try:
        api_patch(f"/api/v1/repository/semantic-constraint/{c['id']}", {"data": {"metrics": metrics}})
        print(f"  ✓ Constraint updated: {c['attributes']['name']}")
    except urllib.error.HTTPError as e:
        print(f"  ✗ {c['attributes']['name']}: {e.code}")
```

> **Do not edit by DELETE + POST.** It destroys the object's UUID and revision history, breaks
> anything referencing it by UUID, and opens a window where the layer is missing an object if the
> POST fails. `PATCH` has none of those problems.

> **⚠ Dataset/relationship renames** are not cascaded. Renaming a dataset's *semantic name* is
> safe. Changing its `tableId` breaks all metrics and relationships pointing to it — coordinate
> those changes manually.

### Remove an entity

Always confirm with the user before deleting. For metrics, check constraint references first.

```python
TYPE = 'semantic-metric'   # replace with actual type
# (find target same as Edit step 1 above)

# Check constraint references before deleting a metric
if TYPE == 'semantic-metric':
    all_c = api_get("/api/v1/repository/semantic-constraint")
    refs = [c['attributes']['name'] for c in all_c
            if target['attributes']['name'] in (c.get('attributes', {}).get('metrics') or [])]
    if refs:
        print(f"⚠ Constraints referencing this metric: {refs}")
        print("Deleting will create orphan entries in downstream DIM_METRIC_THRESHOLD.")
        # Ask user to confirm before continuing

# Delete
api_delete(f"/api/v1/repository/{TYPE}/{target['id']}")
print(f"✓ Deleted: {target['attributes'].get('name')}")
```

---

## Operational Gotchas

**Renaming a metric changes its CODE_METRIC** — downstream pipelines derive
`CODE_METRIC = re.sub(r"[^A-Z0-9]+","_", name.upper()).strip("_")`. Any SQL
joining on `CODE_METRIC` breaks silently if a metric is renamed. Prefer additive changes.

**Constraint severity has only 3 API levels** — `error`/`warning`/`info` isn't enough
for 4-band health UIs. Encode real severity in the constraint name suffix instead.

**`sql_dialect` is snake_case and a closed set** — exactly `'Snowflake'` or `'BigQuery'`,
capitalized. camelCase `sqlDialect` is rejected with `422 missing property 'sql_dialect'`,
and a lowercase value with `422 value must be one of 'Snowflake', 'BigQuery'`. Both errors
surface only as a generic "Validation failed", so they are easy to misdiagnose. Take the
project's real backend from the stack rather than assuming Snowflake.

**modelUUID differs per project** — dev and prod have different UUIDs for the same
logical model. When promoting, fetch the target project's model list to find its UUID,
then replace `modelUUID` on each item before POSTing.

**Snapshot before destructive changes:**
```python
for t in ['semantic-metric','semantic-dataset','semantic-glossary',
          'semantic-constraint','semantic-relationship']:
    json.dump(api_get(f'/api/v1/repository/{t}'),
              open(f'/tmp/sl_backup_{t}.json','w'), indent=2)
```

**Edit with PATCH, never DELETE + POST** — `PATCH /api/v1/repository/{type}/{id}` updates in place,
preserving the object's UUID and bumping its revision. Deleting and re-posting mints a new UUID,
resets revision history, breaks anything referencing the old UUID, and can leave the layer missing
an object if the POST fails.
