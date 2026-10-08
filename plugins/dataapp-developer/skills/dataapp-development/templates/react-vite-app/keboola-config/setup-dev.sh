#!/bin/bash
set -Eeuo pipefail
cd /app

# Dependency install for dev mode.
#
# - `npm install`, never `npm ci`: the agent adds deps by editing `package.json`
#   alone, and `npm ci` exits EUSAGE on a lockfile it does not match — under
#   `set -Eeuo pipefail` that kills the container boot.
# - `package-lock.json` is committed, so npm skips registry resolution: ~11.8 s
#   cold without it, ~2.3 s with it, ~0.25 s on a warm re-install.
# - `--prefer-offline` pays off on the re-install the git-watcher triggers after
#   a dependency push, when `~/.npm` is already warm.
export NPM_CONFIG_UPDATE_NOTIFIER=false
npm install --prefer-offline --no-audit --no-fund

echo "DEV setup done"
