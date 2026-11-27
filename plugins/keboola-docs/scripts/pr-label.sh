#!/bin/bash
# PostToolUse (Bash): after `gh pr create` opens a keboola/connection-docs PR, give it its labels
# with the docs-pr-label skill (keboola-docs plugin, skills/docs-pr-label). Adds existing labels only,
# never creates or removes one, skips PRs by other authors. Silent for every other command.
IN=$(cat)
cmd=$(printf '%s' "$IN" | jq -r '.tool_input.command // empty')
case "$cmd" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac
url=$(printf '%s' "$IN" | jq -r '[.tool_response | .. | strings] | join("\n")' | grep -oE 'https://github\.com/keboola/connection-docs/pull/[0-9]+' | tail -1)
[ -n "$url" ] || exit 0
[ -n "$CLAUDE_PLUGIN_ROOT" ] || exit 0
out=$(node "$CLAUDE_PLUGIN_ROOT/skills/docs-pr-label/scripts/label-pr.mjs" --apply "$url" 2>&1 | tail -3)
msg="PR labels (docs-pr-label): ${out}"
jq -n --arg m "$msg" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$m}}'
exit 0
