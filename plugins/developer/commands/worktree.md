---
name: worktree
description: Manage git worktrees using git-wt. Usage - /worktree add <branch> [source], /worktree rm [branch], /worktree ls, /worktree help
allowed-tools: Bash, Read, Write
---

# Git Worktree Management

Manage git worktrees using the bundled git-wt script.

## Instructions

1. Validate we are inside a git repository:
   ```bash
   git rev-parse --is-inside-work-tree
   ```

2. Determine the skill script path. The git-wt script is located at:
   ```
   <plugin-dir>/skills/git-worktree/scripts/git-wt
   ```
   Find it relative to this command file's plugin directory.

3. Parse the user's arguments from `$ARGUMENTS`:
   - `add <branch> [source]` — create a worktree
   - `rm [branch]` — remove a worktree
   - `ls` — list worktrees
   - `help` — show help

4. Run the git-wt script with `--non-interactive` flag to avoid interactive prompts:
   ```bash
   "$SKILL_DIR/scripts/git-wt" --non-interactive $ARGUMENTS
   ```
   Where `$SKILL_DIR` is the `skills/git-worktree` directory within this plugin.

5. Report the result to the user. For `add`, highlight the worktree path (last line of output).
