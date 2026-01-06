# Real Migration Examples

This document contains detailed examples of successful migrations from setup.py to uv in Keboola Python packages.

---

## Table of Contents

1. [python-http-client Migration](#python-http-client-migration)
2. [python-component Migration](#python-component-migration)
3. [Comparison and Lessons Learned](#comparison-and-lessons-learned)

---

## python-http-client Migration

**Repository**: https://github.com/keboola/python-http-client  
**Status**: First Keboola package to migrate to uv  
**Pattern**: Established the baseline approach

### Migration Context

- **Before**: setup.py + pip
- **After**: pyproject.toml + uv
- **Version strategy**: 0.x.x alpha tags for testing on Test PyPI
- **Commits**: Migration completed in atomic commits

### Key Files Changed

**pyproject.toml**:
```toml
[project]
name = "keboola.http-client"
version = "0.0.0"
dependencies = [
    "aiolimiter>=1.2.1",
    "httpx>=0.28.1",
    "requests>=2.32.4",
]
requires-python = ">=3.8"

[dependency-groups]
dev = [
    "flake8>=5.0.4",
    "pytest>=8.3.5",
    "ruff>=0.13.2",
]

[[tool.uv.index]]
name = "testpypi"
url = "https://test.pypi.org/simple/"
publish-url = "https://test.pypi.org/legacy/"
explicit = true
```

**Notable decisions**:
- ✅ Removed license classifier (PEP 639 compliance)
- ✅ Clean dev dependencies section
- ✅ TestPyPI configuration
- ✅ No pdoc (package doesn't generate docs)

### Workflow Configuration

**deploy_to_test.yml**:
```yaml
on:
  create:
    tags:
      - 0.*a
      - 1.*a
```

Pattern: Auto-trigger on alpha tags

**deploy.yml**:
```yaml
on:
  release:
    types: [ published ]
```

Pattern: Requires GitHub Release creation

### Action Versions Used

- `actions/checkout@v5`
- `actions/setup-python@v6`
- `astral-sh/setup-uv@v6`
- `astral-sh/ruff-action@v3`

### Python Matrix

```yaml
strategy:
  matrix:
    python-version: [3.8, 3.13, 3.14]
```

Three versions: minimum + two latest

### Flake8 Configuration

```bash
# Command in workflow
uv run flake8 --config flake8.cfg
```

Still used old config file name with explicit flag.

### Secrets Used

- `UV_PUBLISH_TOKEN_PYPI` (production)
- `UV_PUBLISH_TOKEN_TEST_PYPI` (testing)

### Lessons from http-client

**What worked well**:
- ✅ TestPyPI testing prevented production issues
- ✅ Three-version matrix caught compatibility issues
- ✅ Ruff as blocking check enforced quality

**What was refined in later migrations**:
- Workflow triggers could be simpler (manual vs alpha tag patterns)
- Secret naming could follow uv conventions
- Action versions evolved

---

## python-component Migration

**Repository**: https://github.com/keboola/python-component  
**Status**: Second migration, refined the approach  
**Pattern**: Improved on http-client experience

### Migration Context

- **Before**: setup.py + requirements.txt
- **Before version**: 1.6.13
- **Test versions**: 1.7.0, 1.7.1, 1.7.2 on Test PyPI
- **Production version**: 1.8.0 on production PyPI
- **Commits**: 3 logical commits (lint, pyproject, workflows)

### The 3-Commit Approach

#### Commit 1: "flake8 config consistent with cookiecutter template 🍪"

**Purpose**: Establish clean linting baseline

**Changes**:
- Renamed: `flake8.cfg` → `.flake8`
- Updated config to cookiecutter standard
- Fixed ALL flake8 errors:
  - `tests/test_dao.py`: Star imports (F403/F405), unused variables (F841)
  - `tests/test_interface.py`: Unused variables (F841), line length (E501), CRLF→LF

**Key insight**: Fixing linting first made migration diff clean

**Note on test_interface.py**: 
- Showed 1052 line changes due to CRLF→LF normalization
- Actual code changes: Only 5 lines
- This was EXPECTED and CORRECT cleanup

#### Commit 2: "migrate package configuration to pyproject.toml 📦"

**Purpose**: Modernize package metadata

**Changes**:
- Created comprehensive `pyproject.toml`
- Removed `License :: OSI Approved :: MIT License` classifier (PEP 639)
- Deleted `setup.py` and `requirements.txt`
- Updated `LICENSE` copyright to 2025

**Key insight**: Clean separation from commit 1 made review easy

#### Commit 3: "uv 💜"

**Purpose**: Update CI/CD to uv

**Changes**:
- Updated all 4 workflows (push_dev, push_main, deploy, deploy_to_test)
- Generated `uv.lock`
- Added ruff as blocking check
- Updated all action versions

**Key insight**: Workflows + lock file together as atomic change

### Key Files Changed

**pyproject.toml**:
```toml
[project]
name = "keboola.component"
version = "0.0.0"
dependencies = [
    "pygelf",
    "pytz<2021.0",
    "deprecated",
]
requires-python = ">=3.8"

[dependency-groups]
dev = [
    "flake8>=5.0.4",
    "pytest>=8.3.5",
    "ruff>=0.13.2",
    "pdoc3",  # Added for docs generation
]

[[tool.uv.index]]
name = "testpypi"
url = "https://test.pypi.org/simple/"
publish-url = "https://test.pypi.org/legacy/"
explicit = true
```

**Notable decisions**:
- ✅ Added `pdoc3` to dev deps (was ad-hoc before)
- ✅ Removed license classifier
- ✅ TestPyPI configuration
- ✅ Simple dependency list

### Workflow Configuration

**deploy_to_test.yml**:
```yaml
on: workflow_dispatch
```

**Improved from http-client**: Manual trigger for full flexibility

**deploy.yml**:
```yaml
on:
  push:
    tags:
      - '*'
    branches:
      - main
```

**Improved from http-client**: Automatic on tag push (simpler)

### Action Versions Used

Initially:
- `actions/checkout@v4`
- `actions/setup-python@v4`

**Note**: Should be updated to `@v5` and `@v6` for consistency

### Python Matrix

```yaml
strategy:
  matrix:
    python-version: ["3.8", "3.14"]
```

**Simplified from http-client**: Only min and max (later refined to add 3.13)

### Flake8 Configuration

```bash
# Command in workflow
uv run flake8
```

**Improved from http-client**: No explicit `--config` flag (uses `.flake8` automatically)

### Docs Workflow

**push_main.yml**:
```yaml
- name: Create html documentation 📚
  run: |
    uv sync --all-groups --frozen
    uv run pdoc --html -f -o ./docs keboola.component
    mv ./docs/keboola/component/* docs
    rm -r ./docs/keboola
```

**Improvement**: 
- Old: `pip install --user pdoc3` (ad-hoc)
- New: `pdoc3` in dev deps + `uv run pdoc`
- Properly tracked dependency

### Secrets Used

- `UV_PUBLISH_TOKEN` (production)
- `UV_PUBLISH_TOKEN_TEST_PYPI` (testing)

**Improved from http-client**: Standard uv naming convention

### Testing Procedure

1. **Local testing**:
```bash
uv build
uv version 1.7.0 --dry-run
uv run flake8
uv run ruff check .
uv run pytest tests
```

2. **Test PyPI (1.7.0)**:
```bash
git tag 1.7.0
git push origin 1.7.0
# Manually trigger workflow
```

3. **Installation test**:
```bash
cd /tmp && mkdir test_env && cd test_env
uv init
uv add --index-url https://test.pypi.org/simple/ \
       --extra-index-url https://pypi.org/simple/ \
       --index-strategy unsafe-best-match \
       keboola.component==1.7.0
uv run python -c "import keboola.component; print('✅')"
```

4. **Production (1.8.0)**:
```bash
# After PR merged to main
git tag 1.8.0
git push origin 1.8.0
# Auto-triggers deploy workflow
```

### Issues Encountered

**Issue 1: License Classifier Conflict**
- Error: `setuptools.errors.InvalidConfigError`
- Solution: Removed `License :: OSI Approved :: MIT License` classifier
- Status: Expected, PEP 639 compliance

**Issue 2: CRLF Line Endings**
- Symptom: 1052 lines changed in test_interface.py
- Cause: CRLF→LF normalization during flake8 fixes
- Status: Expected cleanup, actual changes only 5 lines

**Issue 3: Initial 0.0.0 Publish**
- Symptom: First test publish used version 0.0.0
- Cause: Workflow triggered without tag
- Solution: Create tag first, then trigger workflow manually

### Lessons from python-component

**What worked excellently**:
- ✅ 3-commit structure very reviewable
- ✅ Lint-first prevented noisy diffs
- ✅ Manual Test PyPI trigger gave full control
- ✅ Version strategy (1.7.x test, 1.8.0 prod) clear and effective
- ✅ Ruff blocking enforced quality immediately

**Refinements for future migrations**:
- Update action versions to latest (@v5, @v6)
- Add 3.13 to Python matrix (min + 2 latest)
- Document CRLF normalization as expected
- Add pdoc3 to dev deps proactively

---

## Comparison and Lessons Learned

### What Both Migrations Got Right

| Aspect | Implementation |
|--------|----------------|
| **Test-first approach** | Both tested on Test PyPI before production |
| **Version strategy** | Clear separation of test and production versions |
| **Action updates** | Updated to modern GitHub Actions versions |
| **Ruff enforcement** | Added as blocking quality gate |
| **Lock file** | Generated and committed `uv.lock` |
| **Documentation** | Comprehensive commit messages with emoji |

### Evolution from http-client to python-component

| Aspect | http-client | python-component | Improvement |
|--------|-------------|------------------|-------------|
| **Test trigger** | Alpha tag pattern | workflow_dispatch | More flexible |
| **Deploy trigger** | release: published | push: tags | Simpler workflow |
| **Secret naming** | UV_PUBLISH_TOKEN_PYPI | UV_PUBLISH_TOKEN | Standard convention |
| **Flake8 flag** | --config flake8.cfg | (no flag) | Cleaner |
| **Python matrix** | [3.8, 3.13, 3.14] | [3.8, 3.14] | Minimal (could add 3.13) |
| **Action versions** | @v5, @v6 | @v4 | http-client better |
| **Commit structure** | Atomic | 3 logical commits | More reviewable |

### Best Practices Established

#### 1. Commit Strategy

**Pattern**: 3 logical commits
- Lint baseline (prevents noise)
- Package metadata (clear separation)
- CI/CD workflows (tooling update)

**Flexibility**: Adapt as needed (2-4 commits acceptable)

#### 2. Version Strategy

**Pattern**: Two consecutive minors
- Next minor: Testing (X.Y+1.x)
- Following minor: Production (X.Y+2.0)

**Example**: 1.6.13 → 1.7.x (test) → 1.8.0 (prod)

#### 3. Testing Strategy

**Always**:
1. Local testing first
2. Test PyPI second
3. Production last
4. Verify installation after each

#### 4. Workflow Patterns

**Standard**:
- Manual Test PyPI trigger (workflow_dispatch)
- Automatic production on tag push
- Ruff blocking (no continue-on-error)
- Latest action versions
- Frozen dependencies (--frozen)

#### 5. Python Matrix

**Optimal**: [MIN_SUPPORTED, "3.13", "3.14"]
- Minimum supported (compatibility floor)
- Two latest (future-proofing)
- Skips intermediates (efficiency)

#### 6. Documentation

**Include in migration**:
- Comprehensive commit messages
- PR description with testing results
- Update README if references build system
- Announcement to team

### Common Pitfalls and Solutions

| Pitfall | Solution |
|---------|----------|
| Forgetting to remove license classifier | Always remove with PEP 639 |
| Not testing locally first | Run all checks before pushing |
| Skipping Test PyPI | Always test there first |
| Wrong secret names | Use UV_PUBLISH_TOKEN standard |
| Old action versions | Update to @v5, @v6 |
| Missing pdoc3 from dev deps | Add if docs workflow exists |
| Not committing uv.lock | Always commit after uv sync |
| CRLF concerns | Expect and embrace normalization |

### Recommendations for Future Migrations

Based on both examples:

**DO**:
- ✅ Fix linting first (lint-first principle)
- ✅ Use 3 logical commits (reviewability)
- ✅ Test on Test PyPI first (safety)
- ✅ Use version strategy (X.Y+1 test, X.Y+2 prod)
- ✅ Make ruff blocking (quality gate)
- ✅ Use latest action versions (@v5, @v6)
- ✅ Document thoroughly (PR, commits, announcements)

**DON'T**:
- ❌ Skip local testing
- ❌ Forget to commit uv.lock
- ❌ Use old action versions
- ❌ Skip Test PyPI testing
- ❌ Combine unrelated changes
- ❌ Force push to main
- ❌ Use pip or uv pip (only uv add)

### Success Metrics

Both migrations succeeded by achieving:
- ✅ Zero production issues
- ✅ Clean, reviewable changes
- ✅ Fast CI builds
- ✅ Deterministic dependencies
- ✅ Modern tooling adoption
- ✅ Team knowledge transfer

### Timeline Reference

**python-component migration**:
- **Planning**: Review http-client experience
- **Implementation**: 3 commits over 1 session
- **Testing**: Multiple Test PyPI releases (1.7.0, 1.7.1)
- **Production**: Single release (1.8.0)
- **Total time**: Same-day migration and release

**Efficiency note**: With established pattern, future migrations should be similarly fast.

---

## Conclusion

Both migrations demonstrate that the pattern works reliably:

1. **Lint first** - Clean baseline
2. **Migrate metadata** - Modern config
3. **Update workflows** - Modern tooling
4. **Test thoroughly** - Test PyPI first
5. **Release confidently** - Production PyPI

The refinements from http-client to python-component show continuous improvement while maintaining core principles.

**For your next migration**: Follow python-component pattern with latest action versions!
