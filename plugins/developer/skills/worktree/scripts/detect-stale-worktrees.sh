#!/usr/bin/env bash
set -euo pipefail

# Detect worktrees without corresponding remote branches
# Usage: ./detect-stale-worktrees.sh [--quiet]
#
# Returns exit code 0 if stale worktrees found, 1 if none found
# With --quiet, only outputs paths of stale worktrees (for scripting)

QUIET="${1:-}"
REPO_ROOT=$(git rev-parse --show-toplevel)

# Fetch latest remote refs
git fetch --prune origin 2>/dev/null || true

stale_count=0
stale_worktrees=()

# Parse worktree list
while IFS= read -r line; do
    # Extract path and branch info
    path=$(echo "$line" | awk '{print $1}')
    branch_info=$(echo "$line" | grep -oP '\[.*\]' || echo "")

    # Skip if no branch (detached HEAD)
    if [[ -z "$branch_info" || "$branch_info" == *"detached"* ]]; then
        continue
    fi

    # Extract branch name from [branch]
    branch=$(echo "$branch_info" | sed 's/\[\(.*\)\]/\1/')

    # Skip main repo directory
    if [[ "$path" == "$REPO_ROOT" ]]; then
        continue
    fi

    # Check if remote branch exists
    if ! git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
        stale_worktrees+=("$path|$branch")
        stale_count=$((stale_count + 1))
    fi
done < <(git worktree list)

# Output results
if [[ $stale_count -eq 0 ]]; then
    [[ "$QUIET" != "--quiet" ]] && echo "No stale worktrees found."
    exit 1
fi

if [[ "$QUIET" == "--quiet" ]]; then
    for entry in "${stale_worktrees[@]}"; do
        echo "${entry%%|*}"
    done
else
    echo "Found $stale_count stale worktree(s) without remote branches:"
    echo ""
    for entry in "${stale_worktrees[@]}"; do
        path="${entry%%|*}"
        branch="${entry##*|}"
        echo "  Path:   $path"
        echo "  Branch: $branch"
        echo ""
    done
fi

exit 0
