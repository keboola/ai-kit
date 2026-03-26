---
name: vcr-tester
description: Sets up VCR-based functional tests for Keboola Python components using the keboola.datadirtest library. The datadirtest CLI handles recording, replay, scaffolding, sanitization, and time freezing — your job is to install it, configure it, and run its commands. Use this skill whenever setting up functional tests, adding VCR tests, running /generate-vcr-tests, or creating regression tests from platform debug job output.
metadata:
  tools: "Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion"
  model: sonnet
  color: cyan
---

# Keboola VCR Test Setup

Sets up VCR-based functional tests using **keboola.datadirtest**. Records real HTTP interactions once, replays deterministically in CI — no credentials needed, no flaky mocks.

## Step 1: Add Dependency

```toml
[dependency-groups]
dev = [
    "keboola.datadirtest>=2.0.0",
    "keboola.component>=1.9.0",
    "pytest>=9.0.0",
]
```
```bash
uv sync -U
```

**Verify:** `python -c "from keboola.datadirtest.vcr import VCRDataDirTester; print('OK')"`

`keboola.component>=1.9.0` pulls in `vcrpy` and `keboola.vcr` automatically — remove any standalone entries for those.

## Step 2: Create Test Runner

Copy `tests/test_functional.py` from the `component-developer:component-defaults` skill assets. That's the canonical template — no modifications needed.

## Step 3: Analyze Component and Build configs.json

Before asking the user anything, read the component to understand what to test:

1. **`src/component.py`** — find all actions: `run`, and any sync actions (`@sync_action("testConnection")`, `@sync_action("list_tables")`, etc.)
2. **`src/configuration.py`** — understand required fields, types, optional fields, enums
3. **`component_config/configSchema.json`** — find all valid parameter combinations, enum values, required/optional fields
4. **`data/config.json`** — check for example parameters to base tests on

Create `tests/setup/configs.json` — see [configs-format.md](references/configs-format.md) for all formats (wrapped, OAuth, writer components) and coverage guidelines.

## Step 4: Create secrets.json (authenticated APIs only)

Ask the user for real credentials. Structure must mirror the config paths to override.

**API key:**
```json
{"parameters": {"#api_key": "real_key"}}
```

**OAuth:**
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

**Public APIs:** skip this step entirely — put real values directly in `configs.json`.

**CRITICAL:** verify `secrets.json` is in `.gitignore` before proceeding.

## Step 5: Run Scaffold to Record

```bash
# Authenticated API
uv run python -m keboola.datadirtest scaffold --secrets secrets.json

# Public API (no auth)
uv run python -m keboola.datadirtest scaffold

# OAuth/ERP components — chains refreshed tokens between tests
uv run python -m keboola.datadirtest scaffold --secrets secrets.json --chain-state

# Force re-record all existing cassettes
uv run python -m keboola.datadirtest scaffold --secrets secrets.json --regenerate
```

The scaffolder: creates directory structure, runs the component against the live API, records HTTP interactions to `cassettes/requests.json`, copies outputs to `expected/`, restores dummy credentials, sanitizes cassettes, freezes time. **Skips tests that already have a cassette** — safe to re-run after fixing one test.

If scaffold fails: check the error (usually wrong resource IDs or expired credentials), fix the config, and re-run. Existing tests are skipped automatically.

## Step 5b: Check for Custom Sanitizers

After recording, scan cassettes for unsanitized dynamic values before committing:

```bash
grep -r "Expires\|Signature\|GoogleAccessId\|X-Amz\|_nc_gid\|page_token" \
  tests/functional/*/source/data/cassettes/requests.json
```

If you find hits, add `VCR_SANITIZERS` to `component.py` and re-scaffold with `--regenerate`. See [sanitizers.md](references/sanitizers.md) for which sanitizer to use and how to place it.

## Step 6: Update .gitignore

```gitignore
secrets.json
tests/functional/*/source/data/config.secrets.json
tests/functional/*/source/data/out/
tests/functional/*/source/data/in/
```

## Step 7: Update Dockerfile

Add if missing:
```dockerfile
COPY tests/ tests
```

## Step 8: Update CI Pipeline

In `.github/workflows/push.yml`, replace `python -m unittest discover` with `python -m pytest`:

```yaml
docker run --rm ${{ env.APP_IMAGE }}:latest python -m pytest
```

Also update `scripts/build_n_test.sh` if it exists. `unittest discover` won't find parametrized pytest tests.

## Step 9: Verify

```bash
python -m pytest

# Single failing test with verbose output
python -m pytest tests/test_functional.py -k "test_name" -v --tb=long

# Docker (matches CI exactly)
docker build -t mycomponent:test . && docker run --rm mycomponent:test python -m pytest
```

---

## Reference

- [configs-format.md](references/configs-format.md) — configs.json formats, OAuth, writer components, coverage guidelines
- [sanitizers.md](references/sanitizers.md) — VCR_SANITIZERS: DefaultSanitizer, ResponseUrlSanitizer, QueryParamSanitizer
- [vcr-quickstart.md](references/vcr-quickstart.md) — scaffold commands cheat sheet
- [troubleshooting.md](references/troubleshooting.md) — common failures and fixes
- [debug-from-platform.md](references/debug-from-platform.md) — creating tests from Keboola platform debug job output (stage_output.zip)
- [keboola.datadirtest repo](https://github.com/keboola/datadirtest) — source of truth
