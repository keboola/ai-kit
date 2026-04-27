---
name: sl-builder
description: >-
  Use this skill to generate, build, or populate a semantic layer for any Keboola project.
  Asks the user which project to use, fetches schemas and SQL transformations via kbagent,
  generates a full semantic model (datasets, metrics, relationships, glossary), runs a
  programmatic validation suite with auto-fixes, then pushes directly to the project metastore
  after user confirmation. Supports partial update of existing models. No app dependency.
  Use for: generate semantic layer, build semantic model, create metrics, define datasets,
  sl-builder, semantic layer wizard, create data model, semantic layer from Keboola,
  populate semantic layer, build me a semantic layer, analyze tables and create model.
  Trigger any time the user mentions semantic layer, semantic model, or building metrics from data.
---

# sl-builder — Semantic Layer Builder

Schema discovery → SQL context → business questions → generate → validate → confirm & push.

---

## Step 0 — Setup

```bash
export KBAGENT_CONVERSATION_ID="$(uuidgen)"
python3 -c "
import json,os
cfg=json.load(open(os.path.expanduser('~/Library/Application Support/keboola-agent-cli/config.json')))
for p in sorted(cfg.get('projects',{}).keys()): print(p)
"
```

**Always ask the user to pick a project.** Never auto-select.

Once chosen, extract credentials, list tables, and check existing models — all in parallel:

```bash
python3 -c "
import json,re,os,urllib.request
cfg=json.load(open(os.path.expanduser('~/Library/Application Support/keboola-agent-cli/config.json')))
p=cfg['projects']['PROJECT']
m=re.search(r'connection\.([\w-]+)\.gcp\.keboola\.com',p['stack_url'])
region=m.group(1) if m else 'us-east4'
token=p['token']
metastore='https://metastore.'+region+'.gcp.keboola.com'
print('TOKEN='+token)
print('METASTORE='+metastore)
req=urllib.request.Request(metastore+'/api/v1/repository/semantic-model',
    headers={'X-StorageAPI-Token':token})
existing=json.loads(urllib.request.urlopen(req,timeout=15).read()).get('data',[])
print('EXISTING='+json.dumps([{'id':m['id'],'name':m.get('data',{}).get('name',m['name'])} for m in existing]))
" &
kbagent --json storage tables --project PROJECT > /tmp/tables.json &
wait
```

Tables: `json.load(open('/tmp/tables.json'))['data']['tables']`

If `EXISTING` has models, show their names and ask: **"Update one of these or create new?"**
Store the chosen model ID as `UPDATE_ID` (or `None` for new).

---

## Step 1 — Business questions (before fetching schemas)

> "Three quick questions:
> 1. **What does this data model?**
> 2. **Top KPIs the business tracks** — numbers on an exec dashboard
> 3. **Which buckets/layers are gold/authoritative?** (or 'I don't know')"

If the user doesn't know KPIs or gold layer, infer both from schemas and SQL transformations.

---

## Step 2 — Schema discovery

**Filter** — prefer `out.*`, `fact_*`, `dim_*`, mart/L2 buckets. Skip `sys_*`, `tmp_*`, validation tables with 0 rows. Show shortlist, ask *"ok or remove any?"*

**Fetch schemas and SQL transformations in parallel (10 concurrent):**

```python
import subprocess, json, sys, os
from concurrent.futures import ThreadPoolExecutor, as_completed

def fetch(tid):
    r = subprocess.run(['kbagent','--json','storage','table-detail','--project','PROJECT','--table-id',tid],
        capture_output=True, text=True, env={**os.environ,'KBAGENT_CONVERSATION_ID':'CONV_ID'})
    try: return tid, json.loads(r.stdout).get('data',{})
    except: return tid, None

schemas = {}
with ThreadPoolExecutor(max_workers=10) as ex:
    for i,(tid,data) in enumerate(
        (f.result() for f in as_completed({ex.submit(fetch,t):t for t in TABLE_IDS})), 1):
        if data: schemas[tid] = data
        print(f'  {i}/{len(TABLE_IDS)}', file=sys.stderr)
json.dump(schemas, open('/tmp/schemas.json','w'))
# Each schema: columns (list of strings), column_details (list of {name, type})
```

**Fetch SQL transformations** (run in parallel with schemas above):

```bash
kbagent --json config list --project PROJECT > /tmp/transforms_raw.json 2>/dev/null || echo '{}' > /tmp/transforms_raw.json
```

Extract SQL context:

```python
import json, subprocess, os
from concurrent.futures import ThreadPoolExecutor, as_completed

raw = json.load(open('/tmp/transforms_raw.json'))

def find_transforms(obj, result=None):
    if result is None: result = []
    if isinstance(obj, list):
        for i in obj: find_transforms(i, result)
    elif isinstance(obj, dict):
        if obj.get('component_id','') == 'keboola.snowflake-transformation':
            result.append({'id': obj.get('config_id',''), 'name': obj.get('config_name','')})
        for v in obj.values():
            find_transforms(v, result)
    return result

def fetch_detail(t):
    r = subprocess.run(
        ['kbagent','--json','config','detail','--project','PROJECT',
         '--component-id','keboola.snowflake-transformation','--config-id',t['id']],
        capture_output=True, text=True,
        env={**os.environ,'KBAGENT_CONVERSATION_ID':'CONV_ID'}
    )
    try: return t['name'], json.loads(r.stdout).get('data',{})
    except: return t['name'], {}

def extract_sql(data):
    sqls = []
    for block in data.get('configuration',{}).get('parameters',{}).get('blocks',[]):
        for code in block.get('codes',[]):
            scripts = code.get('script',[])
            if isinstance(scripts, list):
                combined = '\n'.join(s for s in scripts if isinstance(s,str) and s.strip())
                if combined.strip(): sqls.append(f"-- {code.get('name','')}\n{combined}")
    return sqls

sql_context = []
transforms = find_transforms(raw)
with ThreadPoolExecutor(max_workers=6) as ex:
    for name, data in (f.result() for f in as_completed({ex.submit(fetch_detail,t):t for t in transforms})):
        sqls = extract_sql(data)
        if sqls:
            sql_context.append({'name': name, 'sql': '\n\n'.join(sqls)[:3000]})
# Pass sql_context into Step 3 generation as additional business logic context
```

---

## Step 3 — Generate

Build the full model and save to `/tmp/model.json`:
```json
{"name":"...", "description":"...", "datasets":[...], "metrics":[...], "relationships":[...], "glossary":[...]}
```

Use `sql_context` from Step 2 to inform metric formulas — real transformation SQL contains the actual business logic.

### Exact payload shapes — do not deviate

| Type | Required fields |
|---|---|
| **dataset** | `name` (snake_case), `tableId`, `fqn` (see below), `description`, `grain`, `primaryKey` (list), `fields` (list of `{name, type, role, description}`) |
| **metric** | `name`, `sql` (`SUM("TABLE"."COL")`), `dataset` (**tableId**, not dataset name), `description` |
| **relationship** | `name`, `from` (**tableId**), `to` (**tableId**), `on` (`"FROM_T"."COL" = "TO_T"."COL"`), `type` (`left`\|`inner`) |
| **glossary** | `term`, `definition` |

**FQN** — split on last dot only:
```python
def fqn(tid):
    t=tid.split('.'); return f'"KEBOOLA"."{".".join(t[:-1])}"."{t[-1]}"'
# out.c-fi-l2-app.FACT_TABLE → "KEBOOLA"."out.c-fi-l2-app"."FACT_TABLE"
```

**Field roles:** `PK_*/FK_*` → `key` · `DATE_*/*_DATE/INS_DT/UPD_DT` → `timestamp` · numeric amounts/values/rates → `measure` · everything else → `dimension`

**Field types:** use actual Snowflake type from `column_details[].type` — `STRING`→`string`, `NUMERIC`→`decimal`/`integer`. Never override STRING to boolean/date.

**Metrics:** `SUM`/`AVG`/`COUNT(DISTINCT)` on real columns. Period comparisons (PM, PYM, YTD) where columns exist. Derived: `SUM(a)-SUM(b)`. Never `SUM` a `_PCT`/ratio column — use `AVG`. At least one metric per fact table. Prefer formulas found in `sql_context` over guesses.

**VERSION rule — mandatory when a `VERSION` column exists in a fact table:** generate three variants for every key measure — Actual, Budget, and Actual-vs-Budget variance. Summing across all versions produces meaningless results (Actual + Budget + Forecast mixed together).
```
total_X_actual  = SUM(CASE WHEN "T"."VERSION" = 'Actual' THEN "T"."X" END)
total_X_budget  = SUM(CASE WHEN "T"."VERSION" = 'Budget' THEN "T"."X" END)
X_actual_vs_budget = <actual expression> - <budget expression>
```
Apply this to every primary measure column in VERSION-bearing fact tables (AMOUNT, BALANCE, VALUE, METRIC_VALUE, etc.).

**Relationships:** every `FK_*` → matching `PK_*`. Every period-bearing fact → time dim. `from`/`to` are tableIds; `on` uses actual table names.

**Glossary:** 20+ terms. Cover every business abbreviation in column names plus domain entities and versioning concepts.

### Constraints (semantic-constraint) payload — for downstream threshold UIs

| Field | Notes |
|---|---|
| `name` | Encode severity in the suffix: `<metric>_critical`, `<metric>_warning`, `<metric>_healthy`, `<metric>_review`. Downstream pipelines parse this. |
| `severity` | Only `error`/`warning`/`info` are accepted by the API — that's not enough granularity for 4-level health bands, so use the name suffix above as the source of truth. |
| `constraintType` | `range` or `inequality`. |
| `metrics` | List of **exact metric names** that this constraint applies to. CRITICAL: any name in this list that doesn't have a matching `semantic-metric` will produce an orphan FK in downstream DIM_METRIC_THRESHOLD tables — ensure every name resolves. |
| `ruleExpression.bounds` | `{min, max}`. Either side may be omitted for an open-ended bound (e.g. `{min: 0.25}` for "≥ 0.25"). Downstream consumers must handle missing `max` as "no upper bound" — store as NULL or sentinel, never as `0`. |

Example for a margin metric with 4 health bands:
```json
{"name":"net_profit_margin_critical","constraintType":"range","metrics":["Net Profit Margin"],
 "ruleExpression":{"bounds":{"min":-2.0,"max":0.05}}, "severity":"error"}
{"name":"net_profit_margin_warning","constraintType":"range","metrics":["Net Profit Margin"],
 "ruleExpression":{"bounds":{"min":0.05,"max":0.08}}, "severity":"warning"}
{"name":"net_profit_margin_healthy","constraintType":"range","metrics":["Net Profit Margin"],
 "ruleExpression":{"bounds":{"min":0.08,"max":0.20}}, "severity":"info"}
{"name":"net_profit_margin_review","constraintType":"range","metrics":["Net Profit Margin"],
 "ruleExpression":{"bounds":{"min":0.20}}, "severity":"info"}
```

---

## Step 4 — Validate (mandatory — auto-fixes run first, then errors)

```python
import json, re, time as _time

model   = json.load(open('/tmp/model.json'))
schemas = json.load(open('/tmp/schemas.json'))
cols    = {tid: set(d.get('columns',[])) for tid,d in schemas.items()}
types   = {tid: {c['name']:c.get('type','') for c in d.get('column_details',[])} for tid,d in schemas.items()}
all_tids = {ds['tableId'] for ds in model['datasets']}

# ── Auto-fixes ───────────────────────────────────────────────────────────────

# Fix 1: PK_/FK_ fields with wrong role
for ds in model['datasets']:
    for f in ds['fields']:
        if f['name'][:3] in ('PK_','FK_') and f['role'] != 'key':
            f['role'] = 'key'; print(f"  auto-fixed role: {ds['name']}.{f['name']}")

# Fix 2: Type mismatches vs actual Snowflake type
for ds in model['datasets']:
    for f in ds['fields']:
        sf = types.get(ds['tableId'],{}).get(f['name'])
        if sf == 'STRING' and f['type'] not in ('string','json'):
            f['type'] = 'string'; print(f"  auto-fixed type: {ds['name']}.{f['name']} → string")
        if sf == 'NUMERIC' and f['type'] not in ('integer','decimal','boolean','string'):
            f['type'] = 'decimal'; print(f"  auto-fixed type: {ds['name']}.{f['name']} → decimal")

# Fix 3: Missing time-dimension joins — detect by field name, not dataset name
TIME_KEY_NAMES = {'PERIOD_CODE','DATE_KEY','YEARMONTH','DATEID','PK_DATE','PK_PERIOD'}
time_ds = time_period_col = None
for ds in model['datasets']:
    match = next((f['name'] for f in ds['fields'] if f['name'] in TIME_KEY_NAMES and f['role']=='key'), None)
    if match:
        time_ds = ds; time_period_col = match; break

if time_ds:
    joined = {r['from'] for r in model['relationships'] if r['to'] == time_ds['tableId']}
    for ds in model['datasets']:
        if not (ds['name'].startswith('fact_') or ds['name'].startswith('ft_')): continue
        period_col = next((f['name'] for f in ds['fields']
                           if f['name'] in ('PERIOD','CODE_PERIOD_VALUE')), None)
        if period_col and ds['tableId'] not in joined:
            ft=ds['tableId'].split('.')[-1]; tt=time_ds['tableId'].split('.')[-1]
            model['relationships'].append({
                "name": f"{ds['name']}_to_time", "from": ds['tableId'], "to": time_ds['tableId'],
                "on": f'"{ft}"."{period_col}" = "{tt}"."{time_period_col}"', "type": "left"
            })
            print(f"  auto-added time join: {ds['name']} → {time_ds['name']}")

json.dump(model, open('/tmp/model.json','w'), indent=2)

# ── Error checks ─────────────────────────────────────────────────────────────
errors = []

for ds in model['datasets']:
    actual = cols.get(ds['tableId'], set())
    for f in ds['fields']:
        if actual and f['name'] not in actual:
            errors.append(f"PHANTOM FIELD {ds['name']}.{f['name']}")

for r in model['relationships']:
    for side,tid in [('from',r['from']),('to',r['to'])]:
        if tid not in all_tids: errors.append(f"DANGLING REL {r['name']}.{side}={tid}")
    from_t=r['from'].split('.')[-1]; to_t=r['to'].split('.')[-1]
    for tbl,col in re.findall(r'"([^"]+)"\."([^"]+)"', r['on']):
        actual = cols.get(r['from'] if tbl==from_t else r['to'], set())
        if actual and col not in actual: errors.append(f"REL PHANTOM {r['name']} {tbl}.{col}")

AGG_DIRECT = re.compile(r'\b(?:SUM|AVG)\s*\(\s*"[^"]+"\."([^"]+)"\s*\)', re.I)
for m in model['metrics']:
    if m['dataset'] not in all_tids: errors.append(f"DANGLING METRIC {m['name']} dataset={m['dataset']}")
    actual = cols.get(m['dataset'], set())
    for col in re.findall(r'"[^"]+"\."([^"]+)"', m['sql']):
        if actual and col not in actual: errors.append(f"METRIC PHANTOM {m['name']} col={col}")
    for col in AGG_DIRECT.findall(m['sql']):  # only flag direct aggregation, not CASE WHEN filters
        if types.get(m['dataset'],{}).get(col)=='STRING':
            errors.append(f"AGG ON STRING {m['name']} col={col}")
    if re.search(r'SUM\([^)]*PCT[^)]*\)',m['sql']): errors.append(f"SUM-ON-PCT {m['name']}")

for section,key in [('datasets','name'),('metrics','name'),('relationships','name'),('glossary','term')]:
    names=[i[key] for i in model[section]]; dups={n for n in names if names.count(n)>1}
    if dups: errors.append(f"DUPLICATES {section}: {dups}")

for e in sorted(set(errors)): print(f"✗ {e}")
if not errors: print("✓ clean")
```

Fix all errors, re-run until `✓ clean`.

### Additional checks for constraints (when constraints exist in the model)

```python
# Every constraint metric must resolve to an existing semantic-metric (else orphan FKs downstream)
metric_names = {m['name'] for m in model['metrics']}
for c in model.get('constraints', []):
    for mn in (c.get('metrics') or []):
        if mn not in metric_names:
            errors.append(f"CONSTRAINT ORPHAN {c['name']} → metric '{mn}' not in model")
    # Severity-name encoding sanity (warn only — not blocking)
    sev_suffixes = ('_critical','_warning','_healthy','_review')
    if not any(c['name'].lower().endswith(s) for s in sev_suffixes):
        print(f"  ⚠ constraint '{c['name']}' lacks _critical/_warning/_healthy/_review suffix — downstream parsers may default to 'warning'")
```

---

## Step 5 — Confirm & Push

Show summary:
```
Model: <name>  |  Snowflake  |  <use_case>
Datasets (N): table · table · ...
Metrics (N):  metric · metric · ...
Relationships: N  |  Glossary: N terms
⚠ Open questions: ...
```

Ask: *"Confirm model name and say 'go'."*

On 'go', push. Use **partial update** if `UPDATE_ID` is set, otherwise create fresh.

```python
import json, urllib.request, urllib.error, time
from concurrent.futures import ThreadPoolExecutor

model=json.load(open('/tmp/model.json'))
METASTORE="METASTORE_URL"; TOKEN="KBC_TOKEN"
H={"X-StorageAPI-Token":TOKEN,"Content-Type":"application/json"}

def post(path,body):
    req=urllib.request.Request(f"{METASTORE}{path}",json.dumps(body).encode(),H,method="POST")
    try:
        with urllib.request.urlopen(req,timeout=30) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e: raise Exception(f"HTTP {e.code}: {e.read().decode()[:200]}")

def delete(path):
    req=urllib.request.Request(f"{METASTORE}{path}",headers=H,method="DELETE")
    urllib.request.urlopen(req,timeout=15)

def get_list(type_path, model_uuid):
    req=urllib.request.Request(f"{METASTORE}/api/v1/repository/{type_path}",headers={"X-StorageAPI-Token":TOKEN})
    try:
        all_items=json.loads(urllib.request.urlopen(req,timeout=15).read()).get('data',[])
        # filter by modelUUID stored in attributes — query param ?modelId is not reliable
        return [i for i in all_items if i.get('attributes',{}).get('modelUUID')==model_uuid]
    except: return []

def cleanup_orphans(type_path, keep_uuid):
    req=urllib.request.Request(f"{METASTORE}/api/v1/repository/{type_path}",headers={"X-StorageAPI-Token":TOKEN})
    try:
        all_items=json.loads(urllib.request.urlopen(req,timeout=15).read()).get('data',[])
        for i in all_items:
            if i.get('attributes',{}).get('modelUUID') != keep_uuid:
                delete(f"/api/v1/repository/{type_path}/{i['id']}")
    except: pass

def fqn(tid):
    t=tid.split('.'); return f'"KEBOOLA"."{".".join(t[:-1])}"."{t[-1]}"'

def push(type_path, item, name_key, uuid, retries=3):
    data={**item,"modelUUID":uuid}
    if type_path=="semantic-dataset": data["fqn"]=fqn(item["tableId"])
    name=item[name_key]
    for attempt in range(retries):
        try:
            post(f"/api/v1/repository/{type_path}",
                 {"name":name,"data":data,"branch":"main","schemaVersion":"1.0.0","scope":"project"})
            return True,name,None
        except Exception as e:
            if attempt==retries-1: return False,name,str(e)
            time.sleep(1)

UPDATE_ID = None  # or the existing model UUID if updating

TYPES = [
    ("semantic-dataset",      model['datasets'],      "name"),
    ("semantic-metric",       model['metrics'],        "name"),
    ("semantic-relationship", model['relationships'],  "name"),
    ("semantic-glossary",     model['glossary'],       "term"),
]

if UPDATE_ID:
    uuid = UPDATE_ID
    for type_path in [t for t,_,_ in TYPES]: cleanup_orphans(type_path, uuid)
    for type_path, items, name_key in TYPES:
        existing = {i.get('attributes',{}).get('name'): i['id'] for i in get_list(type_path, uuid)}
        new_names = {i[name_key] for i in items}
        for name,eid in existing.items(): delete(f"/api/v1/repository/{type_path}/{eid}")
        ok=fail=0
        with ThreadPoolExecutor(max_workers=4) as ex:
            for s,n,e in ex.map(lambda i:push(type_path,i,name_key,uuid),items):
                if s: ok+=1
                else: fail+=1; print(f"  ✗ {n}: {e}")
        print(f"  {'✓' if not fail else '⚠'} {type_path}: {ok}/{len(items)}")
else:
    uuid=post("/api/v1/repository/semantic-model",{
        "name":model['name'],"data":{"name":model['name'],"description":model['description'],"sql_dialect":"Snowflake"},
        "branch":"main","schemaVersion":"1.0.0","scope":"project"
    })["data"]["id"]
    print(f"✓ model created {uuid}")
    for type_path in [t for t,_,_ in TYPES]: cleanup_orphans(type_path, uuid)
    for type_path,items,name_key in TYPES:
        ok=fail=0
        with ThreadPoolExecutor(max_workers=4) as ex:
            for s,n,e in ex.map(lambda i:push(type_path,i,name_key,uuid),items):
                if s: ok+=1
                else: fail+=1; print(f"  ✗ {n}: {e}")
        print(f"  {'✓' if not fail else '⚠'} {type_path}: {ok}/{len(items)}")

print(f"\n✓ '{model['name']}' live — Datasets:{len(model['datasets'])} Metrics:{len(model['metrics'])} Rels:{len(model['relationships'])} Glossary:{len(model['glossary'])}")
```

---

## Rules

1. Set `KBAGENT_CONVERSATION_ID` before every kbagent call; always use `--json`
2. Never push without explicit user 'go'

---

## Step 6 — Hand-off to downstream consumers (optional reading)

When the SL feeds into a Keboola pipeline (Python apps that materialize `DIM_METRIC`/`DIM_METRIC_THRESHOLD` from the metastore, transformations that JOIN on `CODE_METRIC`, etc.), there are recurring traps. None of these are caused by sl-builder, but knowing them helps you generate models that are friendly to those consumers.

### 6.1 Stable codes from metric names

Downstream code typically derives `CODE_METRIC` from the metric name with `re.sub(r"[^A-Z0-9]+","_", name.upper()).strip("_")`:
- `"Net Profit Margin"` → `NET_PROFIT_MARGIN`
- `"COGS"` → `COGS`
- `"Revenue"` → `REVENUE`

**Implication:** renaming a metric changes its code, breaking any SQL that joins on the code (`LEFT JOIN DIM_METRIC m ON m.CODE_METRIC = k.KPI_CODE`). When updating an existing model, prefer additive changes; if a rename is needed, coordinate with downstream SQL refactors.

### 6.2 Abbreviation collision-safety (downstream concern)

If downstream materializes `DIM_METRIC.ABBR_METRIC` from a derivation like first-letters-of-words, the naïve generator will produce duplicates (e.g. "Pl Monthly Amount Pm Avb" and "Pl Monthly Amount Pym Avb" both → `PMAPA`). Recommended generator logic:

```python
def make_abbr_gen():
    """Collision-safe abbreviation generator. Tracks generated values in a set;
    on collision, tries base[:4]+'1', base[:4]+'2', ..."""
    seen = set()
    def gen(name):
        words = re.split(r"[\s_\-/]+", name.upper().strip())
        base = name[:4].upper() if len(words) == 1 else "".join(w[0] for w in words if w)[:5]
        if base not in seen:
            seen.add(base); return base
        i = 1
        while True:
            candidate = base[:4] + str(i)
            if candidate not in seen:
                seen.add(candidate); return candidate
            i += 1
    return gen
```

This avoids both the same-base collisions and the cross-base `base[:4]+counter` collisions (e.g. when `KDVPA` and `KDVPB` both want to be renamed to `KDVP1`).

### 6.3 Keboola Storage column-type cache (CTAS trap)

When a downstream transformation does `CREATE OR REPLACE TABLE X AS SELECT ...` and X is a Storage destination, Keboola caches the inferred Snowflake column types **at the bucket level**. The cache survives `kbagent storage delete-table` if an alias points at the deleted table. Symptoms:
- Decimal values round to integers (`0.65 → 1`) because the cached column is `NUMBER(38,0)`
- Strings get rejected on output mapping if the cache has `NUMBER`
- `kbagent storage table-detail` shows the *intended* type but actual stored data is rounded

**Reset procedure:**
```bash
# Delete with --force to cascade aliases (required when in.c-* alias exists)
kbagent --json storage delete-table --project P --table-id out.c-bucket.TABLE --force --yes

# Pre-create with explicit typed columns BEFORE running the transformation
kbagent --json storage create-table --project P --bucket-id out.c-bucket --name TABLE \
  --column "ID:VARCHAR(255)" --column "VALUE_MIN:NUMBER(38,4)" --column "VALUE_MAX:NUMBER(38,4)" \
  --primary-key ID

# Now run the transformation — CTAS into pre-typed table preserves the schema
```

This trap is most common with threshold/ratio columns where the first run wrote integer literals (e.g. `COALESCE(..., 0)` with bare INT) and locked the column type at `NUMBER(38,0)` for the bucket.

### 6.4 Cross-project source column drift

The same logical column may have different physical types across projects:
- Project A: `FT_FIN_STAT_PERIOD.METRIC_VALUE` is `STRING` (text-loaded from CSV)
- Project B: same column is `NUMERIC` (typed-storage)

SQL like `NULLIF(METRIC_VALUE, '')::NUMBER(38,4)` works for STRING columns but fails on NUMERIC ones with `"Numeric value '' is not recognized"`. When the SL skill is used to seed metric SQL across projects, check `kbagent storage table-detail --table-id <tid>` for the source column types in EACH target project and conditionally include/omit `NULLIF` wraps.

### 6.5 Promoting a model between projects

The metastore stores a per-project `modelUUID` — UUIDs differ between dev and prod even for the same logical model. Promotion pattern:

```python
# 1. Export from source
SOURCE_TYPES = ["semantic-metric","semantic-dataset","semantic-glossary","semantic-constraint","semantic-relationship"]
src_snapshot = {t: fetch(f"{SOURCE_METASTORE}/api/v1/repository/{t}", SOURCE_TOKEN) for t in SOURCE_TYPES}

# 2. Discover target model UUID (different from source's)
target_models = fetch(f"{TARGET_METASTORE}/api/v1/repository/semantic-model", TARGET_TOKEN)
TARGET_UUID = next(m["id"] for m in target_models if m["attributes"]["name"] == src_model_name)

# 3. Push, replacing modelUUID on each item before POST
for item in src_snapshot["semantic-metric"]:
    attrs = {**item["attributes"], "modelUUID": TARGET_UUID}
    post_to_target("semantic-metric", attrs["name"], attrs)
```

Pre-flight check: any target-only constraints/metrics that target *non-existent* metrics in the consolidated model become orphans. Either delete them or update their `metrics` array first.

---

## Operational hygiene

- **Snapshot before any destructive change** — before deleting metrics/constraints, save the full metastore export to disk for rollback.
- **Always run `kbagent --json` with `--dry-run` first** for any `config update` or `storage delete`.
- **Aliases block deletion** — if `kbagent storage delete-table` returns `failed: alias exists in.c-*`, re-run with `--force`.
- **Don't mass-delete via `cleanup_orphans`** if the target project has multiple semantic models — verify the `modelUUID` filter actually filters before calling delete.
