#!/bin/bash
set -Eeuo pipefail

cd /app/backend && uv sync &
cd /app/frontend && npm install --omit=dev &
wait
