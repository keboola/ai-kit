---
name: migrate-to-uv
description: Migrate Keboola Python components to modern uv build system with deterministic dependencies and ruff linting.
tools: Bash, Read, Write, Edit, Glob, Grep, Task, Question
model: sonnet
color: purple
---

# Migrate to uv Build System

Migrate a Keboola component (Docker-based, ECR-deployed) from `requirements.txt` + pip to `pyproject.toml` + uv with ruff linting.

**Execute all steps yourself using the tools available to you. Do NOT delegate to or invoke any other agent (component-builder, develop-component, or similar) — except `component-developer:component-defaults` in Phase 6.**

**You MUST complete every step below. Do not skip any step — if a file doesn't exist, move on silently.**

---

## Step 0: Read the current state

```bash
cat requirements.txt
grep "FROM python:" Dockerfile
cat .github/workflows/push.yml
```

---

## Commit 1: `migrate to pyproject.toml 📦`

### Create `pyproject.toml`

Create a minimal `pyproject.toml` with metadata and ruff config but **no dependencies yet** — you'll populate those with `uv add` next:
- Always use `requires-python = "~=3.13.0"` and `target-version = "py313"`
- Leave `dependencies = []` empty for now

Then populate dependencies from `requirements.txt` using uv:

```bash
# Add all main deps at once
uv add -r requirements.txt

# Move test-only deps to the dev group (common ones: pytest, mock, freezegun, responses)
# For each test dep found in requirements.txt:
uv remove <test-dep>
uv add --group dev <test-dep>
```

`uv add` auto-converts pinned versions to `>=` ranges and updates `uv.lock` in place — no manual conversion needed.

### Delete files

```bash
rm -f requirements.txt
rm -f .flake8 flake8.cfg
rm -f scripts/build_n_run.ps1 scripts/run.bat scripts/run_kbc_tests.ps1
rm -f scripts/update_dev_portal_properties.sh
rm -rf docs/imgs/
rm -f component_config/configuration_description.md component_config/stack_parameters.json
```

(`rm -f` silently does nothing if a file doesn't exist — no errors, no stopping.)

### Populate `component_config/` URLs (if the files are currently empty)

```
component_config/documentationUrl.md  → https://github.com/keboola/REPO/blob/master/README.md
component_config/licenseUrl.md        → https://github.com/keboola/REPO/blob/master/LICENSE.md
component_config/sourceCodeUrl.md     → https://github.com/keboola/REPO
```

### Update `.gitignore`

Add these lines if not present:
```
*.egg-info/
.venv/
.DS_Store
/data
```

Replace bare `data/` with `/data`. Remove duplicate `.vscode/` entries.

### Commit

```bash
git add -u                                          # stages all deletions
git add pyproject.toml uv.lock .gitignore component_config/
git commit -m "migrate to pyproject.toml 📦"
```

---

## Commit 2: `uv 💜`

### Update `Dockerfile`

**Use the multi-stage build pattern.** The `base` stage is shared by both `test` and `production` — keeping the production image lean (no dev deps, no test files).

```dockerfile
FROM python:3.13-slim AS base
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# apt-get installs MUST come before uv sync
# RUN apt-get update && apt-get install -y <packages>  ← keep if already present

WORKDIR /code/
COPY pyproject.toml uv.lock ./
ENV UV_PROJECT_ENVIRONMENT="/usr/local/"
RUN uv sync --no-dev --frozen

COPY src/ src/
COPY scripts/ scripts/
COPY deploy.sh .

FROM base AS test
RUN uv sync --all-groups --frozen
COPY tests/ tests/
RUN uv run ruff check src/ tests/
CMD ["uv", "run", "pytest", "tests/", "-v"]

FROM base AS production
CMD ["python", "-u", "/code/src/component.py"]
```

Notes:
- `base` installs only production deps (`--no-dev`); `test` adds dev deps on top
- Ruff check runs at **image build time** in the `test` stage — failing fast
- `ENV KEY="value"` syntax (not old `ENV KEY value`)
- No `pip install` anywhere
- Any `apt-get` blocks must stay **before** `RUN uv sync`

### Update `scripts/build_n_test.sh`

```bash
#!/bin/sh
set -e

ruff check
python -m pytest tests/ --tb=short -q
```

### Update `tests/__init__.py`

Replace old `os.path` pattern:
```python
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent / "src"))
```

### Update `.github/workflows/push.yml`

The canonical push.yml uses a **multi-job pipeline** that matches the multi-stage Dockerfile. Rather than patching individual steps, replace the file entirely with the canonical template (from Phase 6 / component-defaults) and update only the `env:` block for this component:

```yaml
env:
  KBC_DEVELOPERPORTAL_APP: "vendor.component-id"   # full component ID from Developer Portal
  KBC_DEVELOPERPORTAL_VENDOR: "vendor"              # your vendor name
  DOCKERHUB_USER: ${{ secrets.DOCKERHUB_USER }}
  KBC_DEVELOPERPORTAL_USERNAME: ${{ vars.KBC_DEVELOPERPORTAL_USERNAME }}
  DOCKERHUB_TOKEN: ${{ secrets.DOCKERHUB_TOKEN }}
  KBC_DEVELOPERPORTAL_PASSWORD: ${{ secrets.KBC_DEVELOPERPORTAL_PASSWORD }}
  KBC_TEST_PROJECT_CONFIGS: ""
  KBC_STORAGE_TOKEN: ${{ secrets.KBC_STORAGE_TOKEN }}
```

The new pipeline structure (keep as-is from the canonical template):
- `push_event_info` — branch/tag detection, `is_deploy_ready` output (requires default branch + semantic tag)
- `build-test` — builds `--target test` stage, uploads as `*-test.tar` artifact
- `tests` — downloads test artifact, runs container (default CMD = pytest; ruff already ran at build time)
- `tests-kbc` — runs KBC integration tests if `KBC_TEST_PROJECT_CONFIGS` and token are set
- `build-production` — builds `--target production` stage after all tests pass, uploads as `*.tar` artifact
- `push` — loads production artifact, pushes to ECR
- `deploy` — sets tag in Developer Portal, only if `is_deploy_ready == true`
- `update_developer_portal_properties` — runs `scripts/developer_portal/update_properties.sh`

### Generate / verify lock file

`uv add` already updated `uv.lock` during Commit 1. Run this to ensure it's fully consistent:

```bash
uv sync --all-groups
```

### Commit

```bash
git add Dockerfile scripts/ tests/ .github/workflows/
git commit -m "uv 💜"
```

---

## Commit 3: `ruff linting baseline 🎨`

```bash
ruff format .
ruff check --fix .
```

Commit if any files changed:
```bash
git add src/ tests/
git commit -m "ruff linting baseline 🎨"
```

---

## Phase 6: Cookiecutter Alignment Check

Use the Task tool to load the canonical template files:
- subagent_type: `component-developer:component-defaults`
- prompt: `"Return the canonical Keboola component template files."`

Then compare each of the following against the returned canonical versions:

| Component file | Canonical |
|---|---|
| `Dockerfile` | from component-defaults |
| `.github/workflows/push.yml` | from component-defaults |
| `scripts/build_n_test.sh` | from component-defaults |
| `docker-compose.yml` | from component-defaults |
| `.pre-commit-config.yaml` | from component-defaults |

Fix structural differences. Keep component-specific additions (custom apt packages, SSL certs, etc.).
Create missing files from the canonical version (`.pre-commit-config.yaml` is often absent in old components).

```bash
git add Dockerfile scripts/ .github/workflows/ docker-compose.yml .pre-commit-config.yaml
git commit -m "align with cookiecutter template 🍪"
```

---

## Verify

```bash
# Build and run tests (ruff runs at build time inside the test stage)
docker build --target test -t test-component .
docker run test-component

# Optionally verify the production image builds cleanly
docker build --target production -t prod-component .
```

---

## Common Patterns

**Dependency conversion:**
```
requirements.txt          pyproject.toml
keboola.component==1.4.4  "keboola-component>=1.4.4"
mock                      "mock>=5.2.0"  (in dev group)
```

**Ruff config** (always use `"UP"` for pyupgrade):
```toml
[tool.ruff]
line-length = 120
target-version = "py313"

[tool.ruff.lint]
extend-select = ["I", "UP"]
```
