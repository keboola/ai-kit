---
description: Generate VCR functional tests for a Keboola component — records real HTTP interactions and replays them in CI
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion
argument-hint: [--secrets path/to/secrets.json] [--chain-state]
---

# Generate VCR Functional Tests

Set up VCR-based functional tests for the current Keboola Python component using the `keboola.datadirtest` framework. Records real HTTP interactions once, replays them deterministically in CI — no credentials needed, no flaky mocks.

## What This Command Does

1. **Checks/installs** — Adds the dependency and syncs
2. **Creates tests/setup/configs.json** — Covers all endpoints (sync actions + run modes)
3. **Creates secrets.json** — Asks user for real credentials (gitignored)
4. **Creates test runner** — Writes `tests/test_functional.py` (parametrized)
5. **Runs scaffold** — Records cassettes and generates expected outputs
6. **Updates project files** — `.gitignore`, `Dockerfile`, CI pipeline
7. **Verifies tests** — Runs `pytest` to confirm all tests pass

## Instructions

### Step 1: Validate Environment

Confirm we're in a Keboola component directory and detect the dependency system:

```bash
# Must be a component directory
test -f src/component.py || {
  echo "Error: src/component.py not found — run this from a component root"
  exit 1
}

# Detect dependency system
if [ -f pyproject.toml ]; then
  echo "Detected: pyproject.toml (uv)"
  DEP_SYSTEM="uv"
elif [ -f requirements.txt ]; then
  echo "Detected: requirements.txt (pip)"
  DEP_SYSTEM="pip"
else
  echo "Error: No pyproject.toml or requirements.txt found"
  exit 1
fi
```

Validate we have .venv installed either via `uv venv` or via `python venv -m .venv`. Always use a version specified in `pyproject.toml` if available.

### Step 2: Add keboola.datadirtest Dependency

Check if `keboola.datadirtest` is already installed. If not, add it. Ideally via uv add keboola.datadirtest

**For pyproject.toml + uv:**

Read `pyproject.toml` and check if `keboola.datadirtest` is already in `[dependency-groups] dev`. If not, add it:

```toml
[dependency-groups]
dev = [
    "keboola.datadirtest>=2.0.0",
    "keboola.component>=1.9.0",
    "pytest>=9.0.0",
    # ... keep existing dev deps
]
```

Then sync:
```bash
uv lock --upgrade && uv sync
```

**For requirements.txt + pip:**

Add to `requirements.txt` (or `requirements-dev.txt` if it exists):
```
keboola.datadirtest>=2.0.0
keboola.component>=1.9.0
pytest>=9.0.0
```

Then install:
```bash
pip install -r requirements.txt
```

**Verify installation:**
```bash
python -c "from keboola.datadirtest import VCRDataDirTester; print('keboola.datadirtest OK')"
```

**IMPORTANT:** The `keboola.component>=1.9.0` installs `vcrpy` and `keboola.vcr` automatically — do NOT add them separately. If there is a standalone `vcrpy` or `freezegun` or `keboola.vcr` entry, remove it.

### Step 3: Analyze Component and Build configs.json

Read the component source to understand all supported actions and parameters:

1. **Read `src/component.py`** — Find all actions (`run`, sync actions like `testConnection`, `list_bases`, `list_tables`, etc.)
2. **Read `src/configuration.py`** — Understand required parameters, field names, types
3. **Read `component_config/configSchema.json`** — Understand the full config structure and valid parameter combinations
4. **Check for existing test configs** — Read `data/config.json` or any existing test configurations

Create `tests/setup/configs.json` (the default location for the scaffold CLI) using the **wrapped format** (explicit test names):

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
    "description": "Full sync extraction with all fields",
    "config": {
      "action": "run",
      "parameters": {
        "#api_key": "DUMMY_KEY",
        "resource_id": "example_id",
        "sync_options": {
          "sync_mode": "full_sync"
        },
        "destination": {
          "table_name": "output_table",
          "incremental_loading": false
        }
      }
    }
  }
]
```

**Guidelines for configs.json:**
- Use **dummy credentials** (e.g., `"DUMMY_KEY"`) — real ones go in `secrets.json`
- Cover **every sync action** (testConnection, list_*, etc.) — two test per action, one working config, one not working
- Cover **every run mode** (full sync, incremental sync, field selection, etc.) - Make a matrix from them and implement all valid cases.
- Test **edge cases** (empty table name for auto-resolution, complex field types, etc.)
- Use the `{name, description, config}` wrapped format — never the raw format
- Prefix names with numbers for ordering: `01_`, `02_`, etc.
- The `description` field is optional but helpful for documentation
- Use real resource IDs (base IDs, table IDs, etc.) — these are not secrets

**For writer components** that need input tables or files, add `storage.input` mappings and place the CSV files in `tests/setup/input_files/`. The scaffold CLI auto-copies them into each test's `in/tables/` or `in/files/` based on these mappings:

```json
{
  "name": "01_write_data",
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
```

**IMPORTANT:** Use correct resource IDs from the actual API. If unsure, ask the user what IDs to use. Wrong IDs will cause scaffold to fail with API errors.

### Step 4: Create secrets.json

Ask the user for their real credentials. The structure must mirror the config paths that need to be overridden.

**For API key components:**
```json
{
  "parameters": {
    "#api_key": "real_api_key_here"
  }
}
```

**For OAuth components:**
```json
{
  "authorization": {
    "oauth_api": {
      "credentials": {
        "#data": "{\"access_token\": \"real_token\", \"refresh_token\": \"real_refresh\"}",
        "appKey": "real_client_id",
        "#appSecret": "real_client_secret"
      }
    }
  }
}
```

**For public APIs (no auth):** Skip this step entirely — put real values directly in `configs.json` and run scaffold without `--secrets`.

**CRITICAL:** `secrets.json` must be gitignored. Verify `.gitignore` includes it before proceeding.

### Step 5: Create Test Runner

Create `tests/test_functional.py` — this is the ONLY test Python file needed:

```python
"""Functional tests for component using VCR cassettes."""

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

**IMPORTANT:**
- Uses `pytest.mark.parametrize` so each test case shows individually in output
- Uses `VCRDataDirTester` (the high-level wrapper), NOT `VCRTestDataDir` (low-level)
- The `get_test_cases()` helper auto-discovers all test directories with cassettes
- Do NOT use `unittest.TestCase` — pytest parametrize is the correct pattern

### Step 6: Run Scaffold to Record Tests

This is the critical step — runs the component with real credentials against the live API and records all HTTP interactions.

The scaffold CLI reads from `tests/setup/configs.json` by default (all paths have sensible defaults):

```bash
# Authenticated API — uses defaults: tests/setup/configs.json, tests/functional, src/component.py
uv run python -m keboola.datadirtest scaffold --secrets secrets.json

# Public API (no auth)
uv run python -m keboola.datadirtest scaffold

# OAuth/ERP components (chains refreshed tokens between tests)
uv run python -m keboola.datadirtest scaffold --secrets secrets.json --chain-state

# Writer components with input files (auto-copies CSVs from tests/setup/input_files/)
uv run python -m keboola.datadirtest scaffold --secrets secrets.json

# Custom paths (if not using the standard layout)
uv run python -m keboola.datadirtest scaffold \
    --definitions tests/setup/configs.json \
    --output tests/functional \
    --component src/component.py \
    --secrets secrets.json
```

The scaffolder automatically:
- Creates directory structure for each config
- Deep-merges real credentials from `secrets.json` into each config
- Runs the component against the live API
- Records all HTTP interactions to `cassettes/requests.json`
- Copies outputs to `expected/`
- Restores `config.json` to dummy values
- Sanitizes credentials from cassettes
- Freezes time to moment the component run
- Copies input CSV files from `tests/setup/input_files/` into each test's `in/tables/` or `in/files/` (for writers)
- **Skips tests that already have a cassette** — re-run safely after fixing one test

**If scaffold fails:**
- Check error message — usually wrong resource IDs, expired credentials, or API errors
- Fix the offending config in `tests/setup/configs.json` and re-run
- Scaffold processes tests sequentially and stops on first fatal error
- Existing successful tests are skipped automatically (cassette already present)
- To force re-record a test, delete its directory or use `--regenerate`

### Step 7: Update .gitignore

Add VCR-specific entries if not already present:

```gitignore
# VCR secrets - never commit real credentials
secrets.json
tests/functional/*/source/data/config.secrets.json

# Test runtime dirs (regenerated during replay)
tests/functional/*/source/data/out/
tests/functional/*/source/data/in/
```

**Note:** `tests/setup/configs.json` can optionally be gitignored too (it contains dummy creds, but most teams commit it for reference).

### Step 8: Update Dockerfile

Ensure the Dockerfile copies `tests/` into the image. Add this line if missing:

Also ensure the Dockerfile copies `tests/` into the image:
```dockerfile
COPY tests/ tests
```

### Step 9: Update CI Pipeline

Find the test command in `.github/workflows/push.yml` and replace `python -m unittest discover` with `python -m pytest`:

**Before:**
```yaml
docker run ${{ env.APP_IMAGE }}:latest python -m unittest discover
```

**After:**
```yaml
docker run ${{ env.APP_IMAGE }}:latest python -m pytest tests/ --tb=short -q
```

**Why:** `python -m unittest discover` only finds `unittest.TestCase` subclasses. Our parametrized pytest tests won't be discovered by unittest.

Also update any local test scripts (e.g., `scripts/build_n_test.sh`):

**Before:**
```bash
python -m unittest discover
```

**After:**
```bash
python -m pytest tests/ --tb=short -q
```

### Step 10: Verify Tests Pass

Run the tests locally to confirm everything works:

```bash
# Run with pytest
python -m pytest tests/test_functional.py --tb=short -q
```

All tests should pass. If any fail, investigate:

```bash
# Run a single failing test with verbose output
python -m pytest tests/test_functional.py -k "test_name" -v --tb=long
```

Optionally verify in Docker (matches CI exactly):
```bash
docker build -t mycomponent:test .
docker run mycomponent:test python -m pytest tests/ --tb=short -q
```

## Known Pitfalls and Solutions

### Non-deterministic column ordering
If the component uses `set()` for column names anywhere (e.g., building manifest schemas), manifests will differ between scaffold and replay due to random set ordering. **Fix:** Change `set()` to `list()` to preserve insertion order, then re-scaffold.

### Wrong resource IDs in configs.json
Using IDs from the wrong resource (e.g., wrong table ID) causes API errors during scaffold. **Fix:** Double-check all resource IDs against the actual API. Ask the user if unsure.

### configs.json format
The scaffolder expects the wrapped format: `{"name": "...", "config": {...}}`. Missing the `config` wrapper causes `ScaffolderError: Test 'X' missing required 'config' field`. The default file location is `tests/setup/configs.json` — no path argument needed if you use the standard layout.

### CI shows "Ran 0 tests"
The CI pipeline uses `python -m unittest discover` which can't find pytest-parametrized functions. **Fix:** Change to `python -m pytest tests/ --tb=short -q` (Step 9).

### uv.lock out of date
After adding keboola.datadirtest, run `uv lock` before `uv sync`. If keboola.datadirtest was updated upstream, run `uv lock --upgrade-package keboola-datadirtest`.

### Permission denied writing secrets.json
Some security configurations block writing files matching `**/secrets*`. **Fix:** Ask the user to create `secrets.json` manually.

### Scaffold stops on first error
The scaffold command processes tests sequentially and stops on the first fatal error. **Fix:** Put likely-to-fail tests last, or fix and re-run incrementally.

## Re-recording Tests

When the API changes or you need fresh data:

```bash
# 1. Get fresh credentials in secrets.json

# 2a. Re-record all tests (delete cassettes and re-record from live API)
uv run python -m keboola.datadirtest scaffold --secrets secrets.json --regenerate

# 2b. Or delete specific test directories and re-run (existing tests are skipped by default)
rm -rf tests/functional/01_testConnection
uv run python -m keboola.datadirtest scaffold --secrets secrets.json

# 3. Verify tests pass
python -m pytest tests/test_functional.py --tb=short -q

# 4. Commit updated cassettes and expected output
```

## Example Session

```
User: /generate-vcr-tests
Assistant: Setting up VCR functional tests...

Step 1: Validating environment...
  Detected: pyproject.toml (uv)
  src/component.py exists

Step 2: Adding keboola.datadirtest dependency...
  Added to pyproject.toml [dependency-groups] dev
  Running uv lock && uv sync...
  keboola.datadirtest OK

Step 3: Analyzing component for configs.json...
  Found actions: testConnection, list_bases, list_tables, list_fields, list_views, run
  Found run modes: full_sync, incremental_sync
  Created tests/setup/configs.json with 10 test cases

Step 4: Creating secrets.json...
  What is your API key? (will be stored in gitignored secrets.json)
  > [user provides key]
  Created secrets.json

Step 5: Creating test runner...
  Created tests/test_functional.py

Step 6: Running scaffold (recording HTTP interactions)...
  uv run python -m keboola.datadirtest scaffold --secrets secrets.json
  Recording 01_testConnection... OK
  Recording 02_list_bases... OK
  ...
  Recording 10_special_chars... OK
  All 10 tests recorded

Step 7-9: Updating project files...
  Updated .gitignore
  Updated Dockerfile (added git)
  Updated push.yml (unittest discover -> pytest)
  Updated scripts/build_n_test.sh

Step 10: Verifying...
  10 passed in 0.51s

VCR tests are ready! All 10 test cases pass.
```

## Reference

- `@test-component-vcr` — Full VCR setup skill with detailed documentation
- `@test-component` — General testing patterns (unit tests, datadir tests)
- [keboola.datadirtest](https://github.com/keboola/datadirtest) — Source of truth
- [VCR Quick Reference](../skills/test-component-vcr/references/vcr-quickstart.md) — Cheat sheet
