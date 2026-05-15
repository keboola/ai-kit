# sl-builder tests

Regression tests for the semantic-layer plugin. Catches the class of bug Jordan flagged in PR #72 (camelCase drift) and PR #74 (hardcoded KEBOOLA, missing constraint push, etc.).

## Run

```bash
pip install -r plugins/sl-builder/tests/requirements.txt
python -m pytest plugins/sl-builder/tests/ -v
```

## What's tested

| File | Covers |
|---|---|
| `test_smoke.py` | jsonschema round-trip for all 6 entity types (envelope + data shape), `sqlDialect` camelCase invariant, constraint severity suffix, FQN uses `KEBOOLA_<projectId>` |
| `test_fqn.py` | `db_name()` token-verify success / cache hit / HTTP error fallback / malformed response. `fqn()` three-part construction with dotted schemas |
| `test_skill_consistency.py` | Greps `SKILL.md` and command markdowns to assert: no hardcoded `KEBOOLA` fqn, `sqlDialect` not `sql_dialect`, no `allowed-tools` in reference-skill frontmatter, multi-cloud regex (`gcp\|aws\|azure`), no literal placeholder strings, push loop includes `semantic-constraint`, VERSION rule instructs probing |

## Fixtures and schemas

- `fixtures/<entity>.json` — minimal valid POST envelope as Step 5 of `/sl-build` would send
- `schemas/envelope.json` — shared outer envelope (name/data/branch/schemaVersion/scope)
- `schemas/<entity>.json` — `data` field schema per entity type

Schemas are derived from the payload shapes documented in `SKILL.md`. They're a defensive checked-in copy; the source of truth is the live metastore API. If the metastore tightens or relaxes a constraint, update the schema here too.

## Adding a new entity type

1. Add `fixtures/<new-type>.json` with a minimal valid envelope.
2. Add `schemas/<new-type>.json` with its `data` field schema.
3. Add the type to `ENTITY_TYPES` in `test_smoke.py`.
4. Add a regex assertion in `test_skill_consistency.py` if the entity has invariants that should not drift.
