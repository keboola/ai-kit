# sl-builder Plugin

Semantic layer tools for Keboola — inspect, validate, and build models via the metastore API. Works with or without the Semantic Layer data app.

## Installation

```bash
/plugin install sl-builder
```

## Commands

| Command | Description |
|---|---|
| `/sl-show` | List all datasets, metrics, relationships, constraints, and glossary terms in a model |
| `/sl-validate` | Validate a model for phantom fields, dangling refs, constraint orphans, AGG-on-STRING, SUM-on-PCT. Add `--deep` to check against actual Snowflake schemas (requires kbagent) |
| `/sl-build` | Greenfield wizard — schema discovery → SQL analysis → generate → validate → push |

## Add / Edit / Remove

CRUD operations don't need a slash command — just work conversationally:

> *"Add a metric for Net Profit Margin on the KPI dashboard table"*
> *"Rename the Revenue metric to Total Revenue"*
> *"Remove the test_metric constraint"*

The `semantic-layer` skill auto-loads and provides the full API procedures, payload shapes, rollback logic, and cascade-rename handling.

## Requirements

- **`/sl-show`, `/sl-validate` (basic), CRUD**: only a Keboola Storage API token needed
- **`/sl-build`** and **`/sl-validate --deep`**: also require [kbagent](https://github.com/keboola/kbagent)

## Auth

Credentials resolved automatically via 3-step fallback:
1. `KBC_TOKEN` + `KBC_STACK_URL` / `KBC_URL` environment variables
2. kbagent config (`~/Library/Application Support/keboola-agent-cli/config.json`)
3. Prompted interactively

Supports GCP, AWS, and Azure stacks — metastore region derived automatically from the connection URL.

## Key design decisions

**No PATCH endpoint** — all edits are DELETE old id + POST new, with rollback on POST failure.

**Constraint cascade on rename** — renaming a metric auto-updates constraint `metrics[]` references to prevent orphan FKs in `DIM_METRIC_THRESHOLD` tables.

**Severity encoding** — the API accepts only `error`/`warning`/`info`. Encode real 4-band severity in the constraint name suffix (`_critical`, `_warning`, `_healthy`, `_review`).

**modelUUID per project** — dev and prod have different UUIDs. When promoting, fetch the target project's model list to find its UUID, then replace `modelUUID` on each item.

## Versioning

Current version: **2.0.0**

- v1.0.0 — single monolithic `semantic-layer` build-wizard skill
- v2.0.0 — 3 focused commands + CRUD in reference skill; multi-cloud auth; constraint push fix; cascade rename with rollback
