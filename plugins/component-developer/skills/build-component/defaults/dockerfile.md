# Default: `Dockerfile`

> **Sync note:** Tracks `cookiecutter-python-component`. Update this file when the template changes.

## Default

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

## What not to change

- **Base image (`python:3.13-slim`)**: use slim, not alpine. Alpine has libc compatibility issues with many Python packages compiled as C extensions.
- **`uv sync --all-groups --frozen`**: installs both production and dev dependencies using the locked versions from `uv.lock`. Never replace with `pip install`.
- **`python -u`**: disables output buffering so Keboola's log collector captures output in real time. Required.
- **`ENV UV_PROJECT_ENVIRONMENT="/usr/local/"`**: installs packages system-wide inside the container rather than into a virtualenv. Required for the bare `python` command to find installed packages.

## When to deviate

- **Uncomment `build-essential`** when a dependency requires C/C++ compilation (e.g., `psycopg2`, `numpy` on some platforms). This is the most common change needed.
- **Multi-stage builds** (separate `base`/`test`/`production` targets) reduce CI times by allowing the test stage to reuse the built base layer. Only add if build time is a real problem — it increases Dockerfile complexity.
