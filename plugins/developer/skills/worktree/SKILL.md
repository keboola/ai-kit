---
name: worktree
description: Create and manage git worktrees for parallel development. Use when user asks to create a worktree, work in parallel on multiple branches, set up isolated development environments, or clean up stale worktrees. Triggers on phrases like "create worktree", "new worktree", "worktree for branch", "/worktree", "clean worktrees", "stale worktrees".
---

# Git Worktree Management

Create worktrees in `<repo-parent>/worktrees/<repo-name>/<branch-name>`.

`SKILL_DIR` = directory containing this SKILL.md

## Creating a Worktree

```bash
"$SKILL_DIR/scripts/create-worktree.sh" <branch-name> [base-branch]
```

- Creates worktree for existing branch, or auto-creates from `origin/main` if branch doesn't exist
- Runs `bin/worktree-init.sh` if present (see below)

## Custom Initialization

Create `bin/worktree-init.sh` in your repo to customize worktree setup:

```bash
#!/usr/bin/env bash
# bin/worktree-init.sh - runs in new worktree, $1 = source repo root
SOURCE_REPO="$1"

# Example: copy env files
cp "$SOURCE_REPO/.env" ./.env

# Example: install dependencies
yarn install
```

The script runs inside the new worktree directory with `$1` set to the source repo root.

## After Creating a Worktree

Always check for stale worktrees and offer to clean them up:

```bash
"$SKILL_DIR/scripts/detect-stale-worktrees.sh"
```

If stale worktrees are found, ask user if they want to remove them. For each one they confirm:

```bash
"$SKILL_DIR/scripts/purge-worktree.sh" "<worktree-path>"
```

## Scripts

### create-worktree.sh

```bash
"$SKILL_DIR/scripts/create-worktree.sh" feature/my-branch           # Existing or new branch from origin/main
"$SKILL_DIR/scripts/create-worktree.sh" feature/new-feature develop # New branch from specific base
```

### detect-stale-worktrees.sh

Finds worktrees whose branches no longer exist on remote (merged/deleted PRs).

```bash
"$SKILL_DIR/scripts/detect-stale-worktrees.sh"          # Human-readable output
"$SKILL_DIR/scripts/detect-stale-worktrees.sh" --quiet  # Just paths (for scripting)
```

Exit code 0 = stale worktrees found, 1 = none found.

### purge-worktree.sh

Removes worktree and deletes local branch.

```bash
"$SKILL_DIR/scripts/purge-worktree.sh" "/path/to/worktree"
"$SKILL_DIR/scripts/purge-worktree.sh" "/path/to/worktree" --keep-branch  # Keep local branch
```

## Other Commands

```bash
git worktree list   # List all worktrees
git worktree prune  # Clean up stale worktree refs (different from stale branches)
```
