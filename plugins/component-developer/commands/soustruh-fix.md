---
description: Apply fixes from Soustruh review incrementally with proper commits - supports per-severity or per-TODO modes
allowed-tools: Read, Glob, Grep, Bash, Edit, Write
argument-hint: [--per-todo | --per-severity]
---

# Soustruh Fix

Apply fixes from a Soustruh review incrementally, with proper commits for each change. This command is designed to work after running `/soustruh-review` and addresses the problem of making too many changes at once.

## Modes

### Per-Severity Mode (default)
One commit per severity category:
- `fix(soustruh): address blocking review items`
- `chore(soustruh): apply important review improvements`
- `style(soustruh): address nits from soustruh review`

### Per-TODO Mode (`--per-todo`)
One commit per individual fix:
- `fix(soustruh): TODO 1 – init client in __init__ (src/component.py)`
- `refactor(soustruh): TODO 2 – encapsulate config in ClientConfig`

## Usage

```bash
# Apply fixes grouped by severity (default)
/soustruh-fix

# Apply fixes one commit per TODO
/soustruh-fix --per-todo

# Apply fixes to specific paths
/soustruh-fix src/component.py

# Per-TODO mode on specific paths
/soustruh-fix --per-todo src/
```

## Instructions

### Step 0: Check Prerequisites

Ensure clean working tree before starting:

```bash
# Check for uncommitted changes
git status --porcelain
```

If there are uncommitted changes, ask the user to commit or stash them first. Do not proceed with a dirty working tree.

### Step 1: Determine Mode

Check if `$ARGUMENTS` contains `--per-todo`:
- If yes: use **per-TODO mode** (one commit per fix)
- If no: use **per-severity mode** (one commit per category)

Extract any file paths from arguments (anything that's not `--per-todo` or `--per-severity`).

### Step 2: Run Soustruh Review

Re-run the review logic to get fresh TODOs with accurate line numbers:

1. Read the files to be fixed (from arguments or `git diff --name-only`)
2. Apply Soustruh's review principles (see `@soustruh-reviewer` agent)
3. Generate the TODO list grouped by severity

### Step 3: Apply Fixes

#### Per-Severity Mode

Process in order: Blocking -> Important -> Nice-to-Have

**For Blocking Issues:**
1. Apply ALL blocking fixes
2. Run `ruff format .` and `ruff check --fix .`
3. Verify changes with a quick review
4. Stage and commit:
   ```bash
   git add -A
   git commit -m "fix(soustruh): address blocking review items

   - [list each TODO that was fixed]"
   ```

**For Important Improvements:**
1. Apply ALL important fixes
2. Run `ruff format .` and `ruff check --fix .`
3. Stage and commit:
   ```bash
   git add -A
   git commit -m "chore(soustruh): apply important review improvements

   - [list each TODO that was fixed]"
   ```

**For Nice-to-Have / Nits:**
1. Apply ALL nit fixes
2. Run `ruff format .` and `ruff check --fix .`
3. Stage and commit:
   ```bash
   git add -A
   git commit -m "style(soustruh): address nits from soustruh review

   - [list each TODO that was fixed]"
   ```

#### Per-TODO Mode

Process each TODO individually, in order (blocking first, then important, then nits):

For each TODO:
1. Apply ONLY that specific fix
2. Run `ruff format .` on affected files
3. Stage and commit with descriptive message:
   ```bash
   git add [affected files]
   git commit -m "fix(soustruh): TODO N – [short description] ([file])"
   ```

**Commit prefix by TODO type:**
- Blocking issues: `fix(soustruh):`
- Important improvements: `refactor(soustruh):` or `chore(soustruh):`
- Nits: `style(soustruh):`

### Step 4: Re-validate After Each Chunk

After completing each severity bucket (or every 3-5 TODOs in per-TODO mode):

1. Re-run a quick review to check for:
   - New issues introduced by fixes
   - Stale line numbers that need updating
   - Dependencies between fixes that weren't handled

2. If new blocking issues appear, address them before continuing.

### Step 5: Summary

After all fixes are applied, provide a summary:

```
## Soustruh Fix Summary

**Mode:** [per-severity | per-todo]
**Commits created:** N

### Commits:
1. `abc1234` - fix(soustruh): address blocking review items
2. `def5678` - chore(soustruh): apply important review improvements
3. `ghi9012` - style(soustruh): address nits from soustruh review

### Remaining Issues:
[List any issues that couldn't be auto-fixed and need manual attention]

**Next steps:**
- Review the commits with `git log --oneline -N`
- Run tests to verify changes
- Push when ready: `git push`
```

## Safety Rules

1. **Never auto-push** - Let the user inspect commits first
2. **Only touch TODO-related code** - No opportunistic cleanups
3. **Preserve functionality** - If a fix might change behavior, ask first
4. **Bail out on conflicts** - If fixes conflict with each other, stop and ask
5. **Re-validate after changes** - Don't blindly apply stale line numbers

## Handling Dependencies

When fixes depend on each other:

1. **Structural changes first** - Function signatures, class definitions, config models
2. **Then callers** - Code that uses the changed structures
3. **Then formatting** - Import organization, style fixes

If TODO 2 depends on TODO 1:
- In per-severity mode: both are in the same commit, apply in order
- In per-TODO mode: apply TODO 1 first, then re-locate TODO 2's target before applying

## Example Session

```
User: /soustruh-fix --per-todo

Assistant: Running in per-TODO mode. Found 5 TODOs to fix.

Checking working tree... clean.

## Applying Fixes

### TODO 1: Move client initialization to __init__
Applying fix to src/component.py:45-52...
Running ruff format...
Committing: fix(soustruh): TODO 1 â init client in __init__ (src/component.py)

### TODO 2: Encapsulate configuration in typed object
Applying fix to src/component.py:23-35...
Running ruff format...
Committing: refactor(soustruh): TODO 2 â encapsulate config in ClientConfig

### TODO 3: Use modern typing syntax
Applying fix to src/client.py:12...
Running ruff format...
Committing: style(soustruh): TODO 3 â modernize typing in src/client.py

[continues for each TODO...]

## Soustruh Fix Summary

**Mode:** per-todo
**Commits created:** 5

### Commits:
1. `abc1234` - fix(soustruh): TODO 1 â init client in __init__
2. `def5678` - refactor(soustruh): TODO 2 â encapsulate config
3. `ghi9012` - style(soustruh): TODO 3 â modernize typing
4. `jkl3456` - style(soustruh): TODO 4 â organize imports
5. `mno7890` - style(soustruh): TODO 5 â add staticmethod decorator

**Next steps:**
- Review commits: `git log --oneline -5`
- Run tests: `uv run pytest`
- Push when ready: `git push`
```

## Reference

This command works best after running `/soustruh-review` first. For the full review guidelines, see `agents/soustruh-reviewer.md`.
