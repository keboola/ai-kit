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

Resolve `TOKEN` and `METASTORE` using this fallback chain — stop at the first that works:

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
    METASTORE = f'https://metastore.{region}.{cloud}.keboola.com'
```

**3. Ask the user** (fallback when neither above works):
Ask for:
- **Storage API token** — Keboola UI → Settings → API Tokens
- **Connection URL** — e.g. `connection.europe-west3.gcp.keboola.com`

Derive METASTORE from the region and cloud in the connection URL.

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

def api_delete(path):
    req = urllib.request.Request(f"{METASTORE}{path}", headers=H, method='DELETE')
    urllib.request.urlopen(req, timeout=15)
```

**Endpoints:**
```
GET    /api/v1/repository/{type}       → {"data": [...]}
POST   /api/v1/repository/{type}       → {"data": {item}}
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
  "fqn": "\"KEBOOLA\".\"out.c-gold\".\"FACT_REVENUE\"",
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

**FQN** — split tableId on last dot only:
```python
def fqn(tid):
    t = tid.split('.')
    return f'"KEBOOLA"."{".".join(t[:-1])}"."{t[-1]}"'
# out.c-gold.FACT_REVENUE → "KEBOOLA"."out.c-gold"."FACT_REVENUE"
```

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
- VERSION tables: use `SUM(CASE WHEN "T"."VERSION" = 'Actual' THEN "T"."COL" END)`

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

```python
import urllib.request, json, urllib.error

TYPE = 'semantic-metric'   # replace with actual type
ITEM = { }                 # replace with actual payload

body = {
    "name": ITEM.get('name') or ITEM.get('term'),
    "data": {**ITEM, "modelUUID": MODEL_UUID},
    "branch": "main", "schemaVersion": "1.0.0", "scope": "project"
}
req = urllib.request.Request(f"{METASTORE}/api/v1/repository/{TYPE}",
                              json.dumps(body).encode(), H, method='POST')
try:
    r = json.loads(urllib.request.urlopen(req, timeout=30).read())
    print(f"✓ Created {r['data']['id']}")
except urllib.error.HTTPError as e:
    print(f"✗ {e.code}: {e.read().decode()[:300]}")
```

**Before adding a constraint** — verify every name in `metrics[]` is an existing semantic-metric
or the constraint will create orphan FKs in downstream DIM_METRIC_THRESHOLD tables.

### Edit an entity

The metastore has no PATCH — editing is DELETE old + POST updated.
Always show the diff to the user and get confirmation before proceeding.

```python
import urllib.request, json, urllib.error, re

# 1. Fetch and find item
TYPE = 'semantic-metric'   # replace with actual type
all_items = json.loads(urllib.request.urlopen(
    urllib.request.Request(f"{METASTORE}/api/v1/repository/{TYPE}",
                            headers={'X-StorageAPI-Token': TOKEN}), timeout=15
).read()).get('data', [])
items  = [i for i in all_items if i.get('attributes', {}).get('modelUUID') == MODEL_UUID]
target = next((i for i in items
               if i['attributes'].get('name','').lower() == TARGET_NAME.lower()), None)
if not target:
    print("Not found. Available:", [i['attributes'].get('name') for i in items])

# 2. Build updated attrs, save original for rollback
original_attrs = {**target['attributes']}
NEW_ATTRS = {**original_attrs}
# apply changes, e.g.: NEW_ATTRS['sql'] = '<new sql>'

# 3. If renaming a metric — find constraints to cascade-update
OLD_NAME = original_attrs.get('name', '')
NEW_NAME = NEW_ATTRS.get('name', '')
is_rename = TYPE == 'semantic-metric' and OLD_NAME != NEW_NAME
affected_constraints = []
if is_rename:
    all_c = json.loads(urllib.request.urlopen(
        urllib.request.Request(f"{METASTORE}/api/v1/repository/semantic-constraint",
                                headers={'X-StorageAPI-Token': TOKEN}), timeout=15
    ).read()).get('data', [])
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

# 4. Delete old + POST updated (rollback on POST failure)
urllib.request.urlopen(
    urllib.request.Request(f"{METASTORE}/api/v1/repository/{TYPE}/{target['id']}",
                            headers=H, method='DELETE'), timeout=15)
body = {
    "name": NEW_ATTRS.get('name') or NEW_ATTRS.get('term'),
    "data": {**NEW_ATTRS, "modelUUID": MODEL_UUID},
    "branch": "main", "schemaVersion": "1.0.0", "scope": "project"
}
req = urllib.request.Request(f"{METASTORE}/api/v1/repository/{TYPE}",
                              json.dumps(body).encode(), H, method='POST')
try:
    r = json.loads(urllib.request.urlopen(req, timeout=30).read())
    print(f"✓ Updated: {r['data']['id']}")
except urllib.error.HTTPError as e:
    print(f"✗ POST failed ({e.code}) — attempting rollback...")
    rollback = {
        "name": original_attrs.get('name') or original_attrs.get('term'),
        "data": {**original_attrs, "modelUUID": MODEL_UUID},
        "branch": "main", "schemaVersion": "1.0.0", "scope": "project"
    }
    try:
        urllib.request.urlopen(
            urllib.request.Request(f"{METASTORE}/api/v1/repository/{TYPE}",
                                    json.dumps(rollback).encode(), H, method='POST'), timeout=30)
        print("✓ Rollback succeeded — original restored")
    except:
        print("✗ Rollback also failed — check metastore manually")
    raise

# 5. Cascade constraint updates on rename
for c in affected_constraints:
    c_attrs = {**c['attributes']}
    c_attrs['metrics'] = [NEW_NAME if m == OLD_NAME else m for m in c_attrs.get('metrics', [])]
    urllib.request.urlopen(
        urllib.request.Request(f"{METASTORE}/api/v1/repository/semantic-constraint/{c['id']}",
                                headers=H, method='DELETE'), timeout=15)
    c_req = urllib.request.Request(
        f"{METASTORE}/api/v1/repository/semantic-constraint",
        json.dumps({"name": c_attrs['name'], "data": {**c_attrs, "modelUUID": MODEL_UUID},
                    "branch": "main", "schemaVersion": "1.0.0", "scope": "project"}).encode(),
        H, method='POST')
    try:
        json.loads(urllib.request.urlopen(c_req, timeout=30).read())
        print(f"  ✓ Constraint updated: {c_attrs['name']}")
    except urllib.error.HTTPError as e:
        print(f"  ✗ {c_attrs['name']}: {e.code}")
```

> **⚠ Dataset/relationship renames** are not cascaded. Renaming a dataset's *semantic name* is
> safe. Changing its `tableId` breaks all metrics and relationships pointing to it — coordinate
> those changes manually.

### Remove an entity

Always confirm with the user before deleting. For metrics, check constraint references first.

```python
import urllib.request, json

TYPE = 'semantic-metric'   # replace with actual type
# (find target same as Edit step 1 above)

# Check constraint references before deleting a metric
if TYPE == 'semantic-metric':
    all_c = json.loads(urllib.request.urlopen(
        urllib.request.Request(f"{METASTORE}/api/v1/repository/semantic-constraint",
                                headers={'X-StorageAPI-Token': TOKEN}), timeout=15
    ).read()).get('data', [])
    refs = [c['attributes']['name'] for c in all_c
            if target['attributes']['name'] in (c.get('attributes', {}).get('metrics') or [])]
    if refs:
        print(f"⚠ Constraints referencing this metric: {refs}")
        print("Deleting will create orphan entries in downstream DIM_METRIC_THRESHOLD.")
        # Ask user to confirm before continuing

# Delete
urllib.request.urlopen(
    urllib.request.Request(f"{METASTORE}/api/v1/repository/{TYPE}/{target['id']}",
                            headers=H, method='DELETE'), timeout=15)
print(f"✓ Deleted: {target['attributes'].get('name')}")
```

---

## Operational Gotchas

**Renaming a metric changes its CODE_METRIC** — downstream pipelines derive
`CODE_METRIC = re.sub(r"[^A-Z0-9]+","_", name.upper()).strip("_")`. Any SQL
joining on `CODE_METRIC` breaks silently if a metric is renamed. Prefer additive changes.

**Constraint severity has only 3 API levels** — `error`/`warning`/`info` isn't enough
for 4-band health UIs. Encode real severity in the constraint name suffix instead.

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

**No PATCH endpoint** — the metastore has no update operation. Editing = DELETE old id + POST new.
