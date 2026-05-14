---
name: sl-validate
description: Validate a Keboola semantic layer model — check for duplicate names, dangling references, constraint orphans, AGG-on-STRING, SUM-on-PCT, and optionally phantom fields against actual Snowflake schemas. Use when the user says "validate the model", "check the SL", "is the model clean", etc.
allowed-tools:
  - Bash
  - AskUserQuestion
argument-hint: "[project-alias] [--deep]"
---

# Validate Semantic Layer Model

## 1. Resolve project + model

List aliases and ask if not provided. Use the **setup recipe** from the `semantic-layer` skill to get `TOKEN` and `METASTORE`. Fetch and pick a model to get `MODEL_UUID`.

## 2. Fetch all entity types in parallel

```python
from concurrent.futures import ThreadPoolExecutor
import urllib.request, json

TYPES = ['semantic-dataset','semantic-metric','semantic-relationship',
         'semantic-glossary','semantic-constraint']

def fetch(t):
    req = urllib.request.Request(f"{METASTORE}/api/v1/repository/{t}",
                                  headers={'X-StorageAPI-Token': TOKEN})
    items = json.loads(urllib.request.urlopen(req, timeout=15).read()).get('data', [])
    return t, [i['attributes'] for i in items
               if i.get('attributes', {}).get('modelUUID') == MODEL_UUID]

model = dict(ThreadPoolExecutor(max_workers=5).map(fetch, TYPES))
datasets, metrics, relationships = (model[t] for t in
    ['semantic-dataset','semantic-metric','semantic-relationship'])
constraints = model['semantic-constraint']
```

## 3. Run checks

Use the **validation rules** from the `semantic-layer` skill as the checklist. Run all rules:

```python
import re

errors, warnings = [], []
all_tids     = {ds['tableId'] for ds in datasets}
metric_names = {m['name'] for m in metrics}

# Duplicates
for section, key, items in [('datasets','name',datasets),('metrics','name',metrics),
                              ('relationships','name',relationships),('glossary','term',model['semantic-glossary'])]:
    names = [i[key] for i in items]
    dups  = {n for n in names if names.count(n) > 1}
    if dups: errors.append(f"DUPLICATES in {section}: {dups}")

# Dangling relationship sides
for r in relationships:
    for side, tid in [('from', r.get('from','')), ('to', r.get('to',''))]:
        if tid and tid not in all_tids:
            errors.append(f"DANGLING REL {r['name']}.{side}={tid}")

# Dangling metric dataset
for m in metrics:
    if m.get('dataset') and m['dataset'] not in all_tids:
        errors.append(f"DANGLING METRIC '{m['name']}' dataset={m['dataset']}")
    if re.search(r'SUM\([^)]*PCT[^)]*\)', m.get('sql',''), re.I):
        errors.append(f"SUM-ON-PCT '{m['name']}'")

# Constraint orphans + severity suffix
for c in constraints:
    for mn in (c.get('metrics') or []):
        if mn not in metric_names:
            errors.append(f"CONSTRAINT ORPHAN '{c['name']}' → '{mn}' not in model")
    if not any(c['name'].lower().endswith(s) for s in ('_critical','_warning','_healthy','_review')):
        warnings.append(f"constraint '{c['name']}' missing severity suffix")

for e in sorted(set(errors)):   print(f"✗ {e}")
for w in sorted(set(warnings)): print(f"⚠ {w}")
if not errors: print("✓ clean")
```

## 4. Deep check (--deep flag)

First detect kbagent:
```bash
command -v kbagent &>/dev/null && echo "kbagent available" || echo "kbagent not installed — skipping deep check"
```

If kbagent is **not available**, skip deep checks and report: *"Basic validation passed. Install kbagent for deep schema checks (phantom fields, type mismatches)."*

If kbagent **is available**, fetch Snowflake column details per dataset and check for:
- **PHANTOM FIELD** — field name not in actual Snowflake columns
- **TYPE MISMATCH** — declared type conflicts with Snowflake column type
- **METRIC PHANTOM** — column in metric `sql` not in its table
- **AGG ON STRING** — `SUM`/`AVG` directly on a STRING column

```python
import subprocess, json, os, re
ENV = {**os.environ, 'KBAGENT_CONVERSATION_ID': __import__('uuid').uuid4().hex}

for ds in datasets:
    r = subprocess.run(['kbagent','--json','storage','table-detail',
                        '--project','PROJECT_ALIAS','--table-id', ds['tableId']],
                       capture_output=True, text=True, env=ENV)
    try:
        d     = json.loads(r.stdout).get('data', {})
        cols  = set(d.get('columns', []))
        types = {c['name']: c.get('type','') for c in d.get('column_details', [])}
    except: continue
    for f in ds.get('fields', []):
        if cols and f['name'] not in cols:
            errors.append(f"PHANTOM FIELD {ds['name']}.{f['name']}")
        sf = types.get(f['name'])
        if sf == 'STRING' and f.get('type') not in ('string','json'):
            warnings.append(f"TYPE MISMATCH {ds['name']}.{f['name']}: declared {f.get('type')} but Snowflake STRING")
    for m in [m for m in metrics if m.get('dataset') == ds['tableId']]:
        for col in re.findall(r'"[^"]+"."([^"]+)"', m.get('sql','')):
            if cols and col not in cols:
                errors.append(f"METRIC PHANTOM '{m['name']}' col={col}")
        for col in re.findall(r'\b(?:SUM|AVG)\s*\(\s*"[^"]+"."([^"]+)"\s*\)', m.get('sql',''), re.I):
            if types.get(col) == 'STRING':
                errors.append(f"AGG ON STRING '{m['name']}' col={col}")
```

Report a final count: `N errors, M warnings` or `✓ model is valid`.
