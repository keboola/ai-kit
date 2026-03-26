# Migration Guide: requirements.txt → uv

Detailed steps for migrating a Keboola component.

---

## Pre-Migration Checklist

```bash
git status        # Must be clean
git checkout -b feature/migrate-to-uv
cat requirements.txt
grep "FROM python:" Dockerfile
```

---

## Commit 1: pyproject.toml 📦

1. Create `pyproject.toml` (see structure in `migrate-to-uv/SKILL.md` Commit 1 section)
2. Convert dependencies: `package==x.y.z` → `"package>=x.y.z"` (dot → dash, == → >=)
3. Split test-only deps (pytest, mock, freezegun, etc.) into `[dependency-groups] dev`
4. Set `requires-python = "~=3.13.0"` to match Dockerfile base image
5. Set `target-version = "py313"` in ruff config

**Delete old files:**
```bash
git rm requirements.txt
git rm -f .flake8 flake8.cfg 2>/dev/null || true
git rm -f scripts/build_n_run.ps1 scripts/run.bat scripts/run_kbc_tests.ps1 2>/dev/null || true
git rm -f scripts/update_dev_portal_properties.sh 2>/dev/null || true
git rm -rf docs/imgs/ 2>/dev/null || true
git rm -f component_config/configuration_description.md component_config/stack_parameters.json 2>/dev/null || true
```

**Populate `component_config/` GitHub URLs** if empty: `documentationUrl.md`, `licenseUrl.md`, `sourceCodeUrl.md`

**Update `.gitignore`** — add if missing: `*.egg-info/`, `.venv/`, `.DS_Store`, `/data` (replace bare `data/`)

```bash
git add pyproject.toml .gitignore
git commit -m "migrate to pyproject.toml 📦"
```

---

## Commit 2: uv 💜

1. Update `Dockerfile` — see SKILL.md Phase 3
2. Update `scripts/build_n_test.sh` — replace flake8 with ruff, ensure `set -e`
3. Update `tests/__init__.py` — use pathlib pattern
4. Update `.github/workflows/push.yml`:
   - Change trigger to `branches-ignore: [main]`
   - Improve tag handling (branch builds get run number suffix)
   - Replace flake8 step with `ruff check .`
5. Generate lock file: `uv sync --all-groups`

```bash
git add Dockerfile scripts/ tests/ .github/workflows/ uv.lock
git commit -m "uv 💜"
```

---

## Commit 3: Ruff baseline 🎨 (if needed)

```bash
ruff format .
ruff check --fix .
# Only commit if there are changes
git add src/ tests/
git commit -m "ruff linting baseline 🎨"
```

---

## Post-Migration Checklist

- [ ] `docker build -t test-component .` succeeds
- [ ] `docker run test-component ruff check .` passes
- [ ] `docker run test-component python -m pytest tests/ -v` passes
- [ ] CI workflow green on push

---

## Common Issues

**`uv.lock` not found in Docker**: Run `uv sync --all-groups` locally first.

**Permission error on `uv sync`**: Check `ENV UV_PROJECT_ENVIRONMENT="/usr/local/"` is before `RUN uv sync`.

**CRLF diffs in test files**: Expected — ruff format normalises line endings. Actual code changes are minimal.
