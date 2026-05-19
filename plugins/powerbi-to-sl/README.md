# powerbi-to-sl

Migrate an existing Microsoft Power BI semantic model into a Keboola semantic
layer model conforming to the metastore service schemas
(`semantic-model_schema_1.0.0.json` + siblings).

Brownfield companion to [`sl-toolkit`](../sl-toolkit/). Where `sl-toolkit`
generates a new semantic layer from Keboola tables + business questions,
`powerbi-to-sl` translates an existing Power BI model structurally — tables,
columns, measures, relationships — and hands the resulting payloads to
`sl-toolkit`'s push pipeline (or to direct REST).

## Inputs

Two shapes are accepted (auto-detected, override via `--input-format`):

1. **TMDL folder** — extracted via the Microsoft Power BI Modeling MCP server
   in `--readonly` mode. Captures DAX **and** Power Query M expressions
   verbatim. **Canonical input format.**
2. **Per-table JSON** — one `*_semantic_layer.json` file per Power BI table,
   produced by older `get_semantic_model` calls. Missing Power Query M steps;
   acceptable for structural migration when full fidelity isn't required.

## Output

JSON files under `<out>/` matching the Keboola metastore semantic-* schemas:

```
out/
  semantic-model.json
  semantic-dataset/<table-slug>.json     # one per Power BI table
  semantic-metric/<measure-slug>.json    # one per Power BI measure
  semantic-relationship/<from>__<to>.json
  WARNINGS.md                            # un-mapped types, complex DAX, etc.
```

Push is **not** automatic. The skill produces files; `sl-toolkit` (or the
user directly) handles the push to the Keboola metastore.

## Run

```bash
python3 scripts/migrate.py \
  --input <path-to-powerbi-artifacts> \
  --input-format tmdl \
  --bucket-prefix in.c-pbi-migration \
  --model-name my-pbi-migration \
  --output ./out/
```

See `python3 scripts/migrate.py --help` for all options.

## Tests

```bash
python3 -m pytest tests/
```

Eight smoke tests, including a real `jsonschema.validate` round-trip against
the Keboola metastore schemas. The schema-validation test is skipped if the
schemas aren't on disk; set `SCHEMAS_DIR` to override the default location.

## Mapping at a glance

| Power BI                                | Keboola SL                          |
|-----------------------------------------|-------------------------------------|
| `tables[].name`                         | `semantic-dataset.name` + `tableId` |
| `tables[].columns[].dataType`           | `semantic-dataset.fields[].type` *  |
| Explicit `isKey` columns                | `semantic-dataset.primaryKey`       |
| `tables[].measures[].expression` (DAX)  | `semantic-metric.sql` (verbatim)    |
| `relationships[]`                       | `semantic-relationship`             |

DAX is preserved verbatim — downstream Kai (or a human) translates as needed.
Complex DAX (`CALCULATE`, `RELATED`, `VAR`, time-intelligence) is flagged in
`WARNINGS.md`.
