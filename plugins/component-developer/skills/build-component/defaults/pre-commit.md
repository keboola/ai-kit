# Default: `.pre-commit-config.yaml`

> **Sync note:** Tracks `cookiecutter-python-component`. Update this file when the template changes.

## Default

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.9.10
    hooks:
      - id: ruff
      - id: ruff-format
```

## What not to change

- Keep both `ruff` and `ruff-format` hooks. These enforce the same linting and formatting that CI runs — catching issues locally before push.
- Do not add unrelated hooks without a specific reason.

## When to deviate

- Update `rev` when upgrading the `ruff` version in `pyproject.toml`. The pre-commit hook version and the `ruff` dev dependency should stay in sync.
