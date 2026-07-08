#!/bin/bash
# Dependency install for the Keboola data app. Run once at container startup
# by the Keboola data app runtime — Supervisord then starts server.py.
set -Eeuo pipefail

cd /app
uv sync
