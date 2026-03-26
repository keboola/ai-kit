# Troubleshooting Guide

Common issues during migration to uv for Keboola components.

---

## Docker Build Issues

### uv.lock not found

**Error**: `COPY uv.lock .` fails during `docker build`

**Fix**: Generate the lock file locally first:
```bash
uv sync --all-groups
git add uv.lock
```

---

### Permission error on uv sync

**Error**: `Permission denied` when writing to `/usr/local/`

**Fix**: `ENV UV_PROJECT_ENVIRONMENT="/usr/local/"` must appear **before** `RUN uv sync` in the Dockerfile:
```dockerfile
ENV UV_PROJECT_ENVIRONMENT="/usr/local/"
RUN uv sync --all-groups --frozen
```

---

### Module not found at runtime

**Error**: `ModuleNotFoundError` when running the component

**Cause**: Dependencies not installed, or wrong `UV_PROJECT_ENVIRONMENT`.

**Fix**:
```bash
# Verify installed packages
docker run test-component python -c "import keboola.component"

# Or rebuild fresh
docker build --no-cache -t test-component .
```

---

## Dependency Issues

### Dependency resolution failed

**Error**: `No solution found when resolving dependencies`

**Fix**:
1. Check for conflicting constraints in `pyproject.toml`
2. Try without lock: `uv sync --no-lock`
3. Upgrade a dep: `uv add package --upgrade`

---

### uv.lock out of sync

**Error**: `The lockfile needs to be updated, but --frozen was provided`

**Fix**:
```bash
uv sync --all-groups
git add uv.lock
git commit -m "update uv.lock"
```

---

## Ruff Issues

### Many violations on first run

**Status**: Expected — ruff is more comprehensive than flake8.

**Fix**: Let ruff auto-fix what it can, then fix the rest manually:
```bash
ruff format .
ruff check --fix .
```

---

### Large diffs in test files (CRLF)

**Symptom**: Test files show hundreds of changed lines but code is unchanged.

**Cause**: CRLF → LF normalisation by ruff format.

**Status**: Expected cleanup. Verify with:
```bash
git diff --ignore-all-space -- tests/file.py  # Should show minimal real changes
```

---

## CI Issues

### Workflow doesn't trigger on push

**Check**:
- `branches-ignore: [main]` syntax is correct
- Workflow file is in `.github/workflows/`
- YAML syntax is valid: `python -c "import yaml; yaml.safe_load(open('.github/workflows/push.yml'))"`

---

### ruff check fails in Docker

**Fix**: Run `ruff check .` locally and fix before pushing:
```bash
ruff format .
ruff check --fix .
```

---

## General Debugging

```bash
# Verbose uv output
uv sync -vv

# Check what's installed
uv pip list

# Validate pyproject.toml syntax
python -c "import tomllib; tomllib.load(open('pyproject.toml', 'rb'))"

# Clean rebuild
rm -rf uv.lock
uv sync --all-groups
docker build --no-cache -t test-component .
```
