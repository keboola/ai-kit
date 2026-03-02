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

2. Fetch or update the git-wt script directly from upstream:
   ```bash
   GIT_WT_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/git-wt"
   if [[ -d "$GIT_WT_DIR/.git" ]]; then
       git -C "$GIT_WT_DIR" fetch --quiet 2>/dev/null || true
   else
       git clone --quiet https://github.com/vojtabiberle/git-wt.git "$GIT_WT_DIR"
   fi
   GIT_WT="$GIT_WT_DIR/git-wt"
   ```

3. Parse the user's arguments from `$ARGUMENTS`. Only accept known subcommands:
   - `add <branch> [source]` — create a worktree
   - `rm [branch]` — remove a worktree
   - `ls` — list worktrees
   - `help` — show help

4. Run the git-wt script with `--non-interactive` flag, validating and safely passing arguments:
   ```bash
   # Parse arguments into positional parameters
   set -- $ARGUMENTS
   subcommand="$1"
   shift || true

   case "$subcommand" in
       add|rm|ls|help)
           "$GIT_WT" --non-interactive "$subcommand" "$@"
           ;;
       *)
           echo "Error: unknown subcommand: $subcommand" >&2
           echo "Usage: /worktree <add|rm|ls|help> [args...]" >&2
           ;;
   esac
   ```

5. Report the result to the user. For `add`, highlight the worktree path (last line of output).
