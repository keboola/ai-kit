#!/bin/bash
set -Eeuo pipefail
cd /app

# Dependency install for prod mode — same flags as setup-dev.sh, same reasons.
export NPM_CONFIG_UPDATE_NOTIFIER=false
npm install --prefer-offline --no-audit --no-fund
npm run build

echo "PROD setup done"
