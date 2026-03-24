# Default: `.github/workflows/push.yml`

> **Sync note:** Tracks `cookiecutter-python-component`. Update this file when the template changes.

The CI/CD pipeline is almost entirely static. **Do not modify job definitions, steps, or logic.** The only values you configure are in the `env:` block at the top.

## What to configure

```yaml
env:
  KBC_DEVELOPERPORTAL_APP: "vendor.component-id"   # full component ID from Developer Portal
  KBC_DEVELOPERPORTAL_VENDOR: "vendor"              # your vendor name
  KBC_TEST_PROJECT_CONFIGS: ""                      # space-separated config IDs for KBC integration tests (optional)
```

Everything else — job definitions, steps, action versions, artifact handling, deploy conditions — is standard and must not be changed.

## How the pipeline works

1. **Runs on**: all pushes except to `main` without a tag; and all tags.
2. **`build`**: builds the Docker image and uploads it as a GitHub Actions artifact.
3. **`tests`**: downloads the artifact, runs `ruff check` and `pytest` inside the container.
4. **`tests-kbc`**: runs configs listed in `KBC_TEST_PROJECT_CONFIGS` against a real Keboola project. Skipped if the variable is empty or `KBC_STORAGE_TOKEN` is not set.
5. **`push`**: pushes the image to ECR.
6. **`deploy`**: sets the production tag in Developer Portal. Only runs when all three conditions are true: push is a tag, tag matches `X.Y.Z`, branch is the default branch (`main`).
7. **`update_developer_portal_properties`**: syncs `component_config/` metadata to Developer Portal on every deploy.

## When to deviate

Almost never. Legitimate exceptions:

- **Multiple component IDs in one repo** (monorepo): add additional `KBC_DEVELOPERPORTAL_APP_*` env vars and extra push/deploy steps. See `component-meta` for an example.
- **Custom test setup**: add environment variables to the `tests` job if your tests require secrets (e.g., `KBC_STORAGE_TOKEN` for integration tests that don't use `tests-kbc`).
