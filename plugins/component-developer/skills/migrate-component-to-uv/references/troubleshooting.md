# Troubleshooting Guide

Common issues encountered during migration from setup.py to uv, and their solutions.

---

## Build Issues

### Error: License Classifier Conflict

**Symptom:**
```
setuptools.errors.InvalidConfigError: License classifiers have been superseded by 
license expressions (see https://peps.python.org/pep-0639/). Please remove:

License :: OSI Approved :: MIT License
```

**Cause**: Modern setuptools (used by uv) follows PEP 639 which deprecates license classifiers in favor of the `license` field.

**Solution:**
Remove the license classifier from `pyproject.toml` classifiers:

```toml
# WRONG - will cause error
classifiers = [
    "License :: OSI Approved :: MIT License",  # Remove this
    "Programming Language :: Python :: 3",
]

# CORRECT
license = "MIT"  # Keep this
classifiers = [
    "Programming Language :: Python :: 3",  # No license classifier
]
```

**Status**: This is expected and correct. The migration should always remove license classifiers.

---

### Error: uv version Command Not Found

**Symptom:**
```
uv: command 'version' not recognized
```

**Cause**: Old version of uv that doesn't have the `version` subcommand.

**Solution:**
Update uv to ≥0.5.0:

```bash
# Check current version
uv --version

# Update uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or if installed via pip
pip install --upgrade uv

# Verify
uv version --help  # Should show help text
```

**Note**: In CI, `astral-sh/setup-uv@v6` installs correct version automatically.

---

### Error: Module Not Found During Build

**Symptom:**
```
ModuleNotFoundError: No module named 'your_package'
```

**Cause**: Package not properly installed or wrong directory structure.

**Solution:**

1. Check package structure in `pyproject.toml`:
```toml
# For src-layout
[tool.setuptools]
packages = {find = {where = ["src"]}}

# Or explicitly list
packages = ["your_package"]
```

2. Ensure source files in correct location:
```
src/
└── your_package/
    └── __init__.py
```

3. Reinstall:
```bash
uv sync --all-groups
```

---

## Git and Line Ending Issues

### Large Diffs in Unchanged Files

**Symptom:**
```
tests/test_file.py shows 1000+ line changes but actual code changes are minimal
```

**Cause**: Files had CRLF (Windows) line endings that were normalized to LF (Unix) during flake8 fixes.

**Status**: **This is EXPECTED and GOOD**

**Explanation:**
- Python files should use LF line endings (Unix standard)
- Git diff shows every line as changed because line ending character changed
- Actual code is identical except for `\r\n` → `\n`

**Verification:**
```bash
# Check actual code changes (ignoring whitespace)
git diff --ignore-all-space main...your-branch -- file.py

# Should show minimal real changes
```

**Action**: No action needed. This is correct cleanup that should have happened long ago.

---

### Git Commit Attribution Issues

**Symptom:**
Git blames all lines in file to you after line ending fix.

**Cause**: Line ending normalization changes all lines technically.

**Solution:**
Use `.git-blame-ignore-revs` to exclude normalization commits from blame:

```bash
# Create file
cat > .git-blame-ignore-revs << 'EOF'
# Flake8 config update with CRLF normalization
<commit-hash-of-commit-1>
EOF

# Configure git to use it
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

---

## Dependency Issues

### Error: Dependency Resolution Failed

**Symptom:**
```
× No solution found when resolving dependencies:
  ╰─▶ Because package-a requires package-b>=2.0 and package-b==1.5...
```

**Cause**: Conflicting dependency constraints.

**Solution:**

1. Check dependencies in `pyproject.toml`:
```toml
dependencies = [
    "package-a>=1.0",
    "package-b>=2.0",  # Make sure these don't conflict
]
```

2. Try resolving without lock:
```bash
uv sync --no-lock
```

3. Update dependencies:
```bash
uv add package-a --upgrade
```

4. Check for platform-specific issues:
```bash
uv sync --python 3.8  # Test different Python versions
```

---

### Error: Package Not Found on Test PyPI

**Symptom:**
```
× No solution found when resolving dependencies:
  ╰─▶ Because there is no version of your-package==1.7.0
```

**Cause**: Package exists on PyPI but not Test PyPI (or vice versa), and uv checks PyPI first.

**Solution:**

Add `--index-strategy unsafe-best-match`:

```bash
uv add --index-url https://test.pypi.org/simple/ \
       --extra-index-url https://pypi.org/simple/ \
       --index-strategy unsafe-best-match \
       your-package==1.7.0
```

**Why**: By default, uv only checks first index that has package. This flag allows checking all indexes.

**Security note**: Only use with trusted indexes (PyPI and Test PyPI are both trusted).

---

## CI/CD Issues

### Workflow Doesn't Trigger

**Symptom:**
Push tag but workflow doesn't run.

**Possible causes and solutions:**

1. **Branch filter**:
```yaml
# Check this matches
on:
  push:
    tags:
      - '*'
    branches:
      - main  # Tag must be on main branch
```

2. **Workflow file location**:
```bash
# Must be in .github/workflows/
ls .github/workflows/deploy.yml
```

3. **YAML syntax error**:
```bash
# Validate YAML
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"
```

4. **Permissions**:
- Check: Settings → Actions → General → Workflow permissions
- Should be: Read and write permissions

---

### Secret Not Found in Workflow

**Symptom:**
```
Error: Environment variable UV_PUBLISH_TOKEN not found
```

**Solution:**

1. Check secret exists:
   - Go to: Settings → Secrets → Actions
   - Verify: `UV_PUBLISH_TOKEN` or `UV_PUBLISH_TOKEN_TEST_PYPI` exists

2. Check secret name in workflow:
```yaml
env:
  UV_PUBLISH_TOKEN: ${{ secrets.UV_PUBLISH_TOKEN }}
  # Name must match exactly (case-sensitive)
```

3. Recreate secret if needed:
   - Delete old secret
   - Create new PyPI token: https://pypi.org/manage/account/token/
   - Add with exact name: `UV_PUBLISH_TOKEN`

---

### Build Fails: uv.lock Out of Sync

**Symptom:**
```
error: The lockfile at `uv.lock` needs to be updated, but `--frozen` was provided
```

**Cause**: `uv.lock` is out of sync with `pyproject.toml`.

**Solution:**

1. Regenerate lock file:
```bash
uv sync --all-groups
```

2. Commit updated lock:
```bash
git add uv.lock
git commit -m "update uv.lock"
```

**Prevention**: Always run `uv sync` after changing `pyproject.toml` dependencies.

---

### Publish Fails: Package Already Exists

**Symptom:**
```
error: Package already exists on PyPI: your-package==1.7.0
```

**Cause**: Version already published (PyPI doesn't allow re-uploading same version).

**Solution:**

1. **For Test PyPI** (safe to increment):
```bash
# Delete old tag
git tag -d 1.7.0
git push origin :refs/tags/1.7.0

# Create new version
git tag 1.7.1
git push origin 1.7.1
```

2. **For Production PyPI** (more careful):
```bash
# Cannot reuse version - must increment
git tag 1.8.1  # Or 1.9.0 if significant changes
git push origin 1.8.1
```

**Note**: Never use `--skip-existing` - each version should be unique.

---

### Ruff Fails: Code Quality Issues

**Symptom:**
```
error: ruff check failed with code violations
```

**Cause**: Code doesn't pass ruff checks.

**Solution:**

1. Run ruff locally:
```bash
uv run ruff check .
```

2. Auto-fix what's fixable:
```bash
uv run ruff check --fix .
```

3. Review and fix remaining issues manually

4. If intentional violations, add to `pyproject.toml`:
```toml
[tool.ruff]
ignore = [
    "E501",  # Line too long (if intentional)
]
```

**Note**: Ruff is blocking by design - maintain code quality standards.

---

## Installation and Usage Issues

### Cannot Install from Test PyPI

**Symptom:**
```
No matching distribution found for your-package==1.7.0
```

**Cause**: Package dependencies not available on Test PyPI.

**Solution:**

Always use both indexes:

```bash
uv add --index-url https://test.pypi.org/simple/ \
       --extra-index-url https://pypi.org/simple/ \
       --index-strategy unsafe-best-match \
       your-package==1.7.0
```

**Why**: Test PyPI only has packages explicitly uploaded there. Dependencies come from production PyPI.

---

### Package Installs But Import Fails

**Symptom:**
```
ImportError: No module named 'your_package'
```

**Possible causes:**

1. **Package name vs import name mismatch**:
```toml
# pyproject.toml
name = "your-package"  # With hyphen

# But import uses:
import your_package  # With underscore
```

2. **Wrong package structure**: Check `pyproject.toml`:
```toml
[tool.setuptools]
packages = ["your_package"]  # Should match actual directory
```

3. **Not installed in current environment**:
```bash
uv run python -c "import your_package"  # Use uv run
```

---

## Version and Tagging Issues

### Version Not Updated in Built Package

**Symptom:**
Built package still shows `version = "0.0.0"`.

**Cause**: Version replacement didn't run or failed.

**Solution:**

1. Check if tag was pushed:
```bash
git ls-remote --tags origin
```

2. Check workflow condition:
```yaml
if: github.ref_type == 'tag'  # Must be exactly this
```

3. Test version command locally:
```bash
uv version 1.7.0 --dry-run
# Should show: your-package 0.0.0 => 1.7.0
```

4. Check pyproject.toml has version field:
```toml
[project]
version = "0.0.0"  # Must exist for uv version to work
```

---

### Accidentally Pushed Wrong Tag

**Symptom:**
Created `1.7.0` instead of `1.7.1`.

**Solution for Test PyPI** (safe):
```bash
# Delete local tag
git tag -d 1.7.0

# Delete remote tag
git push origin :refs/tags/1.7.0

# Create correct tag
git tag 1.7.1
git push origin 1.7.1
```

**Solution for Production PyPI** (careful):
```bash
# Cannot delete from PyPI once published
# Must create new version

# If not yet published:
git push origin :refs/tags/1.7.0  # Delete tag
git tag 1.7.1
git push origin 1.7.1

# If already published:
# Accept it and use next version (1.7.2, 1.8.0, etc.)
```

---

## Documentation Issues

### Docs Generation Fails

**Symptom:**
```
ModuleNotFoundError: No module named 'pdoc'
```

**Cause**: `pdoc3` not in dev dependencies.

**Solution:**

Add to `pyproject.toml`:
```toml
[dependency-groups]
dev = [
    "pdoc3",
]
```

Then:
```bash
uv sync --all-groups
```

---

### Docs Commit Fails

**Symptom:**
```
fatal: unable to access 'https://github.com/...': Permission denied
```

**Cause**: Workflow doesn't have permission to push.

**Solution:**

Check repository settings:
- Settings → Actions → General → Workflow permissions
- Select: "Read and write permissions"
- Check: "Allow GitHub Actions to create and approve pull requests"

---

## General Debugging Tips

### Enable Verbose Output

```bash
# Verbose uv output
uv sync -v

# Very verbose
uv sync -vv

# Debug level
uv sync -vvv
```

### Check Environment

```bash
# Python version
python --version

# uv version
uv --version

# Which Python uv uses
uv run python --version

# Installed packages
uv pip list
```

### Validate Configuration

```bash
# Check pyproject.toml syntax
python -c "import tomllib; tomllib.load(open('pyproject.toml', 'rb'))"

# Check lock file
cat uv.lock | head -20

# Test import
uv run python -c "import your_package; print(your_package.__version__)"
```

### Clean Rebuild

```bash
# Remove all build artifacts
rm -rf build/ dist/ src/*.egg-info/

# Remove lock
rm uv.lock

# Fresh sync
uv sync --all-groups

# Fresh build
uv build
```

---

## Getting Help

### Resources

- uv documentation: https://docs.astral.sh/uv/
- uv GitHub issues: https://github.com/astral-sh/uv/issues
- PyPI help: https://pypi.org/help/
- Keboola developers: https://developers.keboola.com/

### Debugging Checklist

When asking for help, provide:
- [ ] uv version (`uv --version`)
- [ ] Python version (`python --version`)
- [ ] Complete error message
- [ ] Relevant pyproject.toml sections
- [ ] Steps to reproduce
- [ ] What you've tried already

### Common "It Works on My Machine" Issues

1. **Different uv version**: Check with `uv --version`
2. **Different Python version**: Check with `python --version`
3. **Cached dependencies**: Try `uv sync --refresh`
4. **Different OS**: Test in container or CI
5. **Environment variables**: Check with `env | grep UV`

---

## Prevention Tips

### Before Migration

- [ ] Ensure clean git state
- [ ] Run all tests and ensure they pass
- [ ] Document current version
- [ ] Backup (git tag current state)
- [ ] Read this entire guide

### During Migration

- [ ] Test each commit independently
- [ ] Run `uv sync` after dependency changes
- [ ] Verify `uv build` succeeds
- [ ] Check workflows locally with act (if possible)
- [ ] Keep changes minimal and focused

### After Migration

- [ ] Test on Test PyPI first (always)
- [ ] Verify installation in clean environment
- [ ] Check all CI workflows pass
- [ ] Update documentation
- [ ] Communicate changes to team

---

## Emergency Rollback

If migration fails catastrophically:

```bash
# 1. Don't panic - old setup.py still exists in git history

# 2. Revert all commits
git reset --hard <commit-before-migration>

# 3. Or create revert commit
git revert <migration-commit-range>

# 4. Force push if needed (feature branch only!)
git push origin branch-name --force

# 5. Investigate issue, fix, try again
```

**Note**: This is why we test on Test PyPI first!
