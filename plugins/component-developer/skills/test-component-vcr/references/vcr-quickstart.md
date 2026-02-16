# VCR Testing Quick Reference

All commands below use the `datadirtest` CLI from `https://github.com/keboola/datadirtest` (branch: `feature/vcr-testing`).

**Always check the [datadirtest README](https://github.com/keboola/datadirtest/tree/feature/vcr-testing) for the latest usage.**

## Install

```toml
# pyproject.toml [dependency-groups]
dev = [
    "datadirtest[vcr] @ git+https://github.com/keboola/datadirtest.git@feature/vcr-testing",
]
```

```bash
uv sync
```

## Scaffold (Record) Tests

```bash
# Basic — records HTTP interactions and creates test structure
python -m datadirtest scaffold configs.json tests/functional src/component.py \
    --secrets secrets.json

# OAuth/ERP components — chains refreshed tokens between tests
python -m datadirtest scaffold configs.json tests/functional src/component.py \
    --secrets secrets.json --chain-state

# Structure only (no recording)
python -m datadirtest scaffold configs.json tests/functional --no-record

# Custom freeze time
python -m datadirtest scaffold configs.json tests/functional src/component.py \
    --secrets secrets.json --freeze-time 2025-06-01T12:00:00
```

## Test Runner (only Python file you write)

```python
# tests/test_functional.py
import unittest
from pathlib import Path
from datadirtest.vcr import VCRDataDirTester

class TestComponent(unittest.TestCase):
    def test_functional(self):
        VCRDataDirTester(
            data_dir=str(Path(__file__).parent / "functional"),
            component_script=str(Path(__file__).parent.parent / "src" / "component.py"),
        ).run()
```

## Required .gitignore

```gitignore
secrets.json
configs.json
tests/functional/*/source/data/config.secrets.json
tests/functional/*/source/data/out/
tests/functional/*/source/data/in/
```

## Required Dockerfile Addition

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
```

## secrets.json (gitignored — real credentials)

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

## configs.json (gitignored — dummy credentials)

```json
[
  {"parameters": {"report_type": "Sales"}, "action": "run", "authorization": {...}},
  {"parameters": {"report_type": "Inventory"}, "action": "run", "authorization": {...}}
]
```

Generates test dirs: `01_Sales/`, `02_Inventory/`

## Run Tests

```bash
# Locally
pytest tests/test_functional.py --tb=short -q

# Docker (same as CI)
docker build -t mycomponent:test . && \
docker run mycomponent:test pytest tests/test_functional.py --tb=short -q
```

## Update datadirtest

```bash
uv lock --upgrade-package datadirtest
uv sync
```

## Re-record Tests

```bash
# 1. Update secrets.json with fresh credentials
# 2. Delete test dirs to re-record
rm -rf tests/functional/01_FullLoad
# 3. Re-run scaffold
python -m datadirtest scaffold configs.json tests/functional src/component.py \
    --secrets secrets.json
# 4. Commit updated cassettes and expected output
```
