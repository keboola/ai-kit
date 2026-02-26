# VCR Testing Quick Reference

All commands below use the `keboola.datadirtest` CLI from `https://github.com/keboola/datadirtest`.

**Always check the [keboola.datadirtest README](https://github.com/keboola/datadirtest) for the latest usage.**

## Install

### pyproject.toml + uv (modern projects)

```toml
# pyproject.toml [dependency-groups]
dev = [
    "keboola.datadirtest>=2.0.0",
    "keboola.component>=1.9.0",
]
```

```bash
uv lock --upgrade && uv sync
```

### requirements.txt + pip (legacy projects)

```
# requirements.txt
keboola.datadirtest>=2.0.0
keboola.component>=1.9.0
```

```bash
pip install -r requirements.txt
```

**Verify:**
```bash
python -c "from keboola.datadirtest.vcr import VCRDataDirTester; print('OK')"
```

## Standard Repo Layout

The scaffold CLI has sensible defaults that match the standard layout:

```
tests/
├── setup/
│   ├── configs.json          # Test definitions (default --definitions)
│   └── input_files/          # CSVs for writer tests (default --input-files)
│       └── my_table.csv
├── functional/               # Generated test dirs (default --output)
│   └── 01_testConnection/
│       ├── source/data/
│       │   ├── config.json
│       │   ├── cassettes/requests.json
│       │   └── in/tables/
│       └── expected/data/out/
└── test_functional.py        # Test runner (only file you write)
```

## Scaffold (Record) Tests

```bash
# All defaults — standard repo layout (reads tests/setup/configs.json)
uv run python -m keboola.datadirtest scaffold

# Authenticated API
uv run python -m keboola.datadirtest scaffold --secrets secrets.json

# OAuth/ERP components — chains refreshed tokens between tests
uv run python -m keboola.datadirtest scaffold --secrets secrets.json --chain-state

# Writer components — auto-copies CSVs from tests/setup/input_files/ based on storage mappings
uv run python -m keboola.datadirtest scaffold --secrets secrets.json

# Re-record all cassettes from scratch
uv run python -m keboola.datadirtest scaffold --secrets secrets.json --regenerate

# Structure only (no recording)
uv run python -m keboola.datadirtest scaffold --no-record

# Custom paths (if not using standard layout)
uv run python -m keboola.datadirtest scaffold \
    --definitions tests/setup/configs.json \
    --output tests/functional \
    --component src/component.py \
    --secrets secrets.json

# Custom freeze time
uv run python -m keboola.datadirtest scaffold --secrets secrets.json \
    --freeze-time 2025-06-01T12:00:00
```

**Skip-if-exists is the default**: tests that already have a cassette are skipped. Use `--regenerate` to force re-recording of all tests.

## Test Runner (only Python file you write)

```python
# tests/test_functional.py
from pathlib import Path
import pytest
from keboola.datadirtest.vcr import VCRDataDirTester, get_test_cases

FUNCTIONAL_DIR = str(Path(__file__).parent / "functional")
COMPONENT_SCRIPT = str(Path(__file__).parent.parent / "src" / "component.py")

@pytest.mark.parametrize("test_name", get_test_cases(FUNCTIONAL_DIR))
def test_functional(test_name):
    """Run a single VCR functional test case."""
    tester = VCRDataDirTester(
        data_dir=FUNCTIONAL_DIR,
        component_script=COMPONENT_SCRIPT,
        selected_tests=[test_name],
    )
    tester.run()
```

## configs.json Formats

### Wrapped format (recommended for most components)

Place at `tests/setup/configs.json`:

```json
[
  {
    "name": "test_generation_all_granularities",
    "config": {
      "parameters": {
        "date_from": "2024-01-01",
        "date_to": "2024-01-02",
        "endpoints": [
          {"endpoint_name": "Generation", "granularity": "HR"},
          {"endpoint_name": "Generation", "granularity": "DY"}
        ]
      }
    }
  },
  {
    "name": "test_missing_params",
    "config": {
      "parameters": {}
    }
  }
]
```

### Writer components (with input tables/files)

Place CSV files in `tests/setup/input_files/`. Reference them via `storage.input` in each config entry:

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

The scaffolder auto-copies `tests/setup/input_files/my_input_table.csv` → each test's `source/data/in/tables/my_input_table.csv`.

### Raw Keboola format (auto-named from `reports[0].report_type`)

```json
[
  {"parameters": {"reports": [{"report_type": "Sales"}]}, "authorization": {...}},
  {"parameters": {"reports": [{"report_type": "Inventory"}]}, "authorization": {...}}
]
```

Generates: `01_Sales/`, `02_Inventory/`

> **Limitation:** Auto-naming only works with `parameters.reports[0].report_type`. For other parameter structures, use the wrapped format.

## Required .gitignore

```gitignore
secrets.json
tests/functional/*/source/data/config.secrets.json
tests/functional/*/source/data/out/
tests/functional/*/source/data/in/
```

## secrets.json (gitignored — only for authenticated APIs)

OAuth component:
```json
{
  "authorization": {
    "oauth_api": {
      "credentials": {
        "#data": "{\"access_token\": \"real\", \"refresh_token\": \"real\"}",
        "appKey": "real_client_id",
        "#appSecret": "real_client_secret"
      }
    }
  }
}
```

API key component:
```json
{
  "parameters": {
    "#api_key": "real_api_key_here"
  }
}
```

Public API (no auth): **No secrets.json needed** — put real values directly in configs.json.

## Run Tests

```bash
# Locally
pytest tests/test_functional.py --tb=short -q

# Docker (same as CI)
docker build -t mycomponent:test . && \
docker run mycomponent:test pytest tests/test_functional.py --tb=short -q
```

## Update keboola.datadirtest

```bash
# pyproject.toml + uv
uv lock --upgrade-package keboola-datadirtest
uv sync

# requirements.txt + pip
pip install --upgrade "keboola.datadirtest"
```

## Re-record Tests

```bash
# Re-record all (delete all cassettes and re-record from live API)
uv run python -m keboola.datadirtest scaffold --secrets secrets.json --regenerate

# Re-record specific test (delete dir, then re-run — existing tests skipped)
rm -rf tests/functional/test_generation
uv run python -m keboola.datadirtest scaffold --secrets secrets.json

# Commit updated cassettes and expected output
```
