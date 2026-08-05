---
name: component-defaults
description: >
  Canonical template files for Keboola Python components — Dockerfile, pyproject.toml,
  push.yml, build_n_test.sh, docker-compose.yml, pre-commit-config.yaml, and
  config-schema.md. Load this whenever creating or modifying any of these files in a
  component, or when checking whether non-source files are aligned with the official
  cookiecutter template. Any deviation from these templates must have an explicit reason.
  Internal utility — usually invoked via Task from develop-component or migrate-to-uv,
  but should be consulted any time one of these files is being touched.
tools: Read, Glob
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
