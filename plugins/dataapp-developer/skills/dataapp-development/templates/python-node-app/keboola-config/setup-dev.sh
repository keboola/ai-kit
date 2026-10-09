#!/bin/bash
set -Eeuo pipefail
cd /app

# Dev: Python and Node deps install in parallel; Vite serves the client unbuilt.
export NPM_CONFIG_UPDATE_NOTIFIER=false
# A bare `wait` returns 0 even when a job failed, so wait on each PID.
(cd backend && uv sync) & uv_pid=$!
npm install --prefer-offline --no-audit --no-fund & npm_pid=$!
wait "$uv_pid"
wait "$npm_pid"

echo "DEV setup done"
