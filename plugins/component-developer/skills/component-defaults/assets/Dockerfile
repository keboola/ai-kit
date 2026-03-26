# Sync note: tracks cookiecutter-python-component — update when template changes
# Do not change: base image (use slim not alpine), UV_PROJECT_ENVIRONMENT, python -u flag, uv sync --all-groups --frozen
# Deviate: uncomment build-essential for C/C++ deps; use multi-stage for large test suites
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
