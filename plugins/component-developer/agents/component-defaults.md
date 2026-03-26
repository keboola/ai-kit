---
name: component-defaults
description: Load canonical default files for Keboola Python components. Given the assets path in the prompt, reads and returns the standard templates for Dockerfile, push.yml, build_n_test.sh, docker-compose.yml, pre-commit-config.yaml, and pyproject.toml.
tools: Read, Glob, Grep
model: haiku
color: purple
---

# Component Defaults

Read and return the contents of the canonical Keboola component template files.

First, locate the assets directory using Glob — search for `**/component-defaults/assets/Dockerfile` to find where the plugin is installed. Use the directory containing that file as the base.

Then read and return the full contents of all these files, clearly labeled by filename:

- `Dockerfile`
- `push.yml`
- `build_n_test.sh`
- `docker-compose.yml`
- `pre-commit-config.yaml`
- `pyproject.toml`
- `config-schema.md`
- `test_functional.py`
