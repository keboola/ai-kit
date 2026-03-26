---
name: migrate-to-uv
description: Migrate Keboola Python components to modern uv build system with deterministic dependencies and ruff linting.
tools: Bash, Read, Write, Edit, Glob, Grep, Task, Question
model: sonnet
color: purple
---

# Migrate to uv Build System

Migrate a Keboola component (Docker-based, ECR-deployed) from `requirements.txt` + pip to `pyproject.toml` + uv with ruff linting.

**Execute all steps yourself using the tools available to you. Do NOT delegate to or invoke any other agent (component-builder, build-component, or similar) — except `component-developer:component-defaults` in Phase 6.**

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

Create `pyproject.toml` with this structure. Convert deps from `requirements.txt`:
- `package.name==x.y.z` → `"package-name>=x.y.z"` (dot→dash, ==→>=)
- Test-only deps (pytest, mock, freezegun) go in `[dependency-groups] dev`
- Always use `requires-python = "~=3.13.0"` and `target-version = "py313"`

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
git add pyproject.toml .gitignore component_config/
git commit -m "migrate to pyproject.toml 📦"
```

---

## Commit 2: `uv 💜`

### Update `Dockerfile`

**ALWAYS upgrade base image to `python:3.13-slim`** regardless of current version unless library dependency issues during uv lock

Full updated pattern:
```dockerfile
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# apt-get installs MUST come before uv sync
# RUN apt-get update && apt-get install -y <packages>  ← keep if already present

WORKDIR /code/
COPY pyproject.toml .
COPY uv.lock .
ENV UV_PROJECT_ENVIRONMENT="/usr/local/"
RUN uv sync --all-groups --frozen

COPY src/ src
COPY tests/ tests
COPY scripts/ scripts
COPY deploy.sh .

# Keep any existing app-specific ENV vars (SSL certs, PYTHONWARNINGS, etc.) here
CMD ["python", "-u", "src/component.py"]
```

Notes:
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

1. Change trigger to `branches-ignore: [main]`:
```yaml
on:
  push:
    branches-ignore:
      - main
    tags:
      - "*"
```

2. Replace the image tag step with:
```yaml
- name: Set image tag
  run: |
    REF="${GITHUB_REF##*/}"
    if [ "${{ github.ref_type }}" = "tag" ]; then
      TAG="$REF"
    else
      TAG="$REF-${{ github.run_number }}"
    fi
    IS_SEMANTIC_TAG=$(echo "$REF" | grep -q '^[0-9]\+\.[0-9]\+\.[0-9]\+$' && echo true || echo false)
    echo "is_semantic_tag=$IS_SEMANTIC_TAG" | tee -a $GITHUB_OUTPUT
    echo "app_image_tag=$TAG" | tee -a $GITHUB_OUTPUT
```

3. Replace linting step:
```yaml
# Before:
docker run ... flake8 . --config=flake8.cfg
# After:
docker run ${{ env.KBC_DEVELOPERPORTAL_APP }}:latest ruff check .
```

4. Replace test step:
```yaml
# Before:
docker run ... python -m unittest discover
# After:
docker run ${{ env.KBC_DEVELOPERPORTAL_APP }}:latest python -m pytest tests/ --tb=short -q
```

5. Fix `Get current branch name` step if present — check for the broken `//` pattern:
```yaml
# WRONG — ${raw//origin\//} is a global replace, leaves "remotes/" prefix, breaks tag pushes:
branch="$(echo ${raw//origin\//} | tr -d '\n')"

# CORRECT — ${raw/*origin\//} strips everything up to and including the last "origin/":
- name: Get current branch name
  id: current_branch
  run: |
    if [[ ${{ github.ref }} != "refs/tags/"* ]]; then
      branch_name=${{ github.ref_name }}
      echo "branch_name=$branch_name" | tee -a $GITHUB_OUTPUT
    else
      raw=$(git branch -r --contains ${{ github.ref }})
      branch="$(echo ${raw/*origin\//} | tr -d '\n')"
      echo "branch_name=$branch" | tee -a $GITHUB_OUTPUT
    fi
```

### Generate lock file

```bash
uv sync --all-groups
```

### Commit

```bash
git add Dockerfile scripts/ tests/ .github/workflows/ uv.lock
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
docker build -t test-component .
docker run test-component ruff check .
docker run test-component python -m pytest tests/ --tb=short -q
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
