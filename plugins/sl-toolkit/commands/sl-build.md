---
name: sl-build
description: Greenfield wizard — builds a complete semantic layer model from scratch via schema discovery, SQL analysis, and AI generation. Only triggered by explicit /sl-build invocation. Not triggered by conversational mentions of the semantic layer.
allowed-tools:
  - Bash
  - AskUserQuestion
argument-hint: "[project-alias]"
---

# Build Semantic Layer — Greenfield Wizard

Schema discovery → SQL context → business questions → generate → validate → push.

---

## Step 0 — Setup

```bash
export KBAGENT_CONVERSATION_ID="$(uuidgen)"
```

Use the **setup recipe** from the `semantic-layer` skill to get `TOKEN`, `STACK`, and `METASTORE`
(env vars → kbagent config → ask user). Store the resolved values, and the chosen project
alias as `PROJECT`. **Never auto-select a project.**

Then resolve the Snowflake DB name once and cache it for the run:
```python
import urllib.request, json, os, sys
try:
    req = urllib.request.Request(f"{STACK}/v2/storage/tokens/verify",
                                  headers={'X-StorageApi-Token': TOKEN})
    pid = json.loads(urllib.request.urlopen(req, timeout=15).read())['owner']['id']
    DB_NAME = f'KEBOOLA_{pid}'
except Exception as e:
    print(f"⚠ DB resolve failed ({e}); falling back to KEBOOLA", file=sys.stderr)
    DB_NAME = 'KEBOOLA'
open('/tmp/sl_db_name.txt', 'w').write(DB_NAME)
print(f"DB: {DB_NAME}")
```

Detect kbagent and check for existing models in parallel:

```bash
# Detect kbagent
KBAGENT_AVAILABLE=false
command -v kbagent &>/dev/null && KBAGENT_AVAILABLE=true

# If kbagent available: fetch table list too
if $KBAGENT_AVAILABLE; then
    kbagent --json storage tables --project "$PROJECT" > /tmp/sl_tables.json &
fi
```

```python
# Check for existing models (use the resolved TOKEN and METASTORE from setup recipe)
import json, urllib.request

# API helpers — canonical defs in semantic-layer SKILL.md API Primitives
def api_get(path):
    req = urllib.request.Request(f"{METASTORE}{path}",
                                  headers={'X-StorageAPI-Token': TOKEN})
    return json.loads(urllib.request.urlopen(req, timeout=15).read()).get('data', [])

existing = api_get('/api/v1/repository/semantic-model')
for m in existing:
    print(m['id'], m.get('attributes', {}).get('name', '?'))
```

If kbagent is **not** available: skip Step 2 schema fetch — ask the user instead:
*"No kbagent detected. Please describe your tables (names + what they contain) and top KPIs, and I'll generate the model from that."*
Then proceed directly to Step 3 using the user's description.

If models already exist ask: **"Update an existing model or create new?"**
Store the chosen model id as `UPDATE_ID` (or empty string for new) and persist it:

```python
with open('/tmp/sl_update_id.txt', 'w') as f:
    f.write(UPDATE_ID or '')
```

---

## Step 1 — Business questions

> 1. **What does this data model?**
> 2. **Top KPIs the business tracks** — numbers on an exec dashboard
> 3. **Which buckets/layers are gold/authoritative?** (or 'I don't know')

Infer from schemas and SQL if the user doesn't know.

---

## Step 2 — Schema + SQL discovery

**Only run this step if kbagent is available** (detected in Step 0). If not, skip to Step 3.

**Filter** — prefer `out.*`, `fact_*`, `dim_*`, mart/L2 buckets. Skip `sys_*`, `tmp_*`, 0-row tables. Show shortlist, ask *"ok or remove any?"*

Fetch table schemas in parallel (10 workers):

```python
import subprocess, json, os
from concurrent.futures import ThreadPoolExecutor, as_completed

# PROJECT and KBAGENT_CONVERSATION_ID are already set in the environment from Step 0
ENV = {**os.environ}

def fetch_schema(tid):
    r = subprocess.run(
        ['kbagent','--json','storage','table-detail','--project', PROJECT, '--table-id', tid],
        capture_output=True, text=True, env=ENV)
    try: return tid, json.loads(r.stdout).get('data', {})
    except: return tid, None

schemas = {}
with ThreadPoolExecutor(max_workers=10) as ex:
    for tid, data in (f.result() for f in as_completed({ex.submit(fetch_schema,t):t for t in TABLE_IDS})):
        if data: schemas[tid] = data
json.dump(schemas, open('/tmp/sl_schemas.json','w'))
```

Also fetch SQL transformation context (run in parallel with schemas):

```bash
kbagent --json config list --project "$PROJECT" > /tmp/sl_transforms.json 2>/dev/null || echo '{}' > /tmp/sl_transforms.json
```

Extract SQL from `keboola.snowflake-transformation` configs and use it to inform metric formulas in Step 3.

---

## Step 2.5 — Probe VERSION-candidate columns

Skip this step if kbagent is not available. Scan each table's schema for candidate
columns and probe their distinct Snowflake values. The probe drives Step 3's
VERSION-rule decision — without it, the LLM cannot know whether `'Actual'`/`'Budget'`
literals are valid. Probing uses kbagent's `query_data` MCP tool, which runs SQL
against the project's Snowflake warehouse via the keboola-mcp-server query service.

Candidate naming covers both flat (`VERSION`, `SCENARIO`) and prefixed
(`DIM_*_VERSION`, `TYPE_*`) conventions used across customer projects:

```python
import subprocess, json, os, re, csv, io
from concurrent.futures import ThreadPoolExecutor, as_completed

schemas = json.load(open('/tmp/sl_schemas.json'))
ENV = {**os.environ}

CANDIDATE_RE = re.compile(
    r'^((?:DIM_|TYPE_|CODE_)?(?:VERSION|SCENARIO|VARIANT|PERIOD_TYPE)'
    r'|TYPE_[A-Z_]+|[A-Z_]+_(?:VERSION|SCENARIO|VARIANT))$', re.I)

def probe(tid_col):
    tid, col = tid_col
    # tableId shape: out.c-bucket.TABLE → schema "out.c-bucket", table "TABLE"
    schema, table = tid.rsplit('.', 1)
    q = f'SELECT DISTINCT "{col}" AS V FROM "{schema}"."{table}" LIMIT 20'
    payload = json.dumps({'query_name': f'sl-build probe {col}', 'sql_query': q})
    r = subprocess.run(
        ['kbagent','--json','tool','call','query_data',
         '--project', PROJECT, '--input', payload],
        capture_output=True, text=True, env=ENV, timeout=60)
    try:
        d = json.loads(r.stdout).get('data', {})
        # Response: {"results":[{"content":[{"csv_data":"V\r\nA\r\nB\r\n"}],"isError":false}]}
        for res in d.get('results', []):
            if res.get('isError'): continue
            for piece in res.get('content', []):
                if isinstance(piece, str):
                    try: piece = json.loads(piece)
                    except Exception: continue
                csv_text = piece.get('csv_data') if isinstance(piece, dict) else None
                if csv_text:
                    rows = list(csv.DictReader(io.StringIO(csv_text)))
                    return tid, col, [row['V'] for row in rows if row.get('V')]
    except Exception:
        pass
    return tid, col, []

candidates = [(tid, c['name'])
              for tid, d in schemas.items()
              for c in d.get('column_details', [])
              if CANDIDATE_RE.match(c.get('name',''))]

samples = {}
if candidates:
    with ThreadPoolExecutor(max_workers=10) as ex:
        for tid, col, values in (f.result() for f in
                                  as_completed({ex.submit(probe, tc): tc for tc in candidates})):
            samples.setdefault(tid, {})[col] = values
json.dump(samples, open('/tmp/sl_version_samples.json','w'), indent=2)
print(f"Probed {len(candidates)} VERSION-like columns; results in /tmp/sl_version_samples.json")
```

If kbagent SQL probing fails or returns empty for every candidate, write `{}` to the
samples file — Step 3 will then skip all VERSION-conditional metrics.

---

## Step 3 — Generate

Build `/tmp/sl_model.json` with keys:
```json
{"name": "...", "description": "...", "datasets": [...], "metrics": [...],
 "relationships": [...], "glossary": [...], "constraints": [...]}
```

Use **payload shapes, field roles, VERSION rule, and constraint encoding** from the `semantic-layer` skill.
Prefer SQL formulas found in transformation context over guesses.

**For the VERSION rule**: read `/tmp/sl_version_samples.json` first. For each `(tableId, column)`,
only emit a `SUM(CASE WHEN "<col>" = '<literal>' THEN ...)` metric if the column's distinct
values (from the probe) include any of `{actual, budget, plan, forecast, baseline, target}`
case-insensitively. Substitute the *actual literal* from the probe (preserve case) into the SQL.
Otherwise skip the VERSION-conditional metric and note in the model description which columns
were skipped and what their distinct values were.

---

## Step 4 — Validate

Run the validation checks **inline against `/tmp/sl_model.json` and `/tmp/sl_schemas.json`**.
Do **not** fetch from the metastore API here — the model has not been pushed yet.

```python
import json, re

model   = json.load(open('/tmp/sl_model.json'))
schemas = json.load(open('/tmp/sl_schemas.json'))
cols    = {tid: set(d.get('columns',[])) for tid,d in schemas.items()}
types   = {tid: {c['name']:c.get('type','') for c in d.get('column_details',[])} for tid,d in schemas.items()}

datasets      = model.get('datasets', [])
metrics       = model.get('metrics', [])
relationships = model.get('relationships', [])
constraints   = model.get('constraints', [])
all_tids      = {ds['tableId'] for ds in datasets}
metric_names  = {m['name'] for m in metrics}
errors, warnings = [], []

# Duplicates
for section, key, items in [('datasets','name',datasets),('metrics','name',metrics),
                              ('relationships','name',relationships),('glossary','term',model.get('glossary',[]))]:
    names = [i[key] for i in items]
    dups  = {n for n in names if names.count(n) > 1}
    if dups: errors.append(f"DUPLICATES {section}: {dups}")

# Dangling rels
for r in relationships:
    for side, tid in [('from', r.get('from','')), ('to', r.get('to',''))]:
        if tid and tid not in all_tids: errors.append(f"DANGLING REL {r['name']}.{side}={tid}")

# Dangling metrics + phantom cols
for m in metrics:
    if m.get('dataset') and m['dataset'] not in all_tids:
        errors.append(f"DANGLING METRIC {m['name']}")
    if re.search(r'SUM\([^)]*PCT[^)]*\)', m.get('sql',''), re.I):
        errors.append(f"SUM-ON-PCT {m['name']}")
    actual = cols.get(m.get('dataset',''), set())
    for col in re.findall(r'"[^"]+"\."([^"]+)"', m.get('sql','')):
        if actual and col not in actual: errors.append(f"METRIC PHANTOM {m['name']} col={col}")

# Phantom fields
for ds in datasets:
    actual = cols.get(ds['tableId'], set())
    for f in ds.get('fields', []):
        if actual and f['name'] not in actual: errors.append(f"PHANTOM FIELD {ds['name']}.{f['name']}")

# Constraint orphans
for c in constraints:
    for mn in (c.get('metrics') or []):
        if mn not in metric_names: errors.append(f"CONSTRAINT ORPHAN {c['name']} → '{mn}'")
    if not any(c['name'].lower().endswith(s) for s in ('_critical','_warning','_healthy','_review')):
        warnings.append(f"constraint '{c['name']}' missing severity suffix")

for e in sorted(set(errors)):   print(f"✗ {e}")
for w in sorted(set(warnings)): print(f"⚠ {w}")
if not errors: print("✓ clean")
```

Fix all errors and re-run until `✓ clean`.

---

## Step 5 — Confirm & Push

Show summary and ask *"Confirm model name and say 'go'."* Never push without explicit 'go'.

```python
import json, urllib.request, urllib.error, time
from concurrent.futures import ThreadPoolExecutor

model     = json.load(open('/tmp/sl_model.json'))
UPDATE_ID = open('/tmp/sl_update_id.txt').read().strip() or None
DB_NAME   = open('/tmp/sl_db_name.txt').read().strip()
H         = {'X-StorageAPI-Token': TOKEN, 'Content-Type': 'application/json'}

def api_post(path, body):
    req = urllib.request.Request(f"{METASTORE}{path}", json.dumps(body).encode(), H, method='POST')
    with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read())

def push_item(type_path, item, name_key, uuid, retries=3):
    data = {**item, 'modelUUID': uuid}
    if type_path == 'semantic-dataset':
        t = item['tableId'].split('.')
        data['fqn'] = f'"{DB_NAME}"."{".".join(t[:-1])}"."{t[-1]}"'
    for attempt in range(retries):
        try:
            api_post(f'/api/v1/repository/{type_path}',
                     {'name': item.get(name_key), 'data': data,
                      'branch': 'main', 'schemaVersion': '1.0.0', 'scope': 'project'})
            return True, item.get(name_key), None
        except Exception as e:
            if attempt == retries - 1: return False, item.get(name_key), str(e)
            time.sleep(1)

if UPDATE_ID:
    uuid = UPDATE_ID
else:
    uuid = api_post('/api/v1/repository/semantic-model', {
        'name': model['name'],
        'data': {'name': model['name'], 'description': model['description'], 'sql_dialect': 'Snowflake'},
        'branch': 'main', 'schemaVersion': '1.0.0', 'scope': 'project'
    })['data']['id']
    print(f'✓ model created {uuid}')

for type_path, items, key in [
    ('semantic-dataset',      model.get('datasets', []),     'name'),
    ('semantic-metric',       model.get('metrics', []),      'name'),
    ('semantic-relationship', model.get('relationships', []),'name'),
    ('semantic-glossary',     model.get('glossary', []),     'term'),
    ('semantic-constraint',   model.get('constraints', []),  'name'),
]:
    if not items: continue
    ok = fail = 0
    with ThreadPoolExecutor(max_workers=4) as ex:
        for s, n, e in ex.map(lambda i: push_item(type_path, i, key, uuid), items):
            if s: ok += 1
            else: fail += 1; print(f'  ✗ {n}: {e}')
    print(f"  {'✓' if not fail else '⚠'} {type_path}: {ok}/{len(items)}")
```
