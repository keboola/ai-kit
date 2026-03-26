# Component Migration Example

Real migration example: `keboola/component-tableau-extract-refresh-trigger`

---

## What Changed

### `pyproject.toml` (new file)

```toml
[project]
name = "component-tableau-extract-refresh-trigger"
dynamic = ["version"]
requires-python = "~=3.13.0"
dependencies = [
    "keboola-component>=1.9.0",
    "tableauserverclient>=0.32",
    "xmltodict>=0.13.0",
]

[dependency-groups]
dev = [
    "ruff>=0.15.0",
    "pytest>=9.0.2",
    "freezegun>=1.0.0",
    "mock>=5.2.0"
]

[tool.ruff]
line-length = 120
target-version = "py313"

[tool.ruff.lint]
extend-select = ["I", "UP"]
```

### `Dockerfile`

```dockerfile
# Before
FROM python:3.12-slim
ENV PYTHONIOENCODING utf-8
COPY . /code/
RUN pip install flake8
RUN pip install -r /code/requirements.txt
WORKDIR /code/
CMD ["python", "-u", "/code/src/component.py"]

# After
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /code/
COPY pyproject.toml .
COPY uv.lock .
ENV UV_PROJECT_ENVIRONMENT="/usr/local/"
RUN uv sync --all-groups --frozen
COPY src/ src/
COPY tests/ tests/
COPY scripts/ scripts/
COPY deploy.sh .
CMD ["python", "-u", "/code/src/component.py"]
```

### `.github/workflows/push.yml`

Key changes:
- `branches: [feature/*, bug/*, ...]` → `branches-ignore: [main]`
- Tag handling: branch builds now get `REF-$run_number` suffix
- `flake8 . --config=flake8.cfg` → `ruff check .`

### `scripts/build_n_test.sh`

```bash
# Before
#set -e
flake8 --config=flake8.cfg
python -m pytest tests/ -v

# After
set -e
ruff check .
python -m pytest tests/ -v
```

### `tests/__init__.py`

```python
# Before
import sys, os
sys.path.append(os.path.dirname(os.path.realpath(__file__)) + "/../src")

# After
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent / "src"))
```

### Files deleted

- `requirements.txt`
- `flake8.cfg`
- `scripts/build_n_run.ps1`, `scripts/run.bat`, `scripts/run_kbc_tests.ps1`
- `scripts/update_dev_portal_properties.sh`
- `docs/imgs/` (Bitbucket-era screenshots)
- `component_config/configuration_description.md` (Bitbucket-era, replaced by README)
- `component_config/stack_parameters.json` (empty placeholder)

---

## Dependency Conversion Reference

| requirements.txt | pyproject.toml |
|---|---|
| `keboola.component==1.4.4` | `"keboola-component>=1.4.4"` |
| `tableauserverclient==0.32` | `"tableauserverclient>=0.32"` |
| `mock` | `"mock>=5.2.0"` (in dev group) |
| `freezegun` | `"freezegun>=1.0.0"` (in dev group) |

Rules: dot → dash in package name, `==` → `>=`, test-only deps go in `[dependency-groups] dev`.
