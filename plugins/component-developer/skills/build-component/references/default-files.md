# Default Files Reference

Canonical defaults for standard Keboola component files. Every file listed here has a correct default. **Deviations from these defaults must be intentional and explained** — do not change values because they seem improvable, outdated, or more familiar. When in doubt, keep the default.

> **Sync note:** These defaults track `cookiecutter-python-component`. If the cookiecutter template changes, update this file accordingly.

---

## `pyproject.toml`

```toml
[project]
name = "your-component-name"
dynamic = ["version"]
readme = "README.md"
requires-python = "~=3.13"
dependencies = [
    "freezegun>=1.5.1",
    "keboola-component>=1.9.0",
    "keboola-http-client>=1.0.1",
    "keboola-utils>=1.1.0",
    "mock>=5.2.0",
    "pydantic>=2.11.7",
]

[dependency-groups]
dev = [
    "keboola.datadirtest>=2.0.0",
    "pytest>=9.0.2",
    "ruff>=0.15.2",
]

[tool.ruff]
line-length = 120
target-version = "py313"

[tool.ruff.lint]
extend-select = ["I"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

### What each default dependency does

| Package | Purpose | Remove when |
|---|---|---|
| `keboola-component` | Core SDK — `CommonInterface`, table definitions, state, manifests | Never |
| `keboola-http-client` | HTTP client with retries and auth helpers | Component has no external HTTP calls |
| `keboola-utils` | Shared utilities (date parsing, logging helpers) | Component genuinely doesn't use any of them |
| `pydantic` | Configuration model validation | You choose a different validation approach |
| `freezegun` | Freeze time in tests | No time-dependent logic |
| `mock` | Mock patching in tests | You use `unittest.mock` directly (they're equivalent) |

### When to add dependencies

Add a dependency only when the component explicitly needs it. Common additions:

- `requests>=2.32.0` — for direct HTTP calls without `keboola-http-client`
- `keboola-csvwriter>=1.0.1` — for high-performance CSV output
- `keboola-vcr>=0.2.0` — add to `[dependency-groups] dev` when using VCR tests
- `aiolimiter>=1.1.0` — async rate limiting
- `anthropic`, `openai`, etc. — third-party API SDKs as needed

### What not to change

- **Python version (`~=3.13`)**: do not downgrade without a concrete compatibility reason (e.g., a dependency that doesn't support 3.13 yet). Do not upgrade until the cookiecutter template does.
- **`ruff` line-length (120)**: Keboola standard. Do not change to 88 or any other value.
- **`extend-select = ["I"]`**: enables isort-compatible import sorting. Add `"UP"` if the codebase uses it, but do not remove `"I"`.
- **`dynamic = ["version"]`**: version is injected by CI/CD. Do not hardcode it.

---

## `Dockerfile`

```dockerfile
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Uncomment if packages require C/C++ compilation (e.g., numpy, psycopg2)
# RUN apt-get update && apt-get install -y build-essential

WORKDIR /code/

COPY pyproject.toml .
COPY uv.lock .

ENV UV_PROJECT_ENVIRONMENT="/usr/local/"
RUN uv sync --all-groups --frozen

COPY src/ src
COPY tests/ tests
COPY scripts/ scripts
COPY deploy.sh .

CMD ["python", "-u", "src/component.py"]
```

### What not to change

- **Base image (`python:3.13-slim`)**: use slim, not alpine. Alpine has libc compatibility issues with many Python packages.
- **`uv sync --all-groups --frozen`**: installs both production and dev dependencies. The `--frozen` flag ensures `uv.lock` is respected exactly — never replace this with `pip install`.
- **`python -u`**: the `-u` flag disables output buffering, which is required so Keboola's log collector captures output in real time.
- **`ENV UV_PROJECT_ENVIRONMENT="/usr/local/"`**: installs packages system-wide inside the container rather than in a venv. Required for the `python` command to find them.

### When to deviate

- **Uncomment `build-essential`** when a dependency requires compilation (e.g., `psycopg2`, `numpy` on some platforms). This is the only commonly needed change.
- **Multi-stage builds** (separate `base`/`test`/`production` stages) are used in some repos for faster CI. This is an advanced pattern — only add if build time is a problem and you understand the tradeoffs.

---

## `docker-compose.yml`

```yaml
version: "2"
services:
  dev:
    build: .
    volumes:
      - ./:/code
      - ./data:/data
    environment:
      - KBC_DATADIR=./data
  test:
    build: .
    volumes:
      - ./:/code
      - ./data:/data
    environment:
      - KBC_DATADIR=./data
    command:
      - /bin/sh
      - /code/scripts/build_n_test.sh
```

### What not to change

This file is purely for local development. Do not add services, environment variables, or volumes beyond what is here unless the component has a specific local dependency (e.g., a local database for integration tests).

`KBC_DATADIR=./data` must always point to the `data/` directory in the repo root — this is how the component finds its input/output files locally.

---

## `scripts/build_n_test.sh`

```sh
#!/bin/sh
set -e

ruff check
python -m pytest tests/ --tb=short -q
```

### What not to change

- `set -e` — exit immediately on any error. Never remove this.
- `ruff check` runs before tests. Linting failures block test execution, which is intentional.

### When to deviate

- Add `ruff format --check` if you want to enforce formatting in CI (currently format is not enforced by default).
- Add test flags (e.g., `-v`, markers) if needed for specific test configurations.

---

## `.github/workflows/push.yml`

The CI/CD pipeline is almost entirely static. **Do not modify the job definitions, steps, or logic.** The only values you configure are in the `env:` block at the top.

### What to configure (env block)

```yaml
env:
  KBC_DEVELOPERPORTAL_APP: "vendor.component-id"   # ← set this: full component ID
  KBC_DEVELOPERPORTAL_VENDOR: "vendor"              # ← set this: your vendor name
  KBC_TEST_PROJECT_CONFIGS: ""                      # ← optionally: space-separated config IDs for KBC integration tests
```

Everything else in the file — job definitions, steps, action versions, artifact handling, deploy logic — is standard and should not be changed.

### How the pipeline works

1. **Runs on**: all pushes except to `main` without a tag; and all tags.
2. **`build`**: builds the Docker image and uploads it as an artifact.
3. **`tests`**: downloads the artifact, runs `ruff check` and `pytest` inside the container.
4. **`tests-kbc`**: runs configs listed in `KBC_TEST_PROJECT_CONFIGS` against a real Keboola project (skipped if empty or no token).
5. **`push`**: pushes the image to ECR.
6. **`deploy`**: sets the tag in Developer Portal — only runs on semantic version tags on the default branch.
7. **`update_developer_portal_properties`**: syncs `component_config/` metadata to Developer Portal.

### When a semantic tag triggers a full deploy

All of these must be true: push is a tag → tag matches `X.Y.Z` → branch is the default branch (`main`).

---

## `component_config/configSchema.json`

The root configuration schema defines parameters shared across all rows (or all parameters if the component has no rows). It uses [JSON Schema](https://json-schema.org/) with Keboola-specific UI extensions.

### Minimal working default

```json
{
  "type": "object",
  "title": "Configuration",
  "required": [],
  "properties": {}
}
```

A component with no configurable parameters (e.g., everything is hardcoded) can ship this as-is.

### Key properties

```json
{
  "type": "object",
  "title": "Configuration",
  "required": ["api_key"],
  "properties": {
    "#api_key": {
      "type": "string",
      "title": "API Key",
      "description": "Your API authentication token.",
      "format": "password",
      "propertyOrder": 1
    },
    "base_url": {
      "type": "string",
      "title": "Base URL",
      "description": "API base URL, e.g. https://api.example.com",
      "propertyOrder": 2
    },
    "debug": {
      "type": "boolean",
      "title": "Debug Mode",
      "default": false,
      "propertyOrder": 99
    }
  }
}
```

### Rules and conventions

- **`propertyOrder`**: controls field ordering in the UI. Use sequential integers (1, 2, 3…). Use a high number (99) for less important fields like `debug`.
- **`#` prefix on property name** (e.g., `"#api_key"`): marks the value as sensitive. Keboola will hash it at rest and never expose it in plaintext. Always use this for passwords, tokens, and API keys. The component reads it via `self.configuration.parameters["#api_key"]` — the `#` is part of the key name.
- **`"format": "password"`**: renders the field as a password input in the UI (masked). Use together with `#` prefix.
- **`"required"` array**: list property names exactly as they appear (including `#` prefix if applicable). Keboola validates these before running the component.
- **`"default"` values**: shown as placeholders in the UI and used by Keboola if the user leaves the field empty.

### Common field formats

| `format` value | Effect |
|---|---|
| `"password"` | Masked input field |
| `"textarea"` | Multi-line text area |
| `"date"` | Date picker |

For dropdowns, code editors (ACE), sync action buttons, and conditional fields, see [`ui-elements.md`](../build-component-ui/references/ui-elements.md) and [`conditional-fields.md`](../build-component-ui/references/conditional-fields.md).

---

## `component_config/configRowSchema.json`

Defines per-row parameters. Used when `hasRows: true` in the Developer Portal component settings.

### Default (no rows)

```json
{}
```

An empty object means the component does not use rows. Do not add a `configRowSchema.json` with content unless the component is actually row-based.

### When to use rows

Use rows when a single component configuration should support running multiple independent jobs — e.g., one row per API object type, one row per report, one row per data source.

### How root + row parameters merge

**The platform merges root config parameters and configRow parameters before the component runs.** The component always receives a single flat `self.configuration.parameters` dict — it never needs to read them separately.

- Root config (`configSchema.json`): shared settings across all rows (credentials, global options)
- Row config (`configRowSchema.json`): per-row variation (endpoint, object type, output table name)

At runtime, row parameters override root parameters on key collision. The component code reads from `self.configuration.parameters` as usual — it cannot tell and does not need to know which params came from which schema.

```python
# This is correct for both row-based and non-row-based components
params = self.configuration.parameters
api_key = params["#api_key"]    # from root config
endpoint = params["endpoint"]   # from row config
# No special handling needed
```

---

## `.pre-commit-config.yaml`

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.9.10
    hooks:
      - id: ruff
      - id: ruff-format
```

### What not to change

- Keep `ruff` and `ruff-format` hooks. These enforce the same linting and formatting as CI.
- Do not add unrelated hooks without a specific reason.

### When to deviate

- Update `rev` when upgrading the `ruff` version in `pyproject.toml` — they should stay in sync.
