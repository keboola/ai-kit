#!/usr/bin/env bash
set -euo pipefail

# Purge a worktree and optionally its local branch
# Usage: ./purge-worktree.sh <worktree-path> [--keep-branch]
#
# Options:
#   --keep-branch   Keep the local branch after removing the worktree

WORKTREE_PATH="${1:?Usage: $0 <worktree-path> [--keep-branch]}"
KEEP_BRANCH="${2:-}"

# Validate worktree exists
if ! git worktree list | grep -q "^$WORKTREE_PATH "; then
    echo "Error: '$WORKTREE_PATH' is not a valid worktree"
    exit 1
fi

# Get branch name from worktree
BRANCH_INFO=$(git worktree list | grep "^$WORKTREE_PATH " | grep -oP '\[.*\]' || echo "")
if [[ -z "$BRANCH_INFO" || "$BRANCH_INFO" == *"detached"* ]]; then
    BRANCH=""
else
    BRANCH=$(echo "$BRANCH_INFO" | sed 's/\[\(.*\)\]/\1/')
fi

echo "Removing worktree: $WORKTREE_PATH"
if [[ -n "$BRANCH" ]]; then
    echo "Associated branch: $BRANCH"
fi

# Remove the worktree
git worktree remove "$WORKTREE_PATH" --force

# Delete the local branch if requested and it exists
if [[ -n "$BRANCH" && "$KEEP_BRANCH" != "--keep-branch" ]]; then
    if git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
        echo "Deleting local branch: $BRANCH"
        git branch -D "$BRANCH"
    fi
fi

echo ""
echo "Worktree purged successfully."
