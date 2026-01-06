# GitHub Actions Workflow Templates

This document contains complete, standardized GitHub Actions workflow templates for Keboola Python packages using uv.

These templates are based on the successful migrations of:
- `keboola/python-http-client`
- `keboola/python-component`

**IMPORTANT**: These are EXACT templates - use them as-is with only package-specific customizations.

---

## Table of Contents

1. [push_dev.yml](#push_devyml) - Development branch testing
2. [deploy.yml](#deployyml) - Production PyPI deployment
3. [deploy_to_test.yml](#deploy_to_testyml) - Test PyPI deployment
4. [push_main.yml](#push_mainyml) - Documentation generation (optional)

---

## push_dev.yml

**Purpose**: Run tests on all branches except main  
**Triggers**: Push to any branch except main  
**Matrix**: Minimum supported + 2 latest Python versions

```yaml
name: Build & Test

on:
  push:
    branches:
      - "**"
      - "!main"

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.8", "3.13", "3.14"]  # Adjust minimum as needed

    steps:
      - name: Checkout 🛒
        uses: actions/checkout@v5

      - name: Install uv 💜
        uses: astral-sh/setup-uv@v6

      - name: Install and run ruff 🐶
        uses: astral-sh/ruff-action@v3

      - name: Set up Python ${{ matrix.python-version }} 🐍
        uses: actions/setup-python@v6
        with:
          python-version: ${{ matrix.python-version }}

      - name: Install dependencies 📦
        run: |
          uv sync --all-groups --frozen

      - name: Lint with flake8 ❄️
        run: |
          uv run flake8

      - name: Test with pytest ✅
        run: |
          uv run pytest tests

      - name: Version replacement based on tag ↔️
        if: github.ref_type == 'tag'
        run: |
          TAG_VERSION=${GITHUB_REF#refs/tags/}
          echo "Tag version: $TAG_VERSION"
          uv version $TAG_VERSION
```

### Customization Notes:

- **python-version matrix**: Set to `[MIN_SUPPORTED, "3.13", "3.14"]` where MIN_SUPPORTED ≥ 3.8
- Example for package requiring Python ≥3.10: `["3.10", "3.13", "3.14"]`
- **flake8 command**: Uses `.flake8` config file automatically (no `--config` flag needed)

---

## deploy.yml

**Purpose**: Build and publish to production PyPI  
**Triggers**: Tag push to main branch  
**Python**: Latest stable (3.14)

```yaml
name: Build & Upload Python Package to PyPI

on:
  push:
    tags:
      - '*'
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout 🛒
        uses: actions/checkout@v5

      - name: Install uv 💜
        uses: astral-sh/setup-uv@v6

      - name: Install and run ruff 🐶
        uses: astral-sh/ruff-action@v3

      - name: Set up Python 🐍
        uses: actions/setup-python@v6
        with:
          python-version: "3.14"

      - name: Install dependencies 📦
        run: |
          uv sync --all-groups --frozen

      - name: Lint with flake8 ❄️
        run: |
          uv run flake8

      - name: Test with pytest ✅
        run: |
          uv run pytest tests

      - name: Version replacement based on tag ↔️
        if: github.ref_type == 'tag'
        run: |
          TAG_VERSION=${GITHUB_REF#refs/tags/}
          echo "Tag version: $TAG_VERSION"
          uv version $TAG_VERSION

      - name: Build and publish 🚀
        env:
          UV_PUBLISH_TOKEN: ${{ secrets.UV_PUBLISH_TOKEN }}
        run: |
          uv build
          uv publish
```

### Customization Notes:

- **Python version**: Always use latest stable (currently 3.14)
- **Secret name**: Must be `UV_PUBLISH_TOKEN` (standard uv convention)
- **Trigger**: Automatic on any tag push to main

### Secret Setup:

1. Create PyPI API token: https://pypi.org/manage/account/token/
2. Add to GitHub: Settings → Secrets → Actions → New repository secret
3. Name: `UV_PUBLISH_TOKEN`
4. Value: Your PyPI token (starts with `pypi-`)

---

## deploy_to_test.yml

**Purpose**: Build and publish to Test PyPI  
**Triggers**: Manual workflow dispatch  
**Python**: Latest stable (3.14)

```yaml
name: Build & Upload Python Package To Test PyPI

on: workflow_dispatch

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout 🛒
        uses: actions/checkout@v5

      - name: Install uv 💜
        uses: astral-sh/setup-uv@v6

      - name: Install and run ruff 🐶
        uses: astral-sh/ruff-action@v3

      - name: Set up Python 🐍
        uses: actions/setup-python@v6
        with:
          python-version: "3.14"

      - name: Install dependencies 📦
        run: |
          uv sync --all-groups --frozen

      - name: Lint with flake8 ❄️
        run: |
          uv run flake8

      - name: Test with pytest ✅
        run: |
          uv run pytest tests

      - name: Version replacement based on tag ↔️
        if: github.ref_type == 'tag'
        run: |
          TAG_VERSION=${GITHUB_REF#refs/tags/}
          echo "Tag version: $TAG_VERSION"
          uv version $TAG_VERSION

      - name: Build and publish 🚀
        env:
          UV_PUBLISH_TOKEN: ${{ secrets.UV_PUBLISH_TOKEN_TEST_PYPI }}
        run: |
          uv build
          uv publish --index testpypi
```

### Customization Notes:

- **Trigger**: Manual only - provides full control over testing
- **Secret name**: Must be `UV_PUBLISH_TOKEN_TEST_PYPI`
- **Publish command**: Note `--index testpypi` flag

### Secret Setup:

1. Create Test PyPI API token: https://test.pypi.org/manage/account/token/
2. Add to GitHub: Settings → Secrets → Actions → New repository secret
3. Name: `UV_PUBLISH_TOKEN_TEST_PYPI`
4. Value: Your Test PyPI token (starts with `pypi-`)

### Usage:

1. Go to: https://github.com/ORG/REPO/actions/workflows/deploy_to_test.yml
2. Click "Run workflow"
3. Select branch or tag (e.g., `refs/tags/1.7.0`)
4. Click "Run workflow"

### pyproject.toml Configuration:

Ensure Test PyPI index is configured:

```toml
[[tool.uv.index]]
name = "testpypi"
url = "https://test.pypi.org/simple/"
publish-url = "https://test.pypi.org/legacy/"
explicit = true
```

---

## push_main.yml

**Purpose**: Generate and commit HTML documentation  
**Triggers**: Push to main branch  
**Python**: Latest stable (3.14)  
**OPTIONAL**: Only include if package generates docs with pdoc

```yaml
name: Build & Test

on:
  push:
    branches:
      - "main"

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout 🛒
        uses: actions/checkout@v5

      - name: Install uv 💜
        uses: astral-sh/setup-uv@v6

      - name: Set up Python 🐍
        uses: actions/setup-python@v6
        with:
          python-version: "3.14"

      - name: Create html documentation 📚
        run: |
          uv sync --all-groups --frozen
          uv run pdoc --html -f -o ./docs PACKAGE.MODULE
          mv ./docs/PACKAGE/MODULE/* docs
          rm -r ./docs/PACKAGE

      - name: Commit docs 📝
        run: |
          git config --global user.name 'KCF'
          git config --global user.email 'kcf@users.noreply.github.com'
          git commit --allow-empty -am "Automated html docs build"
          git push
```

### Customization Notes:

- **PACKAGE.MODULE**: Replace with your package path (e.g., `keboola.component`)
- **Move commands**: Adjust paths based on your package structure
- **Requires**: `pdoc3` in `[dependency-groups] dev` section of pyproject.toml

### When to Include:

✅ **Include this workflow if:**
- Old workflow exists: `.github/workflows/push_main.yml`
- AND contains: `pdoc` command
- AND generates HTML docs

❌ **Skip this workflow if:**
- No docs workflow exists
- Package doesn't generate HTML docs

### pyproject.toml Addition:

```toml
[dependency-groups]
dev = [
    "flake8>=5.0.4",
    "pytest>=8.3.5",
    "ruff>=0.13.2",
    "pdoc3",  # Required for docs generation
]
```

---

## Workflow Patterns Explained

### Standard Action Versions

**Always use latest:**
- `actions/checkout@v5` (not @v4)
- `actions/setup-python@v6` (not @v4)
- `astral-sh/setup-uv@v6`
- `astral-sh/ruff-action@v3`

**Why**: Latest versions have better performance, bug fixes, and features

### Consistent Step Names with Emoji

All Keboola workflows use emoji in step names for quick visual scanning:
- 🛒 Checkout
- 💜 Install uv
- 🐶 Ruff
- 🐍 Python
- 📦 Dependencies
- ❄️ Flake8
- ✅ Pytest
- ↔️ Version
- 🚀 Publish
- 📚 Docs
- 📝 Commit

**KEEP THESE** - they're part of Keboola's standardized workflow style

### Ruff: Blocking, Not Advisory

```yaml
- name: Install and run ruff 🐶
  uses: astral-sh/ruff-action@v3
  # NO continue-on-error: true
```

**Key**: No `continue-on-error: true` - ruff failures block the build

### Version Replacement Logic

```yaml
- name: Version replacement based on tag ↔️
  if: github.ref_type == 'tag'
  run: |
    TAG_VERSION=${GITHUB_REF#refs/tags/}
    echo "Tag version: $TAG_VERSION"
    uv version $TAG_VERSION
```

**How it works:**
1. Checks if build triggered by tag (not branch)
2. Extracts version from tag name (e.g., `refs/tags/1.7.0` → `1.7.0`)
3. Updates `version = "0.0.0"` in pyproject.toml to actual version
4. Build uses the tagged version

### Frozen Dependencies

```yaml
- name: Install dependencies 📦
  run: |
    uv sync --all-groups --frozen
```

**Why `--frozen`:**
- Ensures CI uses exact versions from `uv.lock`
- Prevents surprise dependency updates
- Deterministic builds
- Faster (no resolver needed)

---

## Differences from http-client

The python-component migration refined some patterns from http-client:

| Aspect | http-client | python-component | Standard |
|--------|-------------|------------------|----------|
| Action versions | `@v5`, `@v6` | `@v4` | Use **latest** (`@v5`, `@v6`) |
| Deploy trigger | `release: published` | `push: tags` | Use **`push: tags`** (simpler) |
| Test trigger | `create: tags: 0.*a` | `workflow_dispatch` | Use **`workflow_dispatch`** (flexible) |
| Secret name | `UV_PUBLISH_TOKEN_PYPI` | `UV_PUBLISH_TOKEN` | Use **`UV_PUBLISH_TOKEN`** |
| Python matrix | `[3.8, 3.13, 3.14]` | `[3.8, 3.14]` | Use **min + 2 latest** |

**Use python-component patterns with latest action versions.**

---

## Migration Checklist

When updating workflows:

- [ ] All 4 workflow files present (or 3 if no docs)
- [ ] Action versions updated to latest (`@v5`, `@v6`)
- [ ] `astral-sh/setup-uv@v6` added
- [ ] `astral-sh/ruff-action@v3` added (no continue-on-error)
- [ ] All `pip install` replaced with `uv sync --all-groups --frozen`
- [ ] All command invocations use `uv run`
- [ ] Python matrix uses [MIN, 3.13, 3.14]
- [ ] Version replacement logic present
- [ ] Secrets correctly named (`UV_PUBLISH_TOKEN`, `UV_PUBLISH_TOKEN_TEST_PYPI`)
- [ ] Emoji preserved in step names
- [ ] `uv.lock` generated and committed

---

## Testing Workflows

### Test Locally First

Before pushing:

```bash
# Test all checks locally
uv run flake8
uv run ruff check .
uv run pytest tests
uv build
uv version 1.7.0 --dry-run
```

### Test in CI

1. Push branch
2. Check Actions tab
3. Verify all jobs pass
4. Check step outputs

### Test PyPI Workflow

1. Create test tag: `git tag 1.7.0 && git push origin 1.7.0`
2. Manually trigger workflow
3. Check Test PyPI: https://test.pypi.org/project/PACKAGE/
4. Test install

### Production Workflow

1. Merge PR to main
2. Create release tag: `git tag 1.8.0 && git push origin 1.8.0`
3. Workflow auto-triggers
4. Verify on PyPI: https://pypi.org/project/PACKAGE/
5. Test install

---

## Troubleshooting Workflows

### Workflow doesn't trigger

**Check:**
- Branch filter correct
- Tag format matches pattern
- Secrets exist
- Repository permissions

### Build fails on uv sync

**Check:**
- `uv.lock` committed
- `--frozen` flag present
- Dependencies valid in pyproject.toml

### Publish fails

**Check:**
- Secret name correct
- Secret value is API token (not password)
- Token has correct scope
- Package name not already taken
- Version not already published

### Version not replaced

**Check:**
- Tag pushed (not just branch)
- `github.ref_type == 'tag'` condition works
- `uv version` command succeeds

---

## References

- GitHub Actions documentation: https://docs.github.com/actions
- uv documentation: https://docs.astral.sh/uv/
- PyPI API tokens: https://pypi.org/help/#apitoken
- Test PyPI: https://test.pypi.org/
