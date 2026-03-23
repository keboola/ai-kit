#!/bin/bash
set -Eeuo pipefail

# Install Python dependencies only.
# Next.js is pre-built and committed — no npm build at startup.
cd /app/backend && uv sync
