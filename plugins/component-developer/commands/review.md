---
description: Thorough code review of Keboola Python component code, focusing on architecture, config/client patterns, and Pythonic best practices
allowed-tools: Read, Glob, Grep, Bash
argument-hint: [paths-or-scope]
---

# Component Code Review

Perform a thorough, opinionated code review focusing on Keboola Python component architecture and best practices.

## What This Command Does

1. **Reviews the current diff or specified paths** for Keboola Python component code
2. **Applies opinionated review rules** from the reviewer agent:
   - Architecture first: separation of concerns (component vs client vs config)
   - Config/client initialization in `__init__`, not `run()`
   - Modern typing (built-in generics, no deprecated `typing.List`/`Dict`/`Optional`)
   - Safety and robustness (edge cases, pagination guards)
   - Repository hygiene (dependencies, stray files)
3. **Produces a specific TODO list** with line numbers, patterns, and concrete fixes
4. **Uses a characteristic tone**: direct but kind, giving authors agency

## Usage

```bash
# Review unstaged changes (default)
/review

# Review specific files or directories
/review src/component.py src/client.py

# Review all Python files in a directory
/review src/
```

## Instructions

### Step 1: Determine Review Scope

If the user provided paths as arguments (`$ARGUMENTS`), review those specific files/directories.
Otherwise, review unstaged changes from `git diff`.

```bash
# Check for unstaged changes
git diff --name-only

# Or if paths provided, verify they exist
ls -la $ARGUMENTS
```

### Step 2: Read the Code

Read the files to be reviewed. For components, focus on:
- `src/component.py` - Main component logic
- `src/configuration.py` - Configuration handling
- `src/*_client.py` - API client classes
- `pyproject.toml` - Dependencies and Python version

```bash
# Get list of Python files
find src/ -name "*.py" -type f 2>/dev/null || echo "No src/ directory"
```

### Step 3: Check Project Context

Look for project-specific rules and Python version:

```bash
# Check for CLAUDE.md or AGENTS.md
cat CLAUDE.md 2>/dev/null || cat AGENTS.md 2>/dev/null || echo "No project rules file"

# Check Python version from pyproject.toml
grep -A2 "python" pyproject.toml 2>/dev/null || echo "No pyproject.toml"
```

### Step 4: Apply Review Principles

Review the code against these key principles (in order of importance):

**Architecture (Blocking if violated):**
- Is `run()` a clean orchestrator (< 30 lines)?
- Are clients and configuration initialized in `__init__`, not `run()`?
- Are clients stored as instance attributes (`self.client`)?
- Is configuration encapsulated in a typed config object?

**Code Quality (Important):**
- Are type hints using modern syntax (`list[str]`, not `List[str]`)?
- Are deprecated typing classes avoided (`typing.List`, `typing.Dict`, `typing.Optional`)?
- Is code formatted with ruff?
- Are imports organized?

**Safety (Important):**
- Are indexing/popping operations guarded by preconditions?
- Does pagination have explicit stopping conditions?
- Are edge cases handled (empty responses, last page)?

**Repository Hygiene (Nice-to-have):**
- Are dependencies sensibly pinned (not over-locked)?
- Are there stray files that shouldn't be there?
- Is the Python version reasonably current?

### Step 5: Format the Review as TODO List

Start with a brief overall assessment:
- "This is a great effort, just a couple of sections to clarify"
- "A couple of remarks, but nothing that important"
- "The component.py file is nice and clean"

Then produce a **specific TODO list** grouped by severity. Each TODO must include:
1. **Location** - File path and line number(s)
2. **Pattern** - The specific code or pattern that needs to change
3. **Fix** - Concrete guidance on what to change it to (2-3 sentences max)

## Example Output

```
## Overall Assessment

The component.py file is nice and clean, with good separation of concerns. A couple of remarks, but nothing that important.

## Blocking Issues

### TODO 1: Move client initialization to __init__
**Location:** `src/component.py:45-52`
**Pattern:** `self.client = ApiClient(...)` is created inside `run()` method.
**Fix:** Move this initialization to `__init__` and store as `self.client`. This allows sync_actions to reuse the client without duplicating logic.

## Important Improvements

### TODO 2: Use modern typing syntax
**Location:** `src/configuration.py:12`
**Pattern:** `from typing import List, Dict, Optional`
**Fix:** Remove this import. Use built-in generics: `list[str]` instead of `List[str]`, `str | None` instead of `Optional[str]`.

## Nice-to-Have

### TODO 3: Organize imports
**Location:** `src/component.py:1-15`
**Pattern:** Imports are not sorted according to ruff conventions.
**Fix:** Run `ruff check --select I --fix src/component.py` to auto-organize imports.

---
LGTM with the above changes!
```

## Reference

This command applies the principles from the `@reviewer` agent. For the full set of review guidelines, see `agents/reviewer.md`.
