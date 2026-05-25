# Developer Plugin

A comprehensive toolkit for developers including specialized agents for code review, security analysis, and code quality management.

## 🤖 Available Agents

### Code Reviewer
**Command**: `@code-reviewer`
**Color**: 🟢 Green

Expert code reviewer for bugs, logic errors, security vulnerabilities, and project guidelines compliance. Uses confidence-based filtering (≥80%) to report only high-priority issues.

**Use cases:**
- Review code before pull requests
- Check adherence to project conventions (CLAUDE.md)
- Identify bugs and security issues
- Ensure code quality standards

---

### Security Agent
**Command**: `@code-security`
**Color**: 🔴 Red

Pragmatic application security engineer for multi-language code review with automated scanner integration.

**Features:**
- Cross-language security analysis (Python, Go, PHP, JavaScript, etc.)
- Automated security scanning (bandit, gosec, semgrep, npm audit, etc.)
- Dependency vulnerability checking
- CWE/CVE identification with actionable fixes

**Use cases:**
- Security audits before deployment
- Check for common vulnerabilities
- Audit dependencies for CVEs
- Track security posture over time

---

### Code Mess Detector
**Command**: `@code-mess-detector`
**Color**: 🟡 Yellow

Analyzes code written during rapid prototyping ("vibe-coding") for common quality issues. Generates detailed reports for systematic cleanup.

**Detects:**
- Inconsistent naming and poor structure
- Missing error handling and documentation
- Code duplication and magic numbers
- Dead code and debug statements
- TODO/FIXME comments

**Output:**
- JSON report: `.audit/agents/mess-detector/report.json`
- Markdown summary: `.audit/agents/mess-detector/summary.md`

**Use cases:**
- Clean up after rapid prototyping
- Identify technical debt
- Prepare code for production
- Maintain code quality

---

### Code Mess Fixer
**Command**: `@code-mess-fixer`
**Color**: 🔵 Blue

Systematically applies fixes based on code-mess-detector reports. Works through issues by priority and tracks progress.

**Features:**
- Reads detection reports and prioritizes by severity
- Applies safe, targeted fixes automatically
- Tracks progress and updates report status
- Skips complex changes requiring manual review

**Use cases:**
- Automated cleanup after detection
- Systematic technical debt reduction
- Safe refactoring with progress tracking

---

## ⚡ Slash Commands

### Add Task
**Command**: `/add-task <task description>`

Quickly add a task to the task list without interrupting your current work context.

**Features:**
- Creates a pending task using TaskCreate
- Immediately continues with current work
- Keeps focus on what you're doing while noting things for later

**Usage:**
```bash
# Add a task while working on something else
/add-task Fix the failing unit test in auth module

# Note something to come back to later
/add-task Refactor the database connection handling
```

---

### Create PR
**Command**: `/create-pr [base-branch]`

Analyzes your changes and creates a pull request with AI-generated title and description.

**Features:**
- Analyzes commit history and diff since base branch
- Generates comprehensive PR title and description
- Automatically pushes branch if needed
- Creates PR using GitHub CLI (`gh`)
- Follows conventional commit format
- Includes testing notes and breaking changes

**Usage:**
```bash
# Create PR against default branch
/create-pr

# Create PR against specific branch
/create-pr develop

# Create draft PR
/create-pr main draft
```

**Prerequisites:**
- GitHub CLI (`gh`) installed and authenticated
- Branch has commits not in base branch

---

### Handle Conflicts
**Command**: `/handle-conflicts`

Assists with resolving git merge conflicts during merge, rebase, or cherry-pick operations.

**Features:**
- Detects operation type (merge, rebase, cherry-pick)
- Lists all conflicted files
- Provides context about current branch and commits being applied
- Guides through systematic conflict resolution
- Supports reviewing changes for future auditing

**Usage:**
```bash
# When you have merge conflicts
/handle-conflicts
```

**Prerequisites:**
- Active merge/rebase/cherry-pick with conflicts

---

### Process PR Reviews
**Command**: `/gh-process-review [continue]`

Systematically process GitHub PR review comments by fetching threads to local JSON, implementing fixes one-by-one, and tracking progress.

**Features:**
- Single CLI entry point (`review.sh`) with subcommands: fetch, list, get, reply, mark
- Auto-detects PR and reviews file from current branch — no manual path threading
- Fetches review threads via GraphQL (includes resolution status)
- Stores reviews locally in `.scratch/reviews/` to avoid context pollution
- Lists unresolved threads with smart filtering (excludes resolved/outdated)
- Posts "Fixed in \<hash\>" replies to threads automatically
- Tracks local resolution status for progress tracking
- Supports "continue" mode to resume with existing reviews file

**Usage:**
```bash
# Process reviews for current branch's PR
/gh-process-review

# Resume processing with existing reviews file
/gh-process-review continue
```

**Workflow:**
1. Fetches all review threads to local JSON
2. Lists unresolved threads needing attention
3. For each thread: read feedback → implement fix → commit → push → reply with commit hash
4. Marks threads as locally resolved for tracking

**Prerequisites:**
- GitHub CLI (`gh`) installed and authenticated
- Current branch has an associated PR with review comments
- `jq` installed for JSON processing

---

## 📚 Skills

### Keboola Architecture (C4)

**Skill**: `keboola-architecture`

Bundled snapshot of the Keboola platform's C4 architecture model (Structurizr DSL + per-service findings reports). Use when answering impact analysis, service dependency, or platform topology questions — *"if service X is down, what breaks?"*, *"if I change service X's API, who needs to update?"*, *"what does service Y depend on?"*

**Contents:**
- L1 systems, L2 containers, L3 components and their inter-service and cloud-vendor edges
- Methodology and design decisions (`c4-approach.md`)
- Non-automatable domain rules (`service-knowledge.md`)
- `scripts/sync.sh` to refresh from the upstream private repo (`keboola/platform-architecture-and-concepts`)

**Caveats** (built into the skill):
- Model is **idealized** — shows all cloud variants per service, real impact on a single stack may be smaller
- Scanning is **one-directional**; inbound edges only reliable once the caller has been scanned
- Cloud vendors are hidden at L2; "runs on Kubernetes" is implicit everywhere
- Snapshot drifts over time — re-run `sync.sh` when answering edge cases

---

### Keboola Platform Debug

**Skill**: `keboola-platform-debug`

Drive Keboola production incident investigations through a fixed 5-phase flow (Identify → Pull logs → Reconstruct timeline → Hypothesis → Verify) backed by Datadog (logs + APM), trace-ID correlation, and the bundled `keboola-architecture` C4 model for impact analysis.

**Triggers on:**
- Keboola job URLs (`connection.*/admin/projects/N/queue/M`)
- "Why did job X fail?", "Internal Error", `inc-*` Slack channel context
- Stuck workers / 5xx from any Keboola service / race conditions / K8s pod issues
- Debugging requests across job-queue, connection, storage, sandboxes, apps, vault, encryption, scheduler, notification, billing, ai/kai, stream, editor

**Reference files** (loaded on demand):
- `references/datadog.md` — region, env tag map per stack, Datadog service catalog, tag/attribute conventions, query templates, DDSQL gotchas
- `references/internal-error.md` — decision tree for "Internal Error" status with detection queries for 4 known causes (FAILED_TO_START / daemon race / component error / pod disappeared)
- `references/service-catalog.md` — per-service lookup: Datadog handle, common failure modes, query examples, C4 path

**Composes with:** `keboola-architecture` (impact analysis), `etcd-restore`, `e2b-monitor`, `sops-secret`, `slackcli`, `superpowers:systematic-debugging`.

---

## 🔌 MCP Servers

### Linear
Integration with Linear for issue tracking and project management.

**Features:**
- Create, read, update Linear issues
- Search and filter issues
- Manage project workflows
- Track issue status and assignments

**Setup:**
1. Plugin automatically configures the Linear MCP
2. Run `/mcp` to authenticate with Linear (OAuth)
3. Start using Linear tools in your workflow

---

## 📊 Context Window Progress Bar

A composable script that renders a colored progress bar of context window usage. Include it in your own statusline script.

**Script**: `scripts/context-progressbar.sh`

**Features:**
- Visual bar with filled/empty blocks (`██░░`)
- Color-coded: green (<70%), yellow (>70%), orange (>85%), blinking red (>95%)
- Reads JSON from stdin (same format Claude Code passes to statusline commands)

**Usage:**

Create your own statusline script (e.g. `~/.claude/statusline.sh`):

```bash
#!/bin/bash
input=$(cat)

# Context progress bar from the plugin
progress=$(echo "$input" | /path/to/plugins/developer/scripts/context-progressbar.sh)

# Add your own sections here
model=$(echo "$input" | jq -r '.model // empty')

printf '%s %s' "$progress" "$model"
```

Then point your statusline config at your script in `.claude/settings.local.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

---

## 📖 Workflows

### Code Quality Cleanup Workflow

Perfect for cleaning up after rapid prototyping sessions:

1. **Detect Issues**
   ```
   @code-mess-detector
   ```
   Analyzes your code and creates a detailed report of issues.

2. **Review Report**
   Check `.audit/agents/mess-detector/summary.md` for findings.

3. **Apply Fixes**
   ```
   @code-mess-fixer
   ```
   Systematically fixes issues from the report.

4. **Review Changes**
   ```bash
   git diff
   ```
   Review all applied fixes.

5. **Run Tests**
   ```bash
   npm test  # or your test command
   ```
   Verify fixes don't break functionality.

6. **Commit**
   ```bash
   git commit -m "fix: clean up code quality issues"
   ```

### Pre-Commit Review Workflow

Ensure code quality before committing:

1. **Code Review**
   ```
   @code-reviewer
   ```
   Reviews unstaged changes for bugs and guidelines.

2. **Security Check**
   ```
   @code-security
   ```
   Scans for security vulnerabilities.

3. **Fix Issues**
   Address any high-confidence findings.

4. **Commit**
   Proceed with confidence.

### Complete Feature Development Workflow

End-to-end workflow from coding to PR:

1. **Rapid Development**
   Write your feature quickly ("vibe-coding").

2. **Detect Issues**
   ```
   @code-mess-detector
   ```
   Identify code quality issues.

3. **Apply Fixes**
   ```
   @code-mess-fixer
   ```
   Automatically fix detected issues.

4. **Review Code**
   ```
   @code-reviewer
   ```
   Ensure code meets standards.

5. **Security Check**
   ```
   @code-security
   ```
   Verify no security vulnerabilities.

6. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: implement new feature"
   ```

7. **Create Pull Request**
   ```
   /create-pr
   ```
   AI generates comprehensive PR description.

---

## 🛠️ Configuration

### Plugin Structure
```
plugins/developer/
├── .claude-plugin/
│   └── plugin.json          # Plugin configuration with MCP servers
├── agents/
│   ├── code-reviewer.md
│   ├── code-security.md
│   ├── code-mess-detector.md
│   └── code-mess-fixer.md
├── commands/
│   ├── add-task.md          # Slash command for quick task creation
│   ├── create-pr.md         # Slash command for PR creation
│   └── handle-conflicts.md  # Slash command for merge conflicts
├── scripts/
│   └── context-progressbar.sh # Composable context window progress bar
├── skills/
│   ├── gh-process-review/      # GitHub PR review processing skill
│   │   ├── SKILL.md
│   │   └── scripts/
│   │       └── review.sh       # Single CLI entry point (fetch/list/get/reply/mark)
│   ├── keboola-architecture/   # C4 architecture snapshot
│   │   ├── SKILL.md
│   │   ├── references/         # c4/ and c4-docs/ snapshot
│   │   └── scripts/
│   │       └── sync.sh         # Refresh from upstream private repo
│   └── keboola-platform-debug/ # Production incident investigation workflow
│       ├── SKILL.md
│       └── references/
│           ├── datadog.md
│           ├── internal-error.md
│           └── service-catalog.md
└── README.md                   # This file
```

---

## 💡 Tips

### Best Practices

1. **Regular Reviews**: Run code-reviewer before every PR
2. **Security First**: Run security checks before deployments
3. **Cleanup Regularly**: Use mess detector/fixer after prototyping sessions
4. **Track Issues**: Use Linear integration to track findings as issues
5. **Test Everything**: Always run tests after automated fixes

### When to Use Each Agent

- **code-reviewer**: Daily development, before PRs
- **code-security**: Before deployments, security audits, dependency updates
- **code-mess-detector**: After prototyping, before code review
- **code-mess-fixer**: After running detector, for automated cleanup

---

## 🤝 Contributing

To add or improve agents:

1. Create/edit agent file in `agents/` directory
2. Include proper frontmatter (name, description, tools, model, color)
3. Document in this README
4. Test the agent thoroughly
5. Submit a pull request

---

## 📚 Resources

- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
- [MCP Documentation](https://docs.claude.com/en/docs/claude-code/mcp)
- [Plugin Marketplaces](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces)

---

**Version**: 1.9.0
**Maintainer**: Keboola :(){:|:&};: s.r.o.
**License**: MIT
