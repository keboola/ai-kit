# sl-builder Plugin

Semantic layer helper tools for Keboola — inspect, add, edit, remove, validate, and build semantic models via the metastore API. Works with or without the Semantic Layer data app.

## Installation

```bash
/plugin install sl-builder
```

## Commands

| Command | Description |
|---|---|
| `/sl-show` | List all datasets, metrics, relationships, constraints, and glossary terms in a model |
| `/sl-validate` | Validate a model for phantom fields, dangling refs, constraint orphans, AGG-on-STRING, SUM-on-PCT. Add `--deep` to check against actual Snowflake schemas (requires kbagent) |
| `/sl-add` | Add a single entity — metric, dataset, relationship, glossary term, or constraint |
| `/sl-edit` | Edit any field on an existing entity. On metric rename, automatically cascades constraint `metrics[]` references |
| `/sl-remove` | Delete an entity with confirmation and constraint-orphan pre-check |
| `/sl-build` | Greenfield wizard — schema discovery → SQL analysis → generate → validate → push |

The `semantic-layer` skill is a shared reference that auto-loads on mentions of the semantic layer. It provides auth setup, payload shapes, validation rules, and operational gotchas.

## Requirements

- **CRUD commands** (`sl-show`, `sl-add`, `sl-edit`, `sl-remove`, `sl-validate`): only a Keboola Storage API token needed
- **`sl-build`** and **`sl-validate --deep`**: also require [kbagent](https://github.com/keboola/kbagent) for schema discovery and Snowflake column checks

## Auth

Credentials are resolved automatically via 3-step fallback:
1. `KBC_TOKEN` + `KBC_STACK_URL` environment variables
2. kbagent config (`~/Library/Application Support/keboola-agent-cli/config.json`)
3. Prompted interactively

## Key design decisions

**No PATCH endpoint** — the metastore API has no update operation. All edits are DELETE old id + POST new.

**Constraint cascade on rename** — renaming a metric changes its `CODE_METRIC` key downstream. `sl-edit` automatically detects affected constraints and re-POSTs them with the updated metric name to prevent orphan FKs in `DIM_METRIC_THRESHOLD` tables.

**Severity encoding** — the API accepts only `error`/`warning`/`info`, insufficient for 4-band health UIs. Encode real severity in the constraint name suffix (`_critical`, `_warning`, `_healthy`, `_review`); downstream pipelines parse the suffix.

**modelUUID per project** — dev and prod have different UUIDs for the same logical model. When promoting, fetch the target project's model list to find its UUID, then replace `modelUUID` on each item before POSTing.

## Versioning

Current version: **2.0.0**

- v1.0.0 — single monolithic `semantic-layer` build-wizard skill
- v2.0.0 — split into 6 focused commands; added cascade rename; kbagent-free CRUD
