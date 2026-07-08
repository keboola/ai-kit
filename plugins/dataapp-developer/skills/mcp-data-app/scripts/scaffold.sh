#!/usr/bin/env bash
# Scaffold an MCP-server Keboola data app from the bundled template.
#
# Run from your PROJECT ROOT (not the skill dir):
#   bash <skill>/scripts/scaffold.sh [--force] [TARGET_DIR]
#
# TARGET_DIR defaults to ./mcp-data-app. Copies the template tree, makes
# setup.sh executable, and prints next steps. Refuses to clobber a non-empty
# target unless --force is given.
set -Eeuo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_DIR="$SKILL_DIR/template"

FORCE=0
TARGET=""
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -*) echo "Unknown option: $arg" >&2; exit 2 ;;
    *) TARGET="$arg" ;;
  esac
done
TARGET="${TARGET:-./mcp-data-app}"

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "ERROR: template dir not found at $TEMPLATE_DIR" >&2
  exit 1
fi

if [[ -d "$TARGET" && -n "$(ls -A "$TARGET" 2>/dev/null)" && "$FORCE" -ne 1 ]]; then
  echo "ERROR: target '$TARGET' exists and is not empty. Use --force to overwrite." >&2
  exit 1
fi

mkdir -p "$TARGET"
cp -R "$TEMPLATE_DIR"/. "$TARGET"/
chmod +x "$TARGET/keboola-config/setup.sh"

echo "Scaffolded MCP data app into: $TARGET"
echo
echo "Next steps:"
echo "  1. Wrapping a non-Keboola MCP server? Edit the swap points in server.py"
echo "     and pyproject.toml (see reference/adapting-to-any-server.md)."
echo "  2. Set data-app secrets: #KBC_STORAGE_API_URL, #KBC_STORAGE_TOKEN,"
echo "     #MCP_API_KEY (openssl rand -hex 32); set #MCP_PUBLIC_URL after first deploy."
echo "  3. Commit + push to the app's git repo, then deploy (see reference/deploy.md)."
