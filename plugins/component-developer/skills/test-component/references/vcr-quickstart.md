# VCR Testing Quick Reference

All commands below use the `keboola.datadirtest` CLI from `https://github.com/keboola/datadirtest`.

**Always check the [keboola.datadirtest README](https://github.com/keboola/datadirtest) for the latest usage.**

## Install

```toml
# pyproject.toml [dependency-groups]
dev = [
    "keboola.datadirtest>=2.0.0",
    "keboola.component>=1.9.0",
]
```

```bash
uv sync -U
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

## Test Runner

Copy `tests/test_functional.py` from `component-developer:component-defaults` assets.

## configs.json Formats

See [vcr-configs-format.md](vcr-configs-format.md) for full reference.

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
pytest

# Docker (same as CI)
docker build -t mycomponent:test . && \
docker run --rm mycomponent:test pytest
```

## Update keboola.datadirtest

```bash
uv lock --upgrade-package keboola-datadirtest
uv sync
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
