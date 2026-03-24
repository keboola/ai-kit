# Default: `scripts/build_n_test.sh`

> **Sync note:** Tracks `cookiecutter-python-component`. Update this file when the template changes.

## Default

```sh
#!/bin/sh
set -e

ruff check
python -m pytest tests/ --tb=short -q
```

## What not to change

- `set -e`: exits immediately on any error. Never remove this — without it, a failing lint check would not block the test run.
- `ruff check` runs before tests. Linting failures block test execution intentionally — broken code style should not proceed to testing.

## When to deviate

- Add `ruff format --check` if you want CI to enforce formatting (currently formatting is linted but not enforced by default).
- Add pytest flags (e.g., `-v`, `-m "not slow"`) for specific test configurations.
- Add `python -m pytest tests/functional/` as a separate step if functional and unit tests need different configuration.
