# VCR Testing Quick Reference

## Scaffold Command

```bash
# Basic (single config or simple components)
python -m datadirtest scaffold configs.json tests/functional src/component.py \
    --secrets secrets.json

# OAuth/ERP components (token chaining between tests)
python -m datadirtest scaffold configs.json tests/functional src/component.py \
    --secrets secrets.json --chain-state

# Without recording (structure only)
python -m datadirtest scaffold configs.json tests/functional --no-record

# Custom freeze time
python -m datadirtest scaffold configs.json tests/functional src/component.py \
    --secrets secrets.json --freeze-time 2025-06-01T12:00:00
```

## Minimal Test Runner

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

## Required .gitignore entries

```gitignore
secrets.json
configs.json
tests/functional/*/source/data/config.secrets.json
tests/functional/*/source/data/out/
tests/functional/*/source/data/in/
```

## Required Dockerfile addition

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
```

## Required pyproject.toml dependency

```toml
[dependency-groups]
dev = [
    "datadirtest[vcr] @ git+https://github.com/keboola/datadirtest.git@feature/vcr-testing",
]
```

## secrets.json Structure

The structure must mirror the config paths you want to override:

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

For non-OAuth components with API keys:
```json
{
  "parameters": {
    "#api_key": "real_api_key_here"
  }
}
```

## configs.json Format

Array of raw Keboola configs. Test names are auto-generated from `parameters.reports[0].report_type` or numbered:

```json
[
  {"parameters": {"report_type": "Sales"}, "action": "run", "authorization": {...}},
  {"parameters": {"report_type": "Inventory"}, "action": "run", "authorization": {...}}
]
```

Generates: `01_Sales/`, `02_Inventory/`

## Docker Test Command

```bash
# Build and test (same as CI)
docker build -t mycomponent:test . && \
docker run mycomponent:test pytest tests/test_functional.py --tb=short -q
```

## Updating datadirtest

```bash
# After changes to datadirtest are pushed
uv lock --upgrade-package datadirtest
uv sync
```

## Chain State Flow (OAuth components)

```
Test 1: {} → component runs → out/state.json = {refreshed_token}
Test 2: {refreshed_token} → component runs → out/state.json = {refreshed_token_2}
Test 3: {refreshed_token_2} → component runs → ...
```

Each test's `out/state.json` becomes the next test's `in/state.json` during scaffolding.
During replay, cassettes serve pre-recorded responses — the state content doesn't matter.
