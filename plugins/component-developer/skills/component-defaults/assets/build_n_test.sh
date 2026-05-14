#!/bin/sh
# Sync note: tracks cookiecutter-python-component — update when template changes
# Do not remove set -e. ruff check runs before pytest intentionally — lint failures block tests.
# Deviate: add ruff format --check to enforce formatting; add pytest flags as needed.
set -e

ruff check
python -m pytest tests/ --tb=short -q
