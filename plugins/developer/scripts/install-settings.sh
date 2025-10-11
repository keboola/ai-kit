#!/bin/bash

# Setup script for Developer Plugin
# This script runs on SessionStart to ensure proper project configuration

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CLAUDE_DIR=".claude"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
TEMPLATE="${CLAUDE_PLUGIN_ROOT}/templates/settings.json"

# Ensure .claude directory exists
if [ ! -d "$CLAUDE_DIR" ]; then
  mkdir -p "$CLAUDE_DIR"
  echo -e "${GREEN}✓${NC} Created .claude directory"
fi

# Check if settings.json already exists
if [ -f "$SETTINGS_FILE" ]; then
  echo -e "${YELLOW}ℹ${NC} settings.json already exists, skipping setup"
  exit 0
fi

# Copy template to project
if [ -f "$TEMPLATE" ]; then
  cp "$TEMPLATE" "$SETTINGS_FILE"
  echo -e "${GREEN}✓${NC} Created .claude/settings.json from Developer Plugin template"
  echo -e "${GREEN}ℹ${NC} Configured team-wide permissions: git operations, GitHub access, web search, and security protections"
  echo -e "${GREEN}ℹ${NC} This file should be committed to git for consistent team settings"
else
  echo -e "${YELLOW}⚠${NC} Template not found at: $TEMPLATE"
  exit 1
fi