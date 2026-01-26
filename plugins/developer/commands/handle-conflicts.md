---
description: Handles merge conflicts in a predictable manner, specially tailored to allow future review while the conflict is resolved in unsupervised environment.
allowed-tools: Bash, Read, Write, Grep, Glob
---

Your goal is to assist human in resolving conflicts in git. Commits can occur
during merge, rebase, cherry-pick or other actions. Remember that there might be
multiple conflicts occurring in adjacent commits.

**Overall status and detect operation type:** 
!`git status`

**Current branch name (empty during rebase detached state)**
!`git branch --show-current 2>/dev/null || echo "detached"`

**Commit currently being applied (during rebase)**
!`git log --oneline -1 REBASE_HEAD 2>/dev/null || echo "No REBASE_HEAD"`

**List of conflicted files**
!`git diff --name-only --diff-filter=U`

**Other useful commands**
```bash
# Get the rebase target (what we're rebasing onto)
cat .git/rebase-merge/onto 2>/dev/null | head -c 10 || echo "N/A"

# Get original branch name (stored during rebase)
cat .git/rebase-merge/head-name 2>/dev/null | sed 's|refs/heads/||' || echo "N/A"

# Count remaining commits in rebase
wc -l < .git/rebase-merge/git-rebase-todo 2>/dev/null || echo "0"
```

## Directory Structure

For multi-commit operations (especially rebases), use this structure:

```
.scratch/conflicts-$branch/
├── overview.md           # Overall progress, context for next iterations
├── commit-1-$short_hash.md  # Conflict resolution for first commit
├── commit-2-$short_hash.md  # Conflict resolution for second commit
└── ...
```

## Process

1. **Detect the operation** (assume rebase if unclear)
2. **Create/update directory** `.scratch/conflicts-$branch/`
3. **Check for existing overview.md** - read it to get context from previous iterations
4. **Create/update overview.md** with current state
5. **Create commit-N-$hash.md** for the current conflicting commit
6. **Resolve conflicts** following the analysis steps below
7. **Run typecheck** (`yarn type-check`) - fix any errors in conflicted/related files before continuing
8. **Stage resolved files** (`git add <files>`)
9. **Update overview.md** with:
   - Resolution summary for this commit
   - Important context for subsequent commits (refactorings detected, patterns found)
10. **STOP** - Do NOT run `git rebase --continue`. Let the user review and continue manually.

When user invokes the command again after continuing, repeat from step 3.

Never use "--ours" and "--theirs" while resolving conflict, instead edit the files.

## overview.md Template

```markdown
# Conflict Resolution Overview

**Branch:** `branch-name`
**Operation:** Rebase onto `target-branch`
**Started:** YYYY-MM-DD HH:MM

## Important Context for Next Iterations

<!-- This section passes knowledge to future conflict resolutions -->

### Refactorings Detected

- `old/path/file.ts` was moved to `new/path/file.ts` in commit abc1234
- Function `oldName()` was renamed to `newName()` in main branch

### Patterns to Watch For

- All changes to `ComponentX` need to be applied to `NewComponentX` instead
- Import paths changed from `@/old` to `@/new`

### Decisions Made

- Chose to keep main branch's API structure, adapting feature branch changes to match
- Deprecated function `foo()` was removed; all usages replaced with `bar()`

## Resolution Log

### Commit 1: abc1234 - feat: add feature X
- **Files:** `file1.ts`, `file2.ts`
- **Details:** See `commit-1-abc1234.md`

### Commit 2: def5678 - fix: update feature X
- **Files:** `file3.ts`
- **Details:** See `commit-2-def5678.md`
```

## Per-Commit File Template (commit-N-$hash.md)

```markdown
# Conflict Resolution - Commit N

**Commit:** `full-hash`
**Message:** commit message
**Author:** author name
**Date:** commit date

## Conflicted Files

1. `path/to/file1.ts`
2. `path/to/file2.ts`

---

## File: file1.ts

### Commits Involved

**On base branch (main):**
- `hash` - commit message
  - Description of changes

**On feature branch:**
- `hash` - commit message
  - Description of changes

### Refactoring Detection

**Was code moved/refactored?** [Yes/No]

If yes:
- **Type:** [Moved/Split/Consolidated/Deleted]
- **Original location:** `old/path/file.ts:line`
- **New location:** `new/path/file.ts:line`
- **How detected:** [describe the evidence]

### Why Remote Changes Occurred
[explanation]

### Why Local Changes Occurred
[explanation]

### Why the Conflict Occurs
[explanation]

### Resolution Strategy

**Approach:** [Merge in place / Apply to new location / Accept deletion / etc.]

**Detailed steps:**
1. ...
2. ...

---

## Resolution Status

- [ ] file1.ts - [status]
- [ ] file2.ts - [status]

## Context for Next Commits

<!-- Add anything the next iteration should know -->

- [Note any refactorings or patterns discovered]
- [Note any decisions that affect subsequent commits]
```

## Refactoring Detection (CRITICAL)

When code is moved/refactored in one branch and modified in another, naive conflict resolution leads to bugs. You MUST detect and handle these cases properly.

### Step 1: Check for code movement

For each conflicted file, run these checks:

```bash
# Check if file was deleted/renamed in the branch you're merging/rebasing onto
# MERGE CASE (when you know the target branch, e.g. main)
# Replace <target-branch> with the branch you are merging into (e.g. origin/main)
BASE_COMMIT=$(git merge-base HEAD <target-branch>)
git diff --name-status "$BASE_COMMIT" <target-branch> -- <conflicted-file>

# REBASE CASE (when an in-progress rebase has an onto/base commit recorded)
ONTO=$(cat .git/rebase-merge/onto 2>/dev/null || cat .git/rebase-apply/onto 2>/dev/null || true)
if [ -n "$ONTO" ]; then
  git diff --name-status "$ONTO" HEAD -- <conflicted-file>
fi
# Check file history for renames
git log --follow --oneline --name-status -5 -- <conflicted-file>

# Find where the code might have moved to (search for unique identifiers)
# Extract a unique function/class/variable name from the conflicting code
git grep -n "<unique_identifier>" HEAD
```

### Step 2: Identify the refactoring type

Document this in `.scratch/conflicts-$branch/overview.md` or the relevant `commit-N-$hash.md` file:

1. **Code moved to different file**: The functionality exists but in a new location
2. **Code split into multiple files**: The functionality was decomposed
3. **Code consolidated from multiple files**: Multiple sources merged into one
4. **Code deleted entirely**: The functionality was intentionally removed
5. **No refactoring**: Standard in-place conflict

### Step 3: Resolution strategy based on refactoring type

**If code was MOVED to a different file:**
- Do NOT apply changes to the old location (it may not exist or be a stub)
- Find the new location of the code
- Apply the semantic change (not the literal diff) to the new location
- Document in overview.md for subsequent commits: "Code moved from X to Y"

**If code was SPLIT:**
- Determine which part of the split receives the change
- Apply to the appropriate new location(s)

**If code was CONSOLIDATED:**
- Apply the change to the new consolidated location

**If code was DELETED intentionally:**
- Evaluate if the change from the other branch is still relevant
- If the deletion was intentional and the change is obsolete, accept the deletion
- If the change reveals a bug that should affect other code, find where to apply it

**If no refactoring (standard conflict):**
- Merge both changes as usual

### Step 4: Verify resolution

After resolving, verify:
```bash
# Ensure no duplicate code was introduced
git grep -c "<key_function_name>"

# Check that the semantic change is actually applied somewhere
git diff HEAD -- '<new_location_if_moved>'
```

### Step 5: Run typecheck after resolution

**MANDATORY**: After resolving conflicts in each commit, run the typecheck:

```bash
yarn type-check
```

**Analyzing typecheck results:**

1. **If errors exist in conflicted files** - These are likely resolution errors. Fix them before continuing.
2. **If errors exist in files related to moved/refactored code** - The semantic change may not have been applied correctly to the new location.
3. **If errors are in unrelated files** - These may be pre-existing. Check `git stash list` or compare with the pre-resolution state (current HEAD) to confirm.

**Pre-existing errors check:**
```bash
# Compare error count with pre-resolution HEAD (current commit)
git stash push -m "conflict-check"
git checkout HEAD -- .
yarn type-check 2>&1 | tail -20
git stash pop
```

If new type errors appear after your resolution that weren't in the base, your resolution is incorrect. Common causes:
- Missing imports that the moved code needed
- Type signature changes not propagated to all call sites
- Duplicate declarations from keeping code in both old and new locations

## Reading Context from Previous Iterations

When starting work on a new commit in an ongoing rebase:

1. **Always read overview.md first** if it exists
2. **Check "Important Context for Next Iterations"** section
3. **Apply learned patterns** - if overview.md says "file X moved to Y", check if current commit touches file X and apply changes to Y instead
4. **Update overview.md** with any new discoveries

## Common Pitfalls to Avoid

1. **"Keep HEAD structure" is almost always WRONG**: During a rebase, you are applying feature branch commits onto HEAD. If you resolve by "keeping HEAD" without changes, you are effectively discarding the commit being applied. Ask yourself: "What was this commit trying to do?" and ensure that intent is preserved in the resolution.

   **Red flags that indicate wrong resolution:**
   - "Keep HEAD's version" / "Accept current changes"
   - Resolution that doesn't include ANY of the incoming commit's changes
   - The resolved file looks identical to HEAD

   **Correct approach:**
   - Understand what the incoming commit was trying to achieve
   - Apply that semantic change to HEAD's structure/location
   - The result should be HEAD's structure WITH the incoming commit's modifications

2. **Keeping deleted code**: If one branch deleted a file/function and another modified it, don't blindly restore the old code. Check if the deletion was intentional.

3. **Ignoring moved code**: If you see a conflict where "ours" deletes content and "theirs" modifies it, ALWAYS check if the content was moved elsewhere.

4. **Duplicate functionality**: After resolution, verify you haven't created duplicate code in both old and new locations.

5. **Lost changes**: When accepting a refactoring, ensure the semantic intent of the other branch's changes is preserved in the new location.

6. **Assuming in-place resolution**: Not every conflict should be resolved in the conflicting file. Sometimes the right answer is to modify a completely different file.

7. **Not reading previous context**: In multi-commit rebases, ALWAYS check overview.md for context from previous conflict resolutions.

8. **Not updating context**: After resolving, ALWAYS update overview.md with patterns/refactorings discovered for subsequent commits.