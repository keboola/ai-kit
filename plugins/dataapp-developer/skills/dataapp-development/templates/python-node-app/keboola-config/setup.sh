#!/bin/bash
set -Eeuo pipefail
cd /app

# Prod: Python and Node deps install in parallel, then Vite builds the client.
export NPM_CONFIG_UPDATE_NOTIFIER=false
# A bare `wait` returns 0 even when a job failed, so wait on each PID.
(cd backend && uv sync) & uv_pid=$!
npm install --prefer-offline --no-audit --no-fund & npm_pid=$!
wait "$uv_pid"
wait "$npm_pid"
npm run build

echo "PROD setup done"
