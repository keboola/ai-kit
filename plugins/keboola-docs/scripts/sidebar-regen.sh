#!/bin/bash
# PostToolUse (Write|Edit) — regenerate src/sidebar.mjs whenever _data/navigation.yml is edited.
# AGENTS.md: the sidebar is generated; src/sidebar.mjs must never be hand-edited.
IN=$(cat)
f=$(printf '%s' "$IN" | jq -r '.tool_input.file_path // empty')

case "$f" in
  */_data/navigation.yml) ;;
  *) exit 0 ;;
esac

# the checkout the edited file lives in (not the session directory: a worktree elsewhere was skipped)
root="$(cd "$(dirname "$f")/.." 2>/dev/null && pwd)"
[ -f "$root/scripts/convert-nav.mjs" ] || root="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$root" 2>/dev/null || exit 0

if npm run gen:sidebar >/dev/null 2>&1; then
  printf '%s' '{"systemMessage":"hook: src/sidebar.mjs regenerated from _data/navigation.yml","hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Hook auto-ran npm run gen:sidebar - src/sidebar.mjs is already regenerated; do not run it again."}}'
else
  printf '%s' '{"systemMessage":"hook: npm run gen:sidebar FAILED - run it manually"}'
fi
