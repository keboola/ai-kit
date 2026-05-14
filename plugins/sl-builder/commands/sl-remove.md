---
name: sl-remove
description: Delete a single entity from a Keboola semantic layer model — remove a metric, dataset, relationship, constraint, or glossary term. Use when the user says "remove metric X", "delete constraint Y", "drop dataset Z", etc.
allowed-tools:
  - Bash
  - AskUserQuestion
argument-hint: "[project-alias]"
---

# Remove Semantic Layer Entity

Always confirm the exact item before deleting.

## 1. Clarify what to remove

Determine **type** and **item name** from the user's message. Ask if the type is ambiguous.

## 2. Resolve project + model

List aliases and ask if not provided. Use the **setup recipe** from the `semantic-layer` skill to get `TOKEN` and `METASTORE`. Fetch and pick a model to get `MODEL_UUID`.

## 3. Find the item

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

## 4. Confirm

Show the item name, type, and one key field (e.g. `sql` for metrics, `tableId` for datasets).
Ask: *"Delete `<name>` (<type>)? Say 'yes' to confirm."* Do not delete without confirmation.

**⚠ Removing a metric** referenced in constraints creates orphan entries in downstream
`DIM_METRIC_THRESHOLD` tables. Check before deleting:
```python
req = urllib.request.Request(f"{METASTORE}/api/v1/repository/semantic-constraint",
                              headers={'X-StorageAPI-Token': TOKEN})
constraints = json.loads(urllib.request.urlopen(req, timeout=15).read()).get('data', [])
refs = [c['attributes']['name'] for c in constraints
        if TARGET_NAME in (c.get('attributes', {}).get('metrics') or [])]
if refs: print(f"⚠ Constraints referencing this metric: {refs}")
```

## 5. Delete

```python
import urllib.request
urllib.request.urlopen(
    urllib.request.Request(
        f"{METASTORE}/api/v1/repository/{TYPE}/{target['id']}",
        headers={'X-StorageAPI-Token': TOKEN}, method='DELETE'), timeout=15)
print(f"✓ Deleted: {target['attributes'].get('name')}")
```
