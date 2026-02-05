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

# Copy environment files if they exist
echo "Copying environment files..."
[ -f "$REPO_ROOT/apps/kai-assistant-backend/.env.local" ] && \
    cp "$REPO_ROOT/apps/kai-assistant-backend/.env.local" "$WORKTREE_PATH/apps/kai-assistant-backend/.env.local"
[ -f "$REPO_ROOT/apps/kbc-ui/.env" ] && \
    cp "$REPO_ROOT/apps/kbc-ui/.env" "$WORKTREE_PATH/apps/kbc-ui/.env"

# Install dependencies
echo "Installing dependencies..."
cd "$WORKTREE_PATH" && yarn install

echo ""
echo "Worktree created successfully at: $WORKTREE_PATH"
echo "To start working: cd $WORKTREE_PATH"
