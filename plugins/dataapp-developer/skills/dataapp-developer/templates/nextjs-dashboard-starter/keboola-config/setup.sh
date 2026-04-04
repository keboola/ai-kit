#!/bin/bash
set -Eeuo pipefail

# Install Python backend dependencies only.
# Next.js frontend is pre-built (standalone) and committed to git.
cd /app/backend && uv sync
