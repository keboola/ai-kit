---
name: powerbi-to-sl
description: >-
  Use this skill to migrate an existing Microsoft Power BI semantic model into
  a Keboola semantic layer model. Accepts two input shapes: (1) TMDL folder
  extracted with the Microsoft Power BI Modeling MCP server in `--readonly`
  mode (canonical, captures DAX + Power Query M expressions verbatim);
  (2) per-table JSON produced by older `get_semantic_model` calls (missing
  M steps). Maps Power BI tables → Keboola semantic-dataset, measures →
  semantic-metric (DAX preserved verbatim, flagged for SQL translation),
  relationships → semantic-relationship. Produces JSON files ready to push
  to the Keboola metastore via `sl-toolkit` or the REST API.
  Use for: migrate PowerBI semantic model, convert Power BI to Keboola SL,
  translate TMDL, import PowerBI tables, powerbi-to-sl, pbi-migration,
  brownfield semantic layer. Trigger when the user has PowerBI artifacts
  (TMDL folder, `*_semantic_layer.json`, `.bim`, `.pbip`) and wants them as
  a Keboola semantic layer.
---

# powerbi-to-sl — Power BI → Keboola Semantic Layer Migration

Read existing PowerBI artifacts → map to Keboola SL payloads → write JSON
files → user confirms → push via `sl-toolkit` or direct REST. Companion to
`sl-toolkit` (greenfield); this is the brownfield path.

---

## Step 0 — Identify input

Ask the user where the PowerBI artifacts are, then auto-detect format:

```bash
INPUT_DIR="$(read -p 'Path to PowerBI artifacts: ' x; echo "$x")"
python3 -c "
import os, sys
p = sys.argv[1]
tmdl = [f for f in os.listdir(p) if f.endswith('.tmdl')] if os.path.isdir(p) else []
jsons = [f for f in os.listdir(p) if f.endswith('_semantic_layer.json')] if os.path.isdir(p) else []
if tmdl: print('tmdl')
elif jsons: print('per-table-json')
else: print('unknown')
" "$INPUT_DIR"
```

If `unknown`, ask the user to clarify, or have them run Microsoft's Power BI
Modeling MCP with `--readonly` against their dataset to produce TMDL first.

---

## Step 1 — Business questions (before mapping)

> "Three quick questions:
> 1. **What is the Keboola bucket prefix for these tables?** (e.g.,
>    `in.c-pbi-migration` — used to build `tableId` for each
>    semantic-dataset)
> 2. **Semantic model name + display name?** (e.g.,
>    `acme-pbi-migration` / "Acme Power BI Migration")
> 3. **Snowflake or BigQuery dialect?** (default: Snowflake)"

Persist answers as `BUCKET_PREFIX`, `MODEL_NAME`, `MODEL_DISPLAY`, `DIALECT`.

---

## Step 2 — Run the migrator

```bash
python3 scripts/migrate.py \
  --input "$INPUT_DIR" \
  --input-format "$FORMAT" \
  --bucket-prefix "$BUCKET_PREFIX" \
  --model-name "$MODEL_NAME" \
  --model-display "$MODEL_DISPLAY" \
  --dialect "$DIALECT" \
  --output ./out/
```

Output layout:

```
out/
  semantic-model.json
  semantic-dataset/
    <bucket-prefix>.<table>.json   # one per PowerBI table
  semantic-metric/
    <measure-slug>.json            # one per PowerBI measure
  semantic-relationship/
    <from>__<to>.json              # one per PowerBI relationship
  WARNINGS.md                      # DAX-not-translated, unmapped types, etc.
```

---

## Step 3 — Review WARNINGS.md with the user

The migrator preserves DAX measure expressions verbatim in
`semantic-metric.sql`. Show the user `WARNINGS.md` and ask whether to:

- **Punt** — leave DAX in place; downstream Kai (or a human) rewrites as SQL
  on-demand.
- **Auto-translate trivial cases** — `SUM('Table'[Col])` → `SUM("Table"."Col")`,
  `COUNT`, `DISTINCTCOUNT`, `AVERAGE`. Anything with `CALCULATE`, filter
  context, `RELATED`, time-intelligence, or variables stays flagged.
- **Human pass** — open the WARNINGS list and rewrite line by line.

Default: punt + show the list. Trivial-case translation is opt-in.

---

## Step 4 — Validate against Keboola SL schemas (jsonschema)

```bash
python3 -c "
import json, jsonschema, glob, sys, os
schemas_dir = os.environ['SCHEMAS_DIR']
schemas = {
    name: json.load(open(f'{schemas_dir}/semantic-{name}_schema_1.0.0.json'))
    for name in ['model','dataset','metric','relationship']
}
errs = 0
for kind, schema in schemas.items():
    pattern = './out/semantic-model.json' if kind == 'model' else f'./out/semantic-{kind}/*.json'
    for f in glob.glob(pattern):
        try:
            jsonschema.validate(json.load(open(f)), schema)
        except jsonschema.ValidationError as e:
            errs += 1
            print(f'❌ {f}: {e.message}')
print(f'{errs} validation errors' if errs else '✅ all valid')
"
```

The same validation runs as a pytest assertion in `tests/test_smoke.py`. Set
`SCHEMAS_DIR` to the directory containing the Keboola metastore semantic-*
JSON schemas.

---

## Step 5 — Push (optional, gated on user confirmation)

Confirm with the user before any write. Two paths:

**Path A — via `sl-toolkit`** (preferred if that plugin is installed; it
owns the canonical generate–validate–push pipeline):

> "Hand off to `sl-toolkit`? It owns the canonical push pipeline for any
> SL model. Or push directly to the metastore REST API?"

If `sl-toolkit` chosen, invoke its push step with `--source ./out/`.

**Path B — direct REST** (when `sl-toolkit` is not available):

```python
import json, os, urllib.request, glob
from concurrent.futures import ThreadPoolExecutor
TOKEN = os.environ['KBC_STORAGE_TOKEN']
METASTORE = os.environ['KBC_METASTORE_URL']  # e.g. https://metastore.us-east4.gcp.keboola.com

def post(kind, payload):
    req = urllib.request.Request(
        f'{METASTORE}/api/v1/repository/semantic-{kind}',
        data=json.dumps(payload).encode(),
        headers={'X-StorageAPI-Token': TOKEN, 'Content-Type': 'application/json'},
        method='POST')
    return urllib.request.urlopen(req, timeout=30).read()

# Model first — get the UUID, propagate to children
model_uuid = json.loads(post('model', json.load(open('./out/semantic-model.json'))))['data']['id']
for kind in ['dataset','metric','relationship']:
    payloads = []
    for f in glob.glob(f'./out/semantic-{kind}/*.json'):
        p = json.load(open(f))
        p['modelUUID'] = model_uuid
        payloads.append(p)
    with ThreadPoolExecutor(max_workers=10) as ex:
        list(ex.map(lambda p: post(kind, p), payloads))
```

---

## Mapping reference

| Power BI                                | Keboola SL                          |
|-----------------------------------------|-------------------------------------|
| `tables[].name`                         | `semantic-dataset.name` + `tableId` |
| `tables[].description`                  | `semantic-dataset.description`      |
| `tables[].columns[].name`               | `semantic-dataset.fields[].name`    |
| `tables[].columns[].dataType`           | `semantic-dataset.fields[].type` *  |
| `tables[].columns[].description`        | `semantic-dataset.fields[].description` |
| PK column hints                         | `semantic-dataset.primaryKey`       |
| `tables[].measures[].expression` (DAX)  | `semantic-metric.sql` (verbatim)    |
| `tables[].measures[].description`       | `semantic-metric.description`       |
| `relationships[]`                       | `semantic-relationship`             |

*Type mapping*: `string`→`string`, `int64`/`integer`→`integer`,
`double`/`decimal`/`currency`→`decimal`, `dateTime`/`date`→`datetime`/`date`,
`boolean`→`boolean`. Unknown types fall back to `string` and get logged.

---

## Known gotchas

- **Per-table JSON loses Power Query M steps.** The older
  `get_semantic_model` output does not capture M expressions. If full
  fidelity is required, re-extract with Microsoft's Power BI Modeling MCP
  `--readonly` flag to produce TMDL, which captures DAX **and** M natively.
- **DAX ≠ SQL.** Verbatim preservation is the default; downstream Kai or a
  human translates. `CALCULATE`, `RELATED`, time-intelligence, and variables
  do not survive trivial translation.
- **PowerBI table names contain spaces and non-ASCII characters.** Slugify
  for filenames; keep originals in `name`/`displayName`. UTF-8 paths are
  fine on macOS/Linux but watch for filesystem-quirky environments.
- **PK detection is best-effort.** Power BI doesn't always mark PKs
  explicitly; the migrator uses (a) explicit `isKey` markers in TMDL,
  (b) relationship `to` columns as a heuristic, (c) falls back to empty
  primaryKey + a WARNINGS entry asking the user to pick.
- **Relationship cardinality.** `manyToOne` and `oneToOne` → `inner`;
  `oneToMany` → `left` from the "many" side. `manyToMany` produces a
  WARNINGS entry — the SL model expects star-schema friendliness.

---

## Why two skills exist (powerbi-to-sl vs. sl-toolkit)

| Aspect       | `sl-toolkit`                          | `powerbi-to-sl` (this)            |
|--------------|---------------------------------------|-----------------------------------|
| Direction    | Greenfield (Keboola tables → SL)      | Brownfield (Power BI → SL)        |
| Input        | Keboola storage + SQL transformations | TMDL folder or per-table JSON     |
| Generation   | LLM-driven from schema + KPIs         | Mechanical structural translation |
| Validation   | Auto-fix + LLM critique               | jsonschema validate + WARNINGS    |
| Push         | Owns push pipeline                    | Hands off to `sl-toolkit` push    |

When both are installed, this skill *produces* SL payloads and *delegates*
push to `sl-toolkit`. Reuse, not overlap.
