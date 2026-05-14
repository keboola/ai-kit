---
name: sl-show
description: Inspect a Keboola semantic layer model — list datasets, metrics, relationships, constraints, and glossary. Use when the user wants to see what's in the semantic layer, browse metrics, or check model contents.
allowed-tools:
  - Bash
  - AskUserQuestion
argument-hint: "[project-alias] [--type metric|dataset|relationship|constraint|glossary]"
---

# Show Semantic Layer Model

## 1. Resolve credentials

Use the **setup recipe** from the `semantic-layer` skill (3-step fallback: env vars → kbagent config → ask user).

If kbagent is installed, list available aliases first:
```python
import json, os
cfg_path = os.path.expanduser('~/Library/Application Support/keboola-agent-cli/config.json')
if os.path.exists(cfg_path):
    cfg = json.load(open(cfg_path))
    for alias in sorted(cfg['projects']): print(alias)
```
Use the argument if provided, the only alias if just one exists, otherwise ask.
If kbagent is not installed, ask for token + connection URL directly (see setup recipe).

## 2. Pick a model

```python
import urllib.request, json
req = urllib.request.Request(f"{METASTORE}/api/v1/repository/semantic-model",
                              headers={'X-StorageAPI-Token': TOKEN})
models = json.loads(urllib.request.urlopen(req, timeout=15).read()).get('data', [])
for m in models: print(m['id'], m.get('attributes', {}).get('name', '?'))
```
Use the only model if one exists; ask if multiple. Store as `MODEL_UUID`.

## 3. Fetch all entity types in parallel

```python
from concurrent.futures import ThreadPoolExecutor

TYPES = ['semantic-dataset','semantic-metric','semantic-relationship',
         'semantic-glossary','semantic-constraint']

def fetch(t):
    req = urllib.request.Request(f"{METASTORE}/api/v1/repository/{t}",
                                  headers={'X-StorageAPI-Token': TOKEN})
    items = json.loads(urllib.request.urlopen(req, timeout=15).read()).get('data', [])
    return t, [i['attributes'] for i in items
               if i.get('attributes', {}).get('modelUUID') == MODEL_UUID]

with ThreadPoolExecutor(max_workers=5) as ex:
    results = dict(ex.map(fetch, TYPES))
```

## 4. Display

If `--type` was given, show that section in full detail. Otherwise show grouped summary:

```
Model: <name>  |  <project alias>

Datasets (N):      · <name> — <tableId>  [<N> fields]
Metrics (N):       · <name> — <sql preview, first 60 chars>
Relationships (N): · <name>: <from_table> → <to_table>  [<type>]
Constraints (N):   · <name>  [<severity>]  metrics: <list>
Glossary (N):      · <term>: <definition preview>
```
