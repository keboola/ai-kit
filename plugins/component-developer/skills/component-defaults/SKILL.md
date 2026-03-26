---
name: component-defaults
description: Load canonical default files for Keboola Python components into context. Invoke this to get the standard templates for Dockerfile, push.yml, build_n_test.sh, docker-compose.yml, pre-commit-config.yaml, and pyproject.toml.
tools: Read
model: haiku
color: purple
---

# Component Defaults

Read and return the contents of all canonical default files for Keboola components.

Your base directory is injected as `Base directory for this skill: <path>` in your system context.

Read each of the following files from `<base_dir>/assets/` and return their full contents, clearly labeled by filename:

- `assets/Dockerfile`
- `assets/push.yml`
- `assets/build_n_test.sh`
- `assets/docker-compose.yml`
- `assets/pre-commit-config.yaml`
- `assets/pyproject.toml`
- `assets/config-schema.md`
- `assets/test_functional.py`
