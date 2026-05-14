---
name: semantic-layer
description: >-
  Semantic layer reference for Keboola. Auto-loads when the user mentions:
  semantic layer, semantic model, SL, metastore, semantic-metric, semantic-dataset,
  semantic-relationship, semantic-glossary, semantic-constraint, add metric,
  edit metric, edit dataset, remove metric, inspect model, validate model,
  threshold constraints, metric sql, model entities.
  Provides API reference, payload shapes, validation rules, and operational
  gotchas so Claude can work with the metastore directly without a wizard.
allowed-tools: ['*']
---

# Semantic Layer — Reference

Use the commands in this plugin for actions:
`/sl-show` · `/sl-add` · `/sl-edit` · `/sl-remove` · `/sl-validate` · `/sl-build`

---

## Auth & Setup

Resolve `TOKEN` and `METASTORE` using this fallback chain — stop at the first that works:

**1. Environment variables** (no kbagent needed):
```python
import re, os
token     = os.environ.get('KBC_TOKEN', '')
stack_url = os.environ.get('KBC_STACK_URL') or os.environ.get('KBC_URL', '')
if token and stack_url:
    m         = re.search(r'connection\.([\w-]+)\.gcp\.keboola\.com', stack_url)
    TOKEN     = token
    METASTORE = 'https://metastore.' + (m.group(1) if m else 'us-east4') + '.gcp.keboola.com'
```

**2. kbagent config file** (if kbagent is installed):
```python
import json, re, os
cfg_path = os.path.expanduser('~/Library/Application Support/keboola-agent-cli/config.json')
if os.path.exists(cfg_path):
    cfg = json.load(open(cfg_path))
    p   = cfg['projects']['PROJECT_ALIAS']   # chosen by user from sorted list
    m   = re.search(r'connection\.([\w-]+)\.gcp\.keboola\.com', p['stack_url'])
    TOKEN     = p['token']
    METASTORE = 'https://metastore.' + (m.group(1) if m else 'us-east4') + '.gcp.keboola.com'
```

**3. Ask the user** (fallback when neither above works):
Ask for:
- **Storage API token** — Keboola UI → Settings → API Tokens
- **Connection URL** — e.g. `connection.europe-west3.gcp.keboola.com`

Derive METASTORE from the region in the connection URL.

Once resolved: `H = {'X-StorageAPI-Token': TOKEN, 'Content-Type': 'application/json'}`

> kbagent is **not required** for any CRUD command (`sl-show`, `sl-add`, `sl-edit`,
> `sl-remove`, `sl-validate`). It is only needed for `sl-build` (schema + SQL discovery)
> and `sl-validate --deep` (phantom-field checks against Snowflake).

---

## API Primitives

```python
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
# Export full model before editing
for t in ['semantic-metric','semantic-dataset','semantic-glossary',
          'semantic-constraint','semantic-relationship']:
    json.dump(api_get(f'/api/v1/repository/{t}'),
              open(f'/tmp/sl_backup_{t}.json','w'), indent=2)
```

**No PATCH endpoint** — the metastore has no update operation. Editing = DELETE old id + POST new.
