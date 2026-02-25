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

## Scaffold (Record) Tests

```bash
# Public API (no auth) — no --secrets needed
uv run python -m keboola.datadirtest scaffold configs.json tests/functional src/component.py

# Authenticated API — merges real credentials from secrets.json
uv run python -m keboola.datadirtest scaffold configs.json tests/functional src/component.py \
    --secrets secrets.json

# OAuth/ERP components — chains refreshed tokens between tests
uv run python -m keboola.datadirtest scaffold configs.json tests/functional src/component.py \
    --secrets secrets.json --chain-state

# Structure only (no recording)
uv run python -m keboola.datadirtest scaffold configs.json tests/functional --no-record

# Custom freeze time
uv run python -m keboola.datadirtest scaffold configs.json tests/functional src/component.py \
    --freeze-time 2025-06-01T12:00:00
```

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

### Wrapped format (explicit test names — recommended for most components)

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
configs.json
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
# 1. Delete test dirs to re-record
rm -rf tests/functional/test_generation
# 2. Re-run scaffold (with --secrets if authenticated)
uv run python -m keboola.datadirtest scaffold configs.json tests/functional src/component.py
# 3. Commit updated cassettes and expected output
```
