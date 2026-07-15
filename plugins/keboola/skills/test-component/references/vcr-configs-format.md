# configs.json Format Reference

Place at `tests/setup/configs.json`. The scaffold CLI reads this by default.

## Wrapped format (recommended)

Explicit test names, works for any parameter structure:

```json
[
  {
    "name": "01_testConnection",
    "description": "Test API connection with valid credentials",
    "config": {
      "action": "testConnection",
      "parameters": {
        "#api_key": "DUMMY_KEY"
      }
    }
  },
  {
    "name": "02_full_sync",
    "config": {
      "action": "run",
      "parameters": {
        "#api_key": "DUMMY_KEY",
        "resource_id": "example_id",
        "sync_mode": "full_sync"
      }
    }
  }
]
```

## OAuth components

```json
[
  {
    "name": "01_run",
    "config": {
      "parameters": {
        "report_type": "FullLoad"
      },
      "authorization": {
        "oauth_api": {
          "credentials": {
            "#data": "{\"access_token\": \"DUMMY\", \"refresh_token\": \"DUMMY\"}",
            "appKey": "real_client_id",
            "#appSecret": "DUMMY_SECRET"
          }
        }
      }
    }
  }
]
```

Real OAuth credentials go in `secrets.json` — the scaffolder deep-merges them at runtime.

## Writer components (with input tables)

Place CSV files in `tests/setup/input_files/`. Reference them via `storage.input`:

```json
[
  {
    "name": "01_write_rows",
    "config": {
      "parameters": {
        "#api_key": "DUMMY_KEY"
      },
      "storage": {
        "input": {
          "tables": [
            {"destination": "my_input_table.csv"}
          ]
        }
      }
    }
  }
]
```

The scaffolder auto-copies `tests/setup/input_files/my_input_table.csv` into each test's `source/data/in/tables/`.

## Raw Keboola format (auto-named)

When entries have `parameters` but no `name`/`config` wrapper, test names are auto-generated from `parameters.reports[0].report_type`. Only use this if your component uses that exact parameter structure:

```json
[
  {"parameters": {"reports": [{"report_type": "Sales"}]}, "authorization": {...}},
  {"parameters": {"reports": [{"report_type": "Inventory"}]}, "authorization": {...}}
]
```

Generates: `01_Sales/`, `02_Inventory/`. For all other structures, use the wrapped format.

## Coverage guidelines

- Every sync action: at least one passing config, one failing/error config
- Every run mode (full/incremental/field selection): cover all valid combinations
- Edge cases: empty results, special characters, null values
- Use dummy credentials in configs.json — real credentials go in `secrets.json`
- Prefix names with numbers: `01_`, `02_`, etc.
- Resource IDs (base IDs, table IDs) are not secrets — use real ones, ask the user if unsure
