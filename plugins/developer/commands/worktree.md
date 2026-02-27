---
name: worktree
description: Manage git worktrees using git-wt. Usage - /worktree add <branch> [source], /worktree rm [branch], /worktree ls, /worktree help
allowed-tools: Bash, Read, Write
---

# Git Worktree Management

Manage git worktrees using the [git-wt](https://github.com/vojtabiberle/git-wt) script, fetched from upstream.

## Instructions

1. Validate we are inside a git repository:
   ```bash
   git rev-parse --is-inside-work-tree
   ```

2. Fetch or update the git-wt script. The setup script is located at:
   ```
   <plugin-dir>/skills/git-worktree/scripts/ensure-git-wt.sh
   ```
   Run it to clone/pull the repo and get the executable path:
   ```bash
   GIT_WT="$("$SKILL_DIR/scripts/ensure-git-wt.sh")"
   ```
   Where `$SKILL_DIR` is the `skills/git-worktree` directory within this plugin.

3. Parse the user's arguments from `$ARGUMENTS`:
   - `add <branch> [source]` — create a worktree
   - `rm [branch]` — remove a worktree
   - `ls` — list worktrees
   - `help` — show help

4. Run the git-wt script with `--non-interactive` flag to avoid interactive prompts:
   ```bash
   "$GIT_WT" --non-interactive $ARGUMENTS
   ```

5. Report the result to the user. For `add`, highlight the worktree path (last line of output).
