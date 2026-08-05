#!/bin/bash
set -Eeuo pipefail
cd /app && npm install --omit=dev
