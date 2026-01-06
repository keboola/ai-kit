# Complete Migration Guide: setup.py to uv

This guide provides comprehensive details for migrating Keboola Python packages from legacy build systems to modern uv.

## Table of Contents

1. [Commit Philosophy](#commit-philosophy)
2. [Version Strategy](#version-strategy)
3. [Detailed Migration Steps](#detailed-migration-steps)
4. [Python Matrix Configuration](#python-matrix-configuration)
5. [Docs Workflow Migration](#docs-workflow-migration)

---

## Commit Philosophy

### Why Logical Commits Matter

**Goal**: Create commits that tell a story and are easy to review, revert, and understand

**Benefits:**
- **Reviewability**: Each commit has clear, focused scope
- **Debuggability**: Git bisect works effectively
- **Rollback**: Can revert specific changes independently
- **Documentation**: Commit history serves as change log

### The 3-Commit Pattern (Guideline, Not Dogma)

This pattern emerged from successful python-http-client and python-component migrations:

#### Commit 1: Linting Baseline
**Purpose**: Establish clean code quality baseline
**Files**: `.flake8`, test files, source files
**Why first**: Prevents linting fixes from polluting migration diffs

#### Commit 2: Package Metadata
**Purpose**: Modernize package configuration
**Files**: `pyproject.toml` (new), `setup.py` (deleted), `requirements.txt` (deleted), `LICENSE`
**Why separate**: Clear separation between configuration and tooling

#### Commit 3: CI/CD Workflows
**Purpose**: Update automation to use uv
**Files**: `.github/workflows/*.yml`, `uv.lock`
**Why last**: Builds on clean code + modern config

### Flexibility in Practice

**The pattern is flexible**:
- **2 commits**: Combine lint fixes with pyproject.toml if changes are small
- **4 commits**: Separate individual workflows if changes are complex
- **Different order**: Could do pyproject.toml first if no linting issues

**Key principle**: Each commit should be:
1. **Atomic**: Complete, functional change
2. **Logical**: Clear single purpose
3. **Reviewable**: Easy to understand in isolation

### The Lint-First Principle

**Why fix linting BEFORE migrating:**

1. **Clean diff**: Migration changes are visible without noise
2. **Attribution**: Clear what's a fix vs what's migration
3. **Early detection**: Reveals code quality issues before they hide in migration
4. **Review efficiency**: Reviewer can focus on actual changes

**Example**: Without lint-first:
```diff
# Hard to review - is this line ending change part of migration?
-def foo(x):
+def foo(x):
     return x
```

**With lint-first**:
```diff
# Commit 1: Just the line ending fix
# Commit 2: Clean migration changes only
```

---

## Version Strategy

### The Two-Minor Approach

**Pattern**: Use two consecutive minor versions for testing and production

**Example (starting from 1.6.13):**
- **Testing phase**: 1.7.0, 1.7.1, 1.7.2 on Test PyPI
- **Production release**: 1.8.0 on production PyPI

**Why this works:**
- Clear separation between test and production releases
- Test version numbers will never conflict with production
- Easy to identify which version is which (odd=test, even=prod works but not required)

### Flexibility in Format

**The pattern is flexible on format:**

**Option A**: Simple incrementing (used in python-component)
```
1.7.0 → Test PyPI (first test)
1.7.1 → Test PyPI (bug fixes found)
1.7.2 → Test PyPI (final test)
1.8.0 → Production PyPI (release)
```

**Option B**: Alpha notation (used in python-http-client)
```
1.7.0a1 → Test PyPI (alpha 1)
1.7.0a2 → Test PyPI (alpha 2)
1.7.0    → Test PyPI (release candidate)
1.8.0    → Production PyPI (release)
```

**Key principle**: Pattern consistency matters more than exact format

### For Future Migrations

**When migrating from version X.Y.Z:**
1. **Next minor** (X.Y+1.x) = Testing versions
2. **Following minor** (X.Y+2.0) = Production release

**Examples:**
- From 2.5.3 → Test as 2.6.x → Release 2.7.0
- From 3.12.0 → Test as 3.13.x → Release 3.14.0

---

## Detailed Migration Steps

### Pre-Migration Checklist

**Before starting any changes:**

```bash
# 1. Ensure clean working tree
git status  # Should be clean

# 2. Create migration branch
git checkout -b uv

# 3. Check current version
# Either from setup.py or PyPI
python setup.py --version  # Or check PyPI

# 4. Verify tests pass with old system
python -m pytest tests

# 5. Check Python version requirements
grep python_requires setup.py
```

### Step 1: Linting Baseline (Commit 1)

**1.1: Update flake8 configuration**

If `flake8.cfg` exists:
```bash
mv flake8.cfg .flake8
```

Create or update `.flake8` to cookiecutter standard:
```bash
cat > .flake8 << 'EOF'
[flake8]
exclude = __pycache__, .git, .venv, venv, docs
ignore = E203,W503
max-line-length = 120
EOF
```

**1.2: Install flake8 and run checks**

```bash
# If setup.py exists
python -m pip install flake8

# Or use uv immediately
uv add --dev flake8

# Run flake8
flake8 src/ tests/
```

**1.3: Fix all errors systematically**

Common error types and fixes:

**F403/F405 - Star imports:**
```python
# Bad
from module import *

# Good
from module import SpecificClass, specific_function
```

**F841 - Unused variables:**
```python
# Bad
x = some_function()  # x never used

# Good
some_function()  # Don't assign if not used
# Or: _ = some_function()  # Explicit ignore
```

**E501 - Line too long:**
```python
# Bad
some_function(very_long_argument_name, another_long_argument, yet_another_argument, and_more)

# Good
some_function(
    very_long_argument_name,
    another_long_argument,
    yet_another_argument,
    and_more
)
```

**E231 - Missing whitespace:**
```python
# Bad
x=[1,2,3]

# Good
x = [1, 2, 3]
```

**CRLF line endings:**
```bash
# Convert all Python files
find . -name "*.py" -exec dos2unix {} \;

# Or let your editor fix it automatically
```

**1.4: Verify all issues fixed**

```bash
flake8 src/ tests/
# Should output nothing
```

**1.5: Commit**

```bash
git add .flake8 src/ tests/
git commit -m "flake8 config consistent with cookiecutter template 🍪"
```

### Step 2: Package Metadata (Commit 2)

**2.1: Extract dependencies from setup.py**

```bash
# View current dependencies
grep -A 20 "install_requires" setup.py
grep -A 10 "setup_requires" setup.py
grep -A 10 "tests_require" setup.py
```

**2.2: Create pyproject.toml**

Use the template from `templates/pyproject.toml.template` and customize:

```toml
[project]
name = "your.package"
version = "0.0.0"  # Replaced by git tags in CI
dependencies = [
    # Copy from install_requires
]
requires-python = ">=3.8"  # Or higher if already specified

[dependency-groups]
dev = [
    "flake8>=5.0.4",
    "pytest>=8.3.5",
    "ruff>=0.13.2",
    # Add pdoc3 if docs exist
    # Add other dev deps from setup_requires, tests_require
]
```

**IMPORTANT**: Remove `License :: OSI Approved :: MIT License` classifier (PEP 639)

**2.3: Delete old files**

```bash
git rm setup.py
git rm requirements.txt  # if exists
```

**2.4: Update LICENSE**

```bash
# Update copyright year to current year
sed -i 's/Copyright (c) 20[0-9][0-9]/Copyright (c) 2026/' LICENSE
```

**2.5: Commit**

```bash
git add pyproject.toml LICENSE
git commit -m "migrate package configuration to pyproject.toml 📦"
```

### Step 3: CI/CD Workflows (Commit 3)

**3.1: Update all workflows**

For each workflow file in `.github/workflows/`:
- `push_dev.yml` (always present)
- `deploy.yml` (always present)
- `deploy_to_test.yml` (always present)
- `push_main.yml` (only if docs exist)

See `references/workflow-templates.md` for complete YAML templates.

**3.2: Generate uv.lock**

```bash
uv sync --all-groups
```

**3.3: Test locally**

```bash
# Test build
uv build

# Test version command
uv version 1.7.0 --dry-run

# Run checks
uv run flake8
uv run ruff check .
uv run pytest tests
```

**3.4: Commit**

```bash
git add .github/workflows/*.yml uv.lock
git commit -m "uv 💜"
```

---

## Python Matrix Configuration

### Strategy: Minimum + Two Latest

**Purpose**: Ensure compatibility at minimum supported version + test against latest Python

**Formula**:
```python
min_supported = max(3.8, current_requires_python)
matrix = [min_supported, "3.13", "3.14"]
```

**Examples in practice**:

**Package supporting Python ≥3.8:**
```yaml
strategy:
  matrix:
    python-version: ["3.8", "3.13", "3.14"]
```

**Package supporting Python ≥3.10:**
```yaml
strategy:
  matrix:
    python-version: ["3.10", "3.13", "3.14"]
```

**Package supporting Python ≥3.12:**
```yaml
strategy:
  matrix:
    python-version: ["3.12", "3.13", "3.14"]
```

### Rationale

**Why minimum + two latest (not all versions)?**

1. **Compatibility floor**: Ensures package works at minimum supported version
2. **Future-proofing**: Tests against newest Python releases
3. **CI efficiency**: Faster builds (3 versions vs 7 versions)
4. **Coverage**: Catches both old and new Python issues

**What we skip**: Intermediate versions (3.9, 3.11) that are well-covered by min/max testing

---

## Docs Workflow Migration

### Detection Logic

**Check if docs workflow exists and uses pdoc:**

```bash
if [ -f .github/workflows/push_main.yml ]; then
    if grep -q pdoc .github/workflows/push_main.yml; then
        echo "Docs workflow exists - include in migration"
    fi
fi
```

### Old Pattern (pre-migration)

```yaml
- name: Create html documentation 📚
  run: |
    pip install --user pdoc3  # Ad-hoc install
    python setup.py install
    pdoc --html -f -o ./docs package.module
```

**Problems:**
- pdoc3 not tracked in dependencies
- Requires setup.py
- Uses pip

### New Pattern (post-migration)

**Step 1**: Add pdoc3 to pyproject.toml:
```toml
[dependency-groups]
dev = [
    "flake8>=5.0.4",
    "pytest>=8.3.5",
    "ruff>=0.13.2",
    "pdoc3",  # Add this
]
```

**Step 2**: Update workflow:
```yaml
- name: Create html documentation 📚
  run: |
    uv sync --all-groups --frozen  # Installs pdoc3 from dev deps
    uv run pdoc --html -f -o ./docs package.module
    mv ./docs/package/module/* docs
    rm -r ./docs/package
```

**Improvements:**
- ✅ pdoc3 properly tracked in pyproject.toml
- ✅ No setup.py dependency
- ✅ Uses modern uv
- ✅ Deterministic (locked version)

### When to Include push_main.yml

**Include if:**
- File exists: `.github/workflows/push_main.yml`
- AND contains: `pdoc` keyword
- AND package generates HTML docs

**Skip if:**
- File doesn't exist
- Or file exists but doesn't use pdoc
- Or package doesn't generate docs

---

## Post-Migration Checklist

After completing all commits:

- [ ] All tests pass locally with uv
- [ ] `uv build` succeeds
- [ ] `uv run flake8` passes
- [ ] `uv run ruff check .` passes
- [ ] Branch pushed to GitHub
- [ ] Test tag created and pushed
- [ ] Test PyPI workflow triggered manually
- [ ] Package appears on Test PyPI
- [ ] Package installable from Test PyPI
- [ ] Import test successful
- [ ] PR created with proper description
- [ ] PR approved and merged
- [ ] Production tag created
- [ ] Production deployment successful
- [ ] Package verified on production PyPI

---

## Best Practices

1. **Commit granularity**: Prefer smaller, logical commits over large monolithic ones
2. **Test between commits**: Ensure each commit leaves the repository in working state
3. **Clear messages**: Use descriptive commit messages with emoji for clarity
4. **Branch naming**: Use descriptive branch names like `uv` or `migrate-to-uv`
5. **Force push carefully**: Only force push to feature branches, never to main
6. **Tag management**: Delete and recreate test tags if needed, never production tags
7. **Documentation**: Update README if it references old build system
8. **Communication**: Notify team of changes, especially about new installation methods

---

## References

- PEP 517: A build-system independent format for source trees
- PEP 518: Specifying Minimum Build System Requirements
- PEP 639: Improving License Clarity with Better Package Metadata
- uv documentation: https://docs.astral.sh/uv/
- agentskills.io: https://agentskills.io/
