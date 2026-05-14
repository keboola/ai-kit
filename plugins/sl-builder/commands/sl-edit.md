---
name: sl-edit
description: Edit an existing entity in a Keboola semantic layer model — rename a metric, fix a SQL formula, update a constraint threshold, change a field description, etc. Use when the user says "edit metric X", "fix the sql on", "rename", "update threshold", "change description", etc.
allowed-tools:
  - Bash
  - AskUserQuestion
argument-hint: "[project-alias]"
---

# Edit Semantic Layer Entity

The metastore has no PATCH endpoint — editing is DELETE old + POST updated.

## 1. Clarify what to change

Determine: **type**, **item name**, and **which fields** change. Ask if unclear.

## 2. Resolve project + model

List aliases and ask if not provided. Use the **setup recipe** from the `semantic-layer` skill to get `TOKEN` and `METASTORE`. Fetch and pick a model to get `MODEL_UUID`.

## 3. Fetch the existing item

```python
import urllib.request, json

TYPE = 'semantic-metric'   # replace with actual type
req  = urllib.request.Request(f"{METASTORE}/api/v1/repository/{TYPE}",
                               headers={'X-StorageAPI-Token': TOKEN})
all_items = json.loads(urllib.request.urlopen(req, timeout=15).read()).get('data', [])

items  = [i for i in all_items if i.get('attributes', {}).get('modelUUID') == MODEL_UUID]
target = next((i for i in items
               if i.get('attributes', {}).get('name', '').lower() == TARGET_NAME.lower()), None)

if not target:
    print("Not found. Available:", [i['attributes'].get('name') for i in items])
```

## 4. Show diff and confirm

Display only the fields that will change: current value → new value.

**If renaming a metric**, also fetch constraints and show which ones will be auto-updated:

```python
import re

OLD_NAME = target['attributes']['name']
NEW_NAME = NEW_ATTRS['name']  # the new name being applied
is_rename = TYPE == 'semantic-metric' and OLD_NAME != NEW_NAME

affected_constraints = []
if is_rename:
    req = urllib.request.Request(f"{METASTORE}/api/v1/repository/semantic-constraint",
                                  headers={'X-StorageAPI-Token': TOKEN})
    all_constraints = json.loads(urllib.request.urlopen(req, timeout=15).read()).get('data', [])
    affected_constraints = [
        c for c in all_constraints
        if c.get('attributes', {}).get('modelUUID') == MODEL_UUID
        and OLD_NAME in (c.get('attributes', {}).get('metrics') or [])
    ]
    old_code = re.sub(r"[^A-Z0-9]+", "_", OLD_NAME.upper())
    new_code = re.sub(r"[^A-Z0-9]+", "_", NEW_NAME.upper())
    print(f"Rename: '{OLD_NAME}' → '{NEW_NAME}'")
    print(f"CODE_METRIC: {old_code} → {new_code}  ⚠ update any pipeline SQL joining on this key")
    if affected_constraints:
        print(f"Constraints to auto-update ({len(affected_constraints)}): "
              + ", ".join(c['attributes']['name'] for c in affected_constraints))
    else:
        print("No constraints reference this metric.")
```

Ask the user to confirm. Do not proceed without confirmation.

## 5. Delete old, POST updated — then cascade constraint updates

```python
import urllib.request, json, urllib.error

H = {'X-StorageAPI-Token': TOKEN, 'Content-Type': 'application/json'}

# Delete old metric
urllib.request.urlopen(
    urllib.request.Request(f"{METASTORE}/api/v1/repository/{TYPE}/{target['id']}",
                            headers=H, method='DELETE'), timeout=15)

# POST updated metric
body = {
    "name": NEW_ATTRS.get('name') or NEW_ATTRS.get('term'),
    "data": {**NEW_ATTRS, "modelUUID": MODEL_UUID},
    "branch": "main", "schemaVersion": "1.0.0", "scope": "project"
}
req = urllib.request.Request(f"{METASTORE}/api/v1/repository/{TYPE}",
                              json.dumps(body).encode(), H, method='POST')
try:
    r = json.loads(urllib.request.urlopen(req, timeout=30).read())
    print(f"✓ Updated metric: {r['data']['id']}")
except urllib.error.HTTPError as e:
    print(f"✗ {e.code}: {e.read().decode()[:300]}")

# Auto-update affected constraints (rename only)
for c in affected_constraints:
    c_attrs = {**c['attributes']}
    c_attrs['metrics'] = [NEW_NAME if m == OLD_NAME else m
                          for m in c_attrs.get('metrics', [])]
    # Delete old constraint
    urllib.request.urlopen(
        urllib.request.Request(f"{METASTORE}/api/v1/repository/semantic-constraint/{c['id']}",
                                headers=H, method='DELETE'), timeout=15)
    # POST updated constraint
    c_body = {
        "name": c_attrs['name'],
        "data": {**c_attrs, "modelUUID": MODEL_UUID},
        "branch": "main", "schemaVersion": "1.0.0", "scope": "project"
    }
    c_req = urllib.request.Request(f"{METASTORE}/api/v1/repository/semantic-constraint",
                                    json.dumps(c_body).encode(), H, method='POST')
    try:
        cr = json.loads(urllib.request.urlopen(c_req, timeout=30).read())
        print(f"  ✓ Constraint updated: {c_attrs['name']}")
    except urllib.error.HTTPError as e:
        print(f"  ✗ Constraint {c_attrs['name']}: {e.code}: {e.read().decode()[:200]}")
```

Confirm the change to the user with a brief summary: metric updated + N constraints cascaded.
