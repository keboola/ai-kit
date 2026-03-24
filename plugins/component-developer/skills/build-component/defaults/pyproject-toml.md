# Default: `pyproject.toml`

> **Sync note:** Tracks `cookiecutter-python-component`. Update this file when the template changes.

## Default

```toml
[project]
name = "your-component-name"
dynamic = ["version"]
readme = "README.md"
requires-python = "~=3.13.0"
dependencies = [
    "freezegun>=1.5.1",
    "keboola-component>=1.9.0",
    "keboola-http-client>=1.0.1",
    "keboola-utils>=1.1.0",
    "mock>=5.2.0",
    "pydantic>=2.11.7",
]

[dependency-groups]
dev = [
    "keboola.datadirtest>=2.0.0",
    "pytest>=9.0.2",
    "ruff>=0.15.2",
]

[tool.ruff]
line-length = 120
target-version = "py313"

[tool.ruff.lint]
extend-select = ["I", "UP"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

## What each default dependency does

| Package | Purpose | Remove when |
|---|---|---|
| `keboola-component` | Core SDK — `CommonInterface`, table definitions, state, manifests | Never |
| `keboola-http-client` | HTTP client with retries and auth helpers | Component has no external HTTP calls |
| `keboola-utils` | Shared utilities (date parsing, logging helpers) | Component genuinely doesn't use any of them |
| `pydantic` | Configuration model validation | You choose a different validation approach |
| `freezegun` | Freeze time in tests | No time-dependent logic |
| `mock` | Mock patching in tests | You use `unittest.mock` directly (they're equivalent) |

## When to add dependencies

Add a dependency only when the component explicitly needs it. Common additions:

- `requests>=2.32.0` — for direct HTTP calls without `keboola-http-client`
- `keboola-csvwriter>=1.0.1` — for high-performance CSV output
- `keboola-vcr>=0.2.0` — add to `[dependency-groups] dev` when using VCR tests
- `aiolimiter>=1.1.0` — async rate limiting
- `anthropic`, `openai`, etc. — third-party API SDKs as needed

## What not to change

- **Python version (`~=3.13.0`)**: do not downgrade without a concrete compatibility reason (e.g., a dependency that doesn't support 3.13 yet). Do not upgrade until the cookiecutter template does.
- **`ruff` line-length (120)**: Keboola standard. Do not change to 88 or any other value.
- **`extend-select = ["I"]`**: enables isort-compatible import sorting. Add `"UP"` if the codebase already uses it, but do not remove `"I"`.
- **`dynamic = ["version"]`**: version is injected by CI/CD from the git tag. Do not hardcode it.
