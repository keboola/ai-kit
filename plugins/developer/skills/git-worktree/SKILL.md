---
name: git-worktree
description: Manage git worktrees using the git-wt helper script. Use when user asks to create, list, remove, or navigate worktrees, work in parallel on multiple branches, or set up isolated development environments. Triggers on phrases like "create worktree", "new worktree", "worktree for branch", "/worktree", "wt add", "wt rm", "wt ls".
---

# Git Worktree Management (git-wt)

Manage git worktrees using the [git-wt](https://github.com/vojtabiberle/git-wt) helper script, bundled in this skill.

## Working Directory Context

**CRITICAL: All commands MUST be run from the user's project root directory, NOT from the skill directory.**

- The user will be in THEIR project directory when invoking this skill
- All script calls use `$SKILL_DIR/scripts/git-wt` as the executable
- The script auto-detects the repo root from the current directory
- **DO NOT `cd` into the skill directory**

`SKILL_DIR` = directory containing this SKILL.md (automatically resolved by Claude)

## Setup

The `git-wt` script is bundled in this skill. To use it, call it directly:

```bash
"$SKILL_DIR/scripts/git-wt" <command> [args...]
```

For non-interactive (CI/automated) use, pass `--non-interactive` or `--yes` to suppress prompts:

```bash
"$SKILL_DIR/scripts/git-wt" --non-interactive <command> [args...]
```

## Commands

### Create a Worktree

```bash
"$SKILL_DIR/scripts/git-wt" --non-interactive add <branch> [source-branch]
```

- Creates a worktree for `<branch>`, optionally from `[source-branch]`
- If the branch exists locally, checks it out into a new worktree
- If it exists only on `origin`, uses the remote branch (auto-confirmed with `--non-interactive`)
- If it doesn't exist anywhere, creates a new branch from HEAD or `[source-branch]`
- Runs any configured setup commands from `worktree.conf` / `worktree.conf.local`

**Examples:**
```bash
# Create worktree for existing branch
"$SKILL_DIR/scripts/git-wt" --non-interactive add feature/login

# Create worktree for new branch from master
"$SKILL_DIR/scripts/git-wt" --non-interactive add feature/new-feature master

# Create worktree for new branch from specific base
"$SKILL_DIR/scripts/git-wt" --non-interactive add bugfix/fix-123 release/v2
```

### List Worktrees

```bash
"$SKILL_DIR/scripts/git-wt" ls
```

Lists all worktrees (`git worktree list`).

### Remove a Worktree

```bash
"$SKILL_DIR/scripts/git-wt" --non-interactive rm <branch>
"$SKILL_DIR/scripts/git-wt" --non-interactive rm          # Removes current worktree (auto-detected)
"$SKILL_DIR/scripts/git-wt" --non-interactive rm --force <branch>  # Force removal
```

- Runs any configured teardown commands before removal
- Without args, removes the current worktree if in one

### Show Worktree Path

```bash
"$SKILL_DIR/scripts/git-wt" cd <branch>
```

Prints the filesystem path of the worktree for `<branch>`. Useful for scripting.

### Initialize Configuration

```bash
"$SKILL_DIR/scripts/git-wt" init
```

Interactively creates `worktree.conf.local` in the repo root.

### Help

```bash
"$SKILL_DIR/scripts/git-wt" help
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

1. **Create worktree** for a feature branch:
   ```bash
   "$SKILL_DIR/scripts/git-wt" --non-interactive add feature/my-branch master
   ```
2. **Work in the worktree** directory (printed as the last line of output)
3. **List worktrees** to see all active ones:
   ```bash
   "$SKILL_DIR/scripts/git-wt" ls
   ```
4. **Clean up** when done:
   ```bash
   "$SKILL_DIR/scripts/git-wt" --non-interactive rm feature/my-branch
   ```

## Source

Bundled from [vojtabiberle/git-wt](https://github.com/vojtabiberle/git-wt) (v1.0.0).
