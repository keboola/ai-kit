---
name: sl-add
description: Add a single entity (metric, dataset, relationship, glossary term, or constraint) to an existing Keboola semantic layer model. Use when the user says "add a metric", "add a constraint", "add a dataset", "create a new metric", etc.
allowed-tools:
  - Bash
  - AskUserQuestion
argument-hint: "[project-alias]"
---

# Add Semantic Layer Entity

## 1. Clarify what to add

From the user's message determine: **type** (metric / dataset / relationship / glossary / constraint) and the key details (name, sql, tableId, bounds, etc.). Ask once if unclear.

## 2. Resolve project + model

List aliases and ask if not provided. Use the **setup recipe** from the `semantic-layer` skill to get `TOKEN` and `METASTORE`. Then:

```python
import urllib.request, json
req = urllib.request.Request(f"{METASTORE}/api/v1/repository/semantic-model",
                              headers={'X-StorageAPI-Token': TOKEN})
models = json.loads(urllib.request.urlopen(req, timeout=15).read()).get('data', [])
# use the only model, or ask user to pick
MODEL_UUID = models[0]['id']
```

## 3. Build payload

Use the **payload shapes** from the `semantic-layer` skill. Key rules:
- `metric.dataset` = tableId (not dataset name)
- `dataset.fqn` = `"KEBOOLA"."<bucket>"."<table>"` (split tableId on last dot)
- `constraint.name` must end in `_critical` / `_warning` / `_healthy` / `_review`
- `constraint.metrics[]` must contain exact names of existing semantic-metrics

Show the user the payload before posting.

## 4. POST

```python
import urllib.request, json, urllib.error

H    = {'X-StorageAPI-Token': TOKEN, 'Content-Type': 'application/json'}
TYPE = 'semantic-metric'   # replace with actual type
ITEM = { ...payload... }   # replace with actual payload

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
