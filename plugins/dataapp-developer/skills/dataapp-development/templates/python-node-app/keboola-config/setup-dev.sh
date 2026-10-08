#!/bin/bash
set -Eeuo pipefail
cd /app

# Dev: Python and Node deps install in parallel; Vite serves the client unbuilt.
export NPM_CONFIG_UPDATE_NOTIFIER=false
(cd backend && uv sync) &
npm install --prefer-offline --no-audit --no-fund &
wait

echo "DEV setup done"
