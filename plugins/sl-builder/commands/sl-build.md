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

Use the **setup recipe** from the `semantic-layer` skill to get `TOKEN` and `METASTORE`
(env vars → kbagent config → ask user). **Never auto-select a project.**

Detect kbagent and check for existing models in parallel:

```bash
# Detect kbagent
KBAGENT_AVAILABLE=false
command -v kbagent &>/dev/null && KBAGENT_AVAILABLE=true

# Always: check for existing models
python3 -c "
import json, urllib.request, os
token='TOKEN'; metastore='METASTORE'
req = urllib.request.Request(metastore+'/api/v1/repository/semantic-model', headers={'X-StorageAPI-Token': token})
existing = json.loads(urllib.request.urlopen(req, timeout=15).read()).get('data', [])
print('EXISTING='+json.dumps([{'id': m['id'], 'name': m.get('attributes',{}).get('name','?')} for m in existing]))
" &

# If kbagent available: fetch table list too
if $KBAGENT_AVAILABLE; then
    kbagent --json storage tables --project PROJECT > /tmp/sl_tables.json &
fi
wait
```

If kbagent is **not** available: skip Step 2 schema fetch — ask the user instead:
*"No kbagent detected. Please describe your tables (names + what they contain) and top KPIs, and I'll generate the model from that."*
Then proceed directly to Step 3 using the user's description.

If models already exist ask: **"Update an existing model or create new?"**
Store chosen model id as `UPDATE_ID` (or `None` for new).

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

ENV = {**os.environ, 'KBAGENT_CONVERSATION_ID': 'CONV_ID'}

def fetch_schema(tid):
    r = subprocess.run(['kbagent','--json','storage','table-detail','--project','PROJECT','--table-id',tid],
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
kbagent --json config list --project PROJECT > /tmp/sl_transforms.json 2>/dev/null || echo '{}' > /tmp/sl_transforms.json
```

Extract SQL from `keboola.snowflake-transformation` configs and use it to inform metric formulas in Step 3.

---

## Step 3 — Generate

Build `/tmp/sl_model.json` with keys `name`, `description`, `datasets`, `metrics`, `relationships`, `glossary`.
Use **payload shapes, field roles, VERSION rule, and constraint encoding** from the `semantic-layer` skill.
Prefer SQL formulas found in transformation context over guesses.

---

## Step 4 — Validate

Run the checks from `/sl-validate` inline against `/tmp/sl_model.json` + `/tmp/sl_schemas.json`.
Fix all errors and re-run until `✓ clean`.

---

## Step 5 — Confirm & Push

Show summary and ask *"Confirm model name and say 'go'."* Never push without explicit 'go'.

```python
import json, urllib.request, urllib.error, time
from concurrent.futures import ThreadPoolExecutor

model = json.load(open('/tmp/sl_model.json'))
H     = {'X-StorageAPI-Token': TOKEN, 'Content-Type': 'application/json'}

def api_post(path, body):
    req = urllib.request.Request(f"{METASTORE}{path}", json.dumps(body).encode(), H, method='POST')
    with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read())

def push_item(type_path, item, name_key, uuid, retries=3):
    data = {**item, 'modelUUID': uuid}
    if type_path == 'semantic-dataset':
        t = item['tableId'].split('.')
        data['fqn'] = f'"KEBOOLA"."{".".join(t[:-1])}"."{t[-1]}"'
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
    print(f"✓ model created {uuid}")

for type_path, items, key in [
    ('semantic-dataset', model['datasets'], 'name'),
    ('semantic-metric',  model['metrics'],  'name'),
    ('semantic-relationship', model['relationships'], 'name'),
    ('semantic-glossary', model['glossary'], 'term'),
]:
    ok = fail = 0
    with ThreadPoolExecutor(max_workers=4) as ex:
        for s, n, e in ex.map(lambda i: push_item(type_path, i, key, uuid), items):
            if s: ok += 1
            else: fail += 1; print(f"  ✗ {n}: {e}")
    print(f"  {'✓' if not fail else '⚠'} {type_path}: {ok}/{len(items)}")
```
