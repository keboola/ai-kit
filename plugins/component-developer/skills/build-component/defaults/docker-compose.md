# Default: `docker-compose.yml`

> **Sync note:** Tracks `cookiecutter-python-component`. Update this file when the template changes.

## Default

```yaml
version: "2"
services:
  dev:
    build: .
    volumes:
      - ./:/code
      - ./data:/data
    environment:
      - KBC_DATADIR=./data
  test:
    build: .
    volumes:
      - ./:/code
      - ./data:/data
    environment:
      - KBC_DATADIR=./data
    command:
      - /bin/sh
      - /code/scripts/build_n_test.sh
```

## What not to change

- `KBC_DATADIR=./data` must always point to the `data/` directory in the repo root. This is how the component finds its input/output files during local development.
- Do not add services, volumes, or environment variables beyond what is here unless the component has a genuine local dependency (e.g., a local database for integration tests).

## When to deviate

- Add a `db:` service if the component needs a local database for integration testing.
- Add environment variables for secrets needed in local development (but never commit secrets into the file — use `.env` files and `.gitignore`).
