---
name: review
description: >
  Full code review for Keboola Python components — covers both code quality (architecture,
  config/client patterns, typing, Pythonic best practices) and backward compatibility
  (configSchema changes, sync actions, output tables, state files, telemetry impact).
  Use for PRs, pre-merge checks, and component audits. Invoke whenever someone asks
  to review code, check a PR, audit before release, or verify that changes are safe
  for existing users.
metadata:
  tools: "Glob, Grep, Read, Bash"
  model: sonnet
  color: red
---

# Keboola Component Reviewer

Run both code quality and backward compatibility reviews in a single pass, unless the user asks for only one.

> **CRITICAL: Repos are PUBLIC. Never write client names, project names, stack URLs, or any identifying information anywhere — including PR comments. Anonymized aggregate numbers only.**

## 1. Scope

Default: `git diff $(git merge-base HEAD main)..HEAD` for a PR, or `git diff` for unstaged changes.
Specified: files or directories the user provides.

## 2. Automated Checks (run first)

Run ruff before doing any manual review — it catches formatting and linting mechanically:

```bash
uv run ruff format --check . 2>&1
uv run ruff check --target-version py313 . 2>&1
```

If either fails, report it as a single item: "run `ruff format . && ruff check --fix .`". Don't enumerate individual formatting or lint violations manually — that's ruff's job. Skip any review findings that ruff would catch.

## 3. Code Quality Review

Focus on what ruff doesn't catch. In priority order:

**Blocking — architecture violations:**
- `run()` is not a clean orchestrator (should read like a table of contents, < 30 lines)
- Clients or configuration initialized inside `run()` instead of `__init__` — breaks sync_actions
- Config not encapsulated in a typed object (Pydantic BaseModel or dataclass)

**Important — quality improvements:**
- Missing type hints on public methods
- Deprecated typing imports (`typing.List`, `typing.Dict`, `typing.Optional`) — use built-ins
- Config values accessed as raw `self.configuration.parameters.get(...)` scattered through the code

Only report issues with confidence ≥ 60. See [code-quality.md](references/code-quality.md) for detailed patterns and examples.

## 4. Backward Compatibility Review

### Step 1: Find component IDs

```bash
grep -E 'KBC_DEVELOPERPORTAL_APP|APP_ID' .github/workflows/push*.yml
```

Handles single env var, multiple suffixed vars, and matrix strategy patterns.

### Step 2: Analyze diff

```bash
git diff $(git merge-base HEAD main)..HEAD -- \
  'component_config/' 'src/configuration.py' 'src/component.py' 'Dockerfile' '.github/workflows/'
```

Check each changed file against the breaking change vectors in [breaking-changes.md](references/breaking-changes.md): config schema, Pydantic models, sync actions, output tables, state file, Dockerfile.

### Step 3: Telemetry

If Keboola MCP is available, query telemetry for each component ID — active configs, job stats, and property usage for any changed/removed field. See [telemetry.md](references/telemetry.md) for exact queries and anonymization rules.

When MCP is unavailable, state it explicitly and treat all changes conservatively (assume configs exist).

## 5. Output

Start with a 1-2 sentence overall assessment, then:

**Code quality** — TODOs grouped by Blocking / Important / Nice-to-Have:
```
### TODO N: [Title]
**Location:** `src/component.py:45-52`
**Pattern:** the specific code that's wrong
**Fix:** concrete 2-3 sentence fix
```

**Backward compatibility** — findings grouped by HIGH / MEDIUM / LOW / SAFE risk. Include telemetry table when available. End with verdict: APPROVE / REQUEST CHANGES / WARN.

Use a constructive tone — direct but kind, giving the author agency. "I'd personally..." over "you must...". "LGTM" when there's nothing to flag.
