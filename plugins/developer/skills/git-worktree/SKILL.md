---
name: git-worktree
description: Manage git worktrees using the git-wt helper script. Use when user asks to create, list, remove, or navigate worktrees, work in parallel on multiple branches, or set up isolated development environments. Triggers on phrases like "create worktree", "new worktree", "worktree for branch", "/worktree", "wt add", "wt rm", "wt ls".
---

# Git Worktree Management (git-wt)

Manage git worktrees using the [git-wt](https://github.com/vojtabiberle/git-wt) helper script, fetched from upstream on each use.

## Working Directory Context

**CRITICAL: All commands MUST be run from the user's project root directory, NOT from the skill directory.**

- The user will be in THEIR project directory when invoking this skill
- The setup script clones/pulls git-wt to `~/.local/share/git-wt` and prints the executable path
- **DO NOT `cd` into the skill directory**

`SKILL_DIR` = directory containing this SKILL.md (automatically resolved by Claude)

## Setup (run once per session)

Before using git-wt, fetch or update it:

```bash
GIT_WT="$("$SKILL_DIR/scripts/ensure-git-wt.sh")"
```

This clones `vojtabiberle/git-wt` to `~/.local/share/git-wt` (or pulls latest if already cloned). The script prints the path to the `git-wt` executable on stdout.

All subsequent commands use `$GIT_WT`. Always pass `--non-interactive` to suppress prompts.

## Commands

### Create a Worktree

```bash
"$GIT_WT" --non-interactive add <branch> [source-branch]
```

- Creates a worktree for `<branch>`, optionally from `[source-branch]`
- If the branch exists locally, checks it out into a new worktree
- If it exists only on `origin`, uses the remote branch (auto-confirmed with `--non-interactive`)
- If it doesn't exist anywhere, creates a new branch from HEAD or `[source-branch]`
- Runs any configured setup commands from `worktree.conf` / `worktree.conf.local`

**Examples:**
```bash
# Create worktree for existing branch
"$GIT_WT" --non-interactive add feature/login

# Create worktree for new branch from master
"$GIT_WT" --non-interactive add feature/new-feature master

# Create worktree for new branch from specific base
"$GIT_WT" --non-interactive add bugfix/fix-123 release/v2
```

### List Worktrees

```bash
"$GIT_WT" ls
```

Lists all worktrees (`git worktree list`).

### Remove a Worktree

```bash
"$GIT_WT" --non-interactive rm <branch>
"$GIT_WT" --non-interactive rm          # Removes current worktree (auto-detected)
"$GIT_WT" --non-interactive rm --force <branch>  # Force removal
```

- Runs any configured teardown commands before removal
- Without args, removes the current worktree if in one

### Show Worktree Path

```bash
"$GIT_WT" cd <branch>
```

Prints the filesystem path of the worktree for `<branch>`. Useful for scripting.

### Initialize Configuration

```bash
"$GIT_WT" init
```

Interactively creates `worktree.conf.local` in the repo root.

### Help

```bash
"$GIT_WT" help
```

## Configuration

The script uses two shell-sourceable config files in each project's repo root:

**`worktree.conf`** (committed project defaults):
```bash
WORKTREE_DIR=".."
WORKTREE_PREFIX="myapp"
WORKTREE_SETUP=("./setup.sh")
WORKTREE_TEARDOWN=("./teardown.sh")
```

**`worktree.conf.local`** (personal overrides, gitignored):
```bash
WORKTREE_DIR="/home/me/worktrees"
WORKTREE_SETUP=("./setup.sh" "direnv allow")
WORKTREE_TEARDOWN=("docker compose down")
```

### Variables

| Variable | Default | Description |
|---|---|---|
| `WORKTREE_DIR` | `..` | Base directory for worktrees (relative to repo root) |
| `WORKTREE_PREFIX` | repo name | Prefix for worktree directory names |
| `WORKTREE_SETUP` | `()` | Commands to run after creating a worktree |
| `WORKTREE_TEARDOWN` | `()` | Commands to run before removing a worktree |

### Directory Naming

Format: `<base>/<prefix>-<sanitized-branch>`

Branch `feature/login` with prefix `myapp` and base `..`:
```
../myapp-feature-login
```

Sanitization: `/` becomes `-`, everything lowercased.

## Typical Workflow

1. **Fetch git-wt** (once per session):
   ```bash
   GIT_WT="$("$SKILL_DIR/scripts/ensure-git-wt.sh")"
   ```
2. **Create worktree** for a feature branch:
   ```bash
   "$GIT_WT" --non-interactive add feature/my-branch master
   ```
3. **Work in the worktree** directory (printed as the last line of output)
4. **List worktrees** to see all active ones:
   ```bash
   "$GIT_WT" ls
   ```
5. **Clean up** when done:
   ```bash
   "$GIT_WT" --non-interactive rm feature/my-branch
   ```

## Source

Fetched from [vojtabiberle/git-wt](https://github.com/vojtabiberle/git-wt) (MIT License).
