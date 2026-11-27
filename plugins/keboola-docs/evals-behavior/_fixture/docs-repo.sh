#!/bin/bash
# Shared scaffold: a small connection-docs repo in the current (empty) eval workspace, committed on
# `main`, then a feature branch checked out. Sources the fixture from the plugin's own test fixture.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIX="$HERE/../../skills/docs-diataxis-check/scripts/fixtures/repo"
cp -R "$FIX/." .
rm -rf dist
mkdir -p public/guide
export GIT_AUTHOR_NAME=eval GIT_AUTHOR_EMAIL=eval@example.com GIT_COMMITTER_NAME=eval GIT_COMMITTER_EMAIL=eval@example.com
git init -q -b main
git add -A
git commit -q -m "fixture"
git checkout -q -b docs-eval
