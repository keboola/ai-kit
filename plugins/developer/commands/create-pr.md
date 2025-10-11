---
description: Analyzes your changes and creates a pull request with AI-generated title and description focusing on WHY changes were made
allowed-tools: Bash, Read, Grep, Glob
argument-hint: [base-branch]
---

# Create Pull Request Command

Analyze current branch changes, understand the motivation and context, and create a pull request with a description that explains WHY the changes were made, not just what was changed.

## What This Command Does

1. **Checks for PR Template**
   - Looks for `.github/pull_request_template.md`
   - Uses template structure exactly if it exists

2. **Analyzes Your Changes**
   - Reviews commit messages for context
   - Examines the diff to understand the changes
   - Identifies the problem being solved or feature being added

3. **Generates PR Content**
   - Creates a clear, descriptive PR title
   - Writes a description focused on:
     - **WHY**: The motivation, problem, or requirement
     - **Context**: Background information and reasoning
     - **Approach**: High-level explanation of the solution
     - **Impact**: What this enables or fixes
   - **Does NOT** list changed files or obvious code changes (the diff shows that)

4. **Creates the PR**
   - Pushes branch to remote if needed
   - Opens PR using GitHub CLI (`gh`)
   - Returns the PR URL

## Usage

```bash
# Create PR against default branch (usually main/master)
/create-pr

# Create PR against specific branch
/create-pr develop

# Create draft PR
/create-pr main draft
```

## Prerequisites

- GitHub CLI (`gh`) must be installed and authenticated
- Current branch should have commits that aren't in the base branch
- Repository must have a GitHub remote

## Instructions

### Step 1: Check for PR Template

Check if `.github/pull_request_template.md` exists:
```bash
# Primary PR template location
test -f .github/pull_request_template.md && cat .github/pull_request_template.md
```

If found, read the template and use its structure. The template may have:
- Specific sections to fill out (e.g., Why, What, Testing)
- Checkboxes to complete
- Required information fields
- Links to contribution guidelines

**Use the template's structure exactly** - fill in the sections it defines rather than using a generic format.

### Step 2: Gather Git Information

Run these commands in parallel:

```bash
# Get current branch
git branch --show-current

# Check if branch is pushed to remote
git status -sb

# Get default branch
git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'

# Check if gh is installed and authenticated
gh auth status
```

### Step 3: Determine Base Branch

- If user provided `$1` (first argument), use that as base branch
- Otherwise, use the default branch (usually `main` or `master`)
- Validate that base branch exists

### Step 4: Analyze Changes for Context

```bash
# Get commit messages for context
git log $BASE_BRANCH..HEAD --format="%s%n%b"

# Get the diff (but don't list it in PR description)
git diff $BASE_BRANCH...HEAD
```

**Focus on understanding:**
- **WHY** are these changes needed?
  - What problem does this solve?
  - What requirement or feature request is this addressing?
  - What was broken or missing?
- **Context**:
  - What was the motivation behind this?
  - Are there related issues or discussions?
  - What alternatives were considered?
- **Approach**:
  - What was the chosen solution and why?
  - Are there any important architectural decisions?
  - Are there trade-offs to be aware of?
- **Impact**:
  - What does this enable or improve?
  - Are there breaking changes?
  - Does this affect performance, security, or UX?

**DO NOT include:**
- List of changed files (visible in GitHub's Files tab)
- Line-by-line code changes (visible in diff)
- Obvious changes like "added function X" (visible in code)

### Step 5: Generate PR Title

**Title Format:**
- Start with conventional commit type if applicable (feat:, fix:, refactor:, docs:, etc.)
- Keep it under 72 characters
- Be specific and descriptive about the change
- Focus on what this achieves, not what files changed

**Good Examples:**
- `feat: add OAuth2 authentication to improve security`
- `fix: resolve race condition causing payment failures`
- `refactor: simplify error handling for better maintainability`

**Bad Examples:**
- `fix: update users.ts` (too vague, mentions file)
- `feat: changes to API` (unclear what this does)

### Step 6: Generate PR Description

**If PR Template Exists:**
Follow the template structure and fill in each section appropriately.

**If No Template, Use This Structure:**

```markdown
## Why

[Explain the motivation. What problem does this solve? What requirement does it address? Why is this change needed now?]

## Context

[Provide background. Is there a related issue? Was there a user report? What was the previous behavior or limitation?]

## Approach

[High-level explanation of the solution. What strategy did you take? Why this approach over alternatives? Any important architectural decisions?]

## Impact

[What does this enable? How does it improve things? Are there breaking changes? Performance implications? Security considerations?]

## Testing

[How was this tested? What should reviewers verify? Are there edge cases to consider?]

## Notes

[Any additional context, caveats, deployment requirements, or follow-up work needed?]

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**Key Principles:**
1. **Focus on WHY, not WHAT** - Explain reasoning, not code changes
2. **Provide context** - Help reviewers understand the background
3. **Be concise** - Get to the point quickly
4. **Avoid redundancy** - Don't list things visible in the diff
5. **Think about reviewers** - What do they need to know to review effectively?

### Step 7: Push Branch if Needed

```bash
# Check if branch is tracked
git rev-parse --abbrev-ref --symbolic-full-name @{u}

# If not tracked, push with -u flag
git push -u origin $(git branch --show-current)

# If already tracked but behind, push
git push
```

### Step 8: Create the PR

```bash
# Create PR with generated title and description
gh pr create \
  --base $BASE_BRANCH \
  --title "$PR_TITLE" \
  --body "$(cat <<'EOF'
$PR_DESCRIPTION
EOF
)"

# Or create draft PR if "draft" in arguments
gh pr create \
  --base $BASE_BRANCH \
  --title "$PR_TITLE" \
  --body "$PR_DESCRIPTION" \
  --draft
```

### Step 9: Return PR URL

Display the PR URL and a success message:

```
✅ Pull Request Created!

Title: [PR Title]
Base: [base-branch] ← [current-branch]
URL: [PR URL]

Next Steps:
- Review the PR description and edit if needed
- Request reviewers: gh pr edit --add-reviewer @username
- Add labels: gh pr edit --add-label "enhancement"
```

## Error Handling

### No Changes to Push
```
❌ No changes to create PR for.
Your branch is up to date with '$BASE_BRANCH'.
```

### Not on a Branch
```
❌ Not on a branch.
Create a branch first: git checkout -b feature/my-branch
```

### GH Not Installed
```
❌ GitHub CLI (gh) not found.
Install it: https://cli.github.com/
```

### No Remote
```
❌ No GitHub remote found.
Add remote: git remote add origin <url>
```

## Advanced Usage

### Linking Issues

If commit messages or branch names mention issues, include them:
- Use "Closes #123" for bugs
- Use "Relates to #456" for related work
- Use "Part of #789" for partial implementations

### Draft PRs

User can specify "draft" in arguments:
```bash
/create-pr main draft
```

### Custom Context

If user provides additional context as `$2` or beyond, incorporate it into the "Context" or "Notes" section.

## Example Good PR Description

```markdown
## Why

Users were experiencing authentication failures when using OAuth providers due to token expiration handling. This was causing ~5% of logins to fail, requiring users to re-authenticate multiple times.

## Context

We received multiple support tickets reporting intermittent login failures. Investigation revealed that our OAuth token refresh logic wasn't properly handling edge cases where tokens expired during the refresh process itself.

## Approach

Implemented a retry mechanism with exponential backoff for token refresh operations. Added a token validation step before critical operations to proactively refresh tokens that are about to expire. This prevents the race condition that was causing failures.

## Impact

- Eliminates the authentication failure case that was affecting users
- Improves UX by making authentication more reliable
- Reduces support ticket volume related to login issues
- No breaking changes - fully backward compatible

## Testing

- Tested with Google, GitHub, and Microsoft OAuth providers
- Simulated token expiration scenarios in integration tests
- Verified existing sessions continue to work
- Load tested with 1000 concurrent authentications

## Notes

Monitoring should be added to track token refresh success rates in production. This will help us identify if similar issues occur with other OAuth providers.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Example Bad PR Description (What to Avoid)

```markdown
## Changes

- Updated auth.ts
- Modified token-service.ts
- Added new test file
- Changed 15 files with 234 additions and 67 deletions

## Files Modified

- src/auth/auth.ts
- src/auth/token-service.ts
- src/tests/auth.test.ts
[...list of all files...]

## Code Changes

- Added function `refreshTokenWithRetry()`
- Modified `authenticate()` method
- Updated imports
```

❌ **This is bad because:**
- Lists files that are visible in the diff anyway
- Focuses on WHAT changed, not WHY
- Provides no context or motivation
- Doesn't help reviewers understand the problem being solved

## Best Practices

1. **Always check for PR template first** - Respect project conventions
2. **Read commit messages** - They often contain valuable context about WHY
3. **Look for linked issues** - Reference them in the description
4. **Think like a reviewer** - What would help you review this?
5. **Be concise but complete** - Provide context without writing an essay
6. **Focus on impact** - Explain what this enables or improves
7. **Highlight breaking changes** - Make them obvious
8. **Add deployment notes** - Mention migrations, config changes, etc.

## Notes

- Use `gh pr create` for consistency
- Respect PR templates when they exist
- Link to issues using GitHub syntax (#123)
- Add "Closes #123" to auto-close issues when merged
- Consider adding labels for better categorization
