#!/usr/bin/env bash
set -euo pipefail

# Configuration - set these before running
BRANCH_NAME="${1:?Usage: $0 <branch-name> [base-branch]}"
BASE_BRANCH="${2:-}"  # Optional: base branch for creating new branches

# Compute paths
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
REPO_PARENT=$(dirname "$REPO_ROOT")
WORKTREE_BASE="$REPO_PARENT/worktrees/$REPO_NAME"
WORKTREE_PATH="$WORKTREE_BASE/$BRANCH_NAME"

# Check if worktree already exists
if [ -d "$WORKTREE_PATH" ]; then
    echo "Error: Worktree already exists at $WORKTREE_PATH"
    exit 1
fi

# Create worktree base directory
mkdir -p "$WORKTREE_BASE"

# Check if branch exists (locally or remotely)
branch_exists() {
    git show-ref --verify --quiet "refs/heads/$1" 2>/dev/null || \
    git show-ref --verify --quiet "refs/remotes/origin/$1" 2>/dev/null
}

# Create the worktree
if [ -n "$BASE_BRANCH" ]; then
    echo "Creating new branch '$BRANCH_NAME' from '$BASE_BRANCH'..."
    git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_BRANCH"
elif branch_exists "$BRANCH_NAME"; then
    echo "Creating worktree for existing branch '$BRANCH_NAME'..."
    git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
else
    echo "Branch '$BRANCH_NAME' not found. Fetching origin/main and creating new branch..."
    git fetch origin main
    git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" origin/main
fi

# Run repo-specific initialization if available
INIT_SCRIPT="$REPO_ROOT/bin/worktree-init.sh"
if [ -x "$INIT_SCRIPT" ]; then
    echo "Running worktree initialization script..."
    cd "$WORKTREE_PATH" && "$INIT_SCRIPT" "$REPO_ROOT"
else
    echo ""
    echo "Tip: Create bin/worktree-init.sh (chmod +x) to customize worktree setup."
    echo "     It runs in the new worktree with \$1=source_repo_root"
fi

echo ""
echo "Worktree created successfully at: $WORKTREE_PATH"
echo "To start working: cd $WORKTREE_PATH"
