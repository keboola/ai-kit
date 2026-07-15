---
name: Keboola Configuration
description: Use this skill when working with Keboola project configurations, understanding JSON config files, editing transformations, or analyzing Keboola project structure. Triggers on questions about Keboola configs, transformations, orchestrations, extractors, writers, or .keboola directories.
version: 1.0.0
---

# Keboola Configuration Knowledge

Provide expertise on Keboola project structure, configuration formats, and best practices for managing data pipelines.

## Project Structure

A Keboola project pulled locally has this structure:

```
project-root/
├── .keboola/
│   └── manifest.json       # Project metadata and branch info
├── .env.local              # API token (never commit)
├── .env.dist               # Template for .env.local
├── .gitignore
└── [branch-name]/          # One directory per branch
    └── [component-id]/     # e.g., keboola.snowflake-transformation
        └── [config-name]/  # Configuration directory
            ├── config.json # Main configuration
            ├── meta.json   # Metadata (name, description)
            └── rows/       # Configuration rows (if applicable)
```

## Configuration Files

### manifest.json

Located in `.keboola/manifest.json`, contains:
- Project ID and API host
- Branch information
- Sorting and naming conventions

### config.json

The main configuration file for each component. Structure varies by component type but typically includes:
- `parameters` - Component-specific settings
- `storage` - Input/output table mappings
- `processors` - Pre/post processing steps

### meta.json

Metadata about the configuration:
```json
{
  "name": "Configuration Name",
  "description": "What this configuration does",
  "isDisabled": false
}
```

## Component Types

### Transformations

SQL or Python/R transformations for data processing.

**Snowflake Transformation** (`keboola.snowflake-transformation`):
```json
{
  "parameters": {
    "blocks": [
      {
        "name": "Block Name",
        "codes": [
          {
            "name": "Script Name",
            "script": ["SELECT * FROM table"]
          }
        ]
      }
    ]
  },
  "storage": {
    "input": {
      "tables": [
        {
          "source": "in.c-bucket.table",
          "destination": "table"
        }
      ]
    },
    "output": {
      "tables": [
        {
          "source": "output_table",
          "destination": "out.c-bucket.result"
        }
      ]
    }
  }
}
```

### Extractors

Components that pull data from external sources (databases, APIs, files).

Common extractors:
- `keboola.ex-db-snowflake` - Snowflake extractor
- `keboola.ex-google-analytics-v4` - Google Analytics
- `keboola.ex-generic-v2` - Generic HTTP API extractor

### Writers

Components that push data to external destinations.

Common writers:
- `keboola.wr-db-snowflake` - Snowflake writer
- `keboola.wr-google-sheets` - Google Sheets writer

### Orchestrations

Workflow definitions that run multiple configurations in sequence.

Located in `keboola.orchestrator/` with:
- Task definitions
- Dependencies
- Scheduling

## Best Practices

### When Editing Configurations

1. Always run `kbc diff` before and after changes
2. Validate JSON syntax before pushing
3. Use `kbc validate` to check configuration validity
4. Keep descriptions updated in meta.json

### Storage Mappings

- Input tables: Map source tables to working names
- Output tables: Map result tables to destination buckets
- Use consistent naming conventions

### Transformations

- Break complex logic into multiple blocks
- Use meaningful names for blocks and scripts
- Document SQL with comments
- Test locally when possible

## Common Tasks

### Add a New Input Table to Transformation

In `config.json`, add to `storage.input.tables`:
```json
{
  "source": "in.c-bucket.new_table",
  "destination": "new_table",
  "columns": []  // Empty = all columns
}
```

### Add Output Table

In `config.json`, add to `storage.output.tables`:
```json
{
  "source": "result_table",
  "destination": "out.c-bucket.result",
  "primary_key": ["id"]
}
```

### Modify SQL Script

Edit the `script` array in the relevant block/code section. Each array element is a SQL statement.

## Troubleshooting

### Invalid Configuration

- Check JSON syntax (missing commas, brackets)
- Verify table names exist in storage
- Check column names in mappings

### Push Conflicts

- Pull latest changes first
- Merge conflicts manually in config files
- Push again after resolution

### Missing Tables

- Ensure input tables exist in Keboola Storage
- Check bucket permissions
- Verify table names match exactly (case-sensitive)
