---
name: gh-process-review
description: Process GitHub PR review comments by fetching them to local JSON, implementing fixes, and tracking progress. Use when user invokes /gh-process-review command. Fetches reviews to file to avoid context pollution, uses jq for parsing, commits each fix separately. Starts in planning mode by default. Supports optional "continue" argument to skip fetching and resume with existing reviews file.
---

# GitHub Review Processing

Process PR review threads efficiently by storing them locally and addressing them one by one.

## Working Directory Context

**CRITICAL: All commands MUST be run from the user's project root directory, NOT from the skill directory.**

- The user will be in THEIR project directory when invoking this skill
- All script calls use `$SKILL_DIR/scripts/review.sh` — the single entry point
- The script auto-detects the reviews file from the current branch's PR
- **DO NOT `cd` into the skill directory** - the script handles path resolution internally

`SKILL_DIR` = directory containing this SKILL.md (automatically resolved by Claude)

## CRITICAL Rules

1. **STAY IN PROJECT ROOT** - Never `cd` into the skill directory. Call `$SKILL_DIR/scripts/review.sh` from the project root.
2. **ONE COMMIT PER FIX** - Each review thread fix MUST be committed separately. Never batch multiple fixes into one commit.
3. **START IN PLANNING MODE** - Always enter planning mode first (unless context explicitly says otherwise like "skip planning" or "no planning").
4. **NEVER RESOLVE THREADS** - Do NOT use the GitHub API to resolve review threads. Only the reviewer may resolve their own comments. Use `mark` for local tracking only.

## Workflow

### Phase 1: Setup

Fetch reviews for current PR and list unresolved threads:

```bash
"$SKILL_DIR/scripts/review.sh" fetch
```

This auto-detects the PR from the current branch, fetches all review threads, and prints unresolved threads.

#### Continue mode (`/gh-process-review continue`)

Skip fetching, list unresolved threads from existing reviews file:

```bash
"$SKILL_DIR/scripts/review.sh" list
```

### Phase 2: Planning (default)

After fetching, **enter planning mode** using `EnterPlanMode` tool.

**CRITICAL: Context is cleared when the plan is approved.** The plan must be self-contained. `$SKILL_DIR` will no longer be set after context clears, so **resolve it to the absolute path** in the plan. Do NOT use shell variables — write out the full path in every command. Beyond the thread list and proposed fixes, always include these sections in the plan (replacing `/absolute/path/to` with the actual resolved `$SKILL_DIR/scripts/review.sh` path):

```markdown
## Skill Script
Commands (use the literal path, not a variable):
- `/absolute/path/to/scripts/review.sh get <ID>` — get thread details
- `/absolute/path/to/scripts/review.sh reply <ID> <commit-hash>` — reply with commit
- `/absolute/path/to/scripts/review.sh reply <ID> -m "message"` — reply with message only
- `/absolute/path/to/scripts/review.sh reply <ID> -m "message" <commit-hash>` — reply with both
- `/absolute/path/to/scripts/review.sh mark <ID>` — mark locally resolved

## Rules
- NEVER resolve threads via GitHub API — only the reviewer may resolve their own comments
- ONE commit per fix — never batch multiple fixes
- Each fix: implement → commit → push → reply → mark → next thread
- STAY in project root — never cd into skill directory
```

In the plan:
1. List all unresolved threads with thread ID, file:line, and brief summary
2. For each thread, outline the proposed fix approach
3. Identify any dependencies between fixes
4. Include implementation order

Skip planning only if user explicitly requests it (e.g., "skip planning", "no planning", "just fix it").

### Phase 3: Implementation

For each unresolved thread (one at a time):

1. Get thread details: `"$SKILL_DIR/scripts/review.sh" get PRRT_...`
2. Read the file and understand the feedback
3. Implement the fix
4. **COMMIT THIS FIX IMMEDIATELY** - Do not continue to next thread without committing:
   ```bash
   git add <changed-files>
   git commit -m "$(cat <<'EOF'
   AI-XXXX Address review: <brief description>

   Addresses comment by @<reviewer> on <file>:<line>

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
   EOF
   )"
   ```
5. Push the commit
6. Reply with commit: `"$SKILL_DIR/scripts/review.sh" reply PRRT_...`
7. Mark resolved: `"$SKILL_DIR/scripts/review.sh" mark PRRT_...`
8. **Only then** proceed to next thread

### Phase 4: Reflection

After all threads are addressed, reflect on the reviewer's feedback:

1. **Could this feedback have been prevented?** If the reviewer caught issues that better instructions (in CLAUDE.md, MEMORY.md, or other project memory files) would have avoided, suggest specific additions to those files so the same mistakes don't recur.
2. **Did you get confused while addressing any feedback?** If any review comment was ambiguous, required multiple attempts, or led you down a wrong path, suggest updating memory files with clarifying guidance for future iterations.
3. Present the suggested memory updates to the user for approval before writing them.

## CLI Reference

Single entry point: `$SKILL_DIR/scripts/review.sh`

### Global flags

- `--file <path>` — Override auto-detected reviews file path

### Subcommands

#### fetch
```bash
"$SKILL_DIR/scripts/review.sh" fetch                                    # Current branch's PR
"$SKILL_DIR/scripts/review.sh" fetch 123                                # Specific PR number
"$SKILL_DIR/scripts/review.sh" fetch https://github.com/owner/repo/pull/123  # PR URL
```
Fetches review threads via GraphQL, saves to `.scratch/reviews/`, and auto-lists unresolved threads.

#### list
```bash
"$SKILL_DIR/scripts/review.sh" list                # summary (default)
"$SKILL_DIR/scripts/review.sh" list full           # full JSON details
"$SKILL_DIR/scripts/review.sh" list ids            # just thread IDs
```

#### get
```bash
"$SKILL_DIR/scripts/review.sh" get PRRT_kwDOAbcd1234
"$SKILL_DIR/scripts/review.sh" get PRRT_kwDOAbcd1234 PRRT_kwDOEfgh5678
```
Returns: Single thread as JSON object, or JSON array when multiple IDs given.
Fields: `path`, `line`, `comments[]`, `isResolved`, `isOutdated`. Warns on missing IDs.

#### reply
Requires at least one of `-m` or a commit hash.
```bash
"$SKILL_DIR/scripts/review.sh" reply PRRT_kwDOAbcd1234 abc1234                         # Commit hash → "Fixed in abc1234"
"$SKILL_DIR/scripts/review.sh" reply PRRT_kwDOAbcd1234 -m "No changes needed"          # Message only
"$SKILL_DIR/scripts/review.sh" reply PRRT_kwDOAbcd1234 -m "Refactored per suggestion" abc1234  # Both → "Fixed in abc1234\n\nRefactored per suggestion"
```

#### mark
```bash
"$SKILL_DIR/scripts/review.sh" mark PRRT_kwDOAbcd1234
"$SKILL_DIR/scripts/review.sh" mark PRRT_kwDOAbcd1234 "Fixed in commit abc123"
```

## JSON Structure

- `pr`: PR metadata (number, title, branch names, url)
- `threads[]`: `id`, `path`, `line`, `isResolved`, `isOutdated`, `local_resolved`, `local_notes`, `comments[]`
- `reviews`: Review summaries

## Key Thread Fields

- `id`: GraphQL ID (starts with `PRRT_`)
- `path`: File path
- `line`: Line number
- `comments[0].body`: Main feedback
- `comments[0].author`: Reviewer
