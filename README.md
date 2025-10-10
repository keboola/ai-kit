# Welcome to the Company-Wide Prompt Hub 🚀

This repository is the central library for all AI prompts and agent configurations used across the organization. Its purpose is to foster collaboration, maintain high standards, and accelerate our work by sharing effective and well-tested prompts and specialized agents.

## Repository Structure

The hub is organized into a plugin-based architecture to make prompts and agents easy to discover and use:

- **`/plugins`**: Contains specialized agent configurations organized by use case:
  - **`/plugins/developer`**: Development-focused agents and prompts
    - **`/plugins/developer/agents`**: Claude Code agent configurations
      - `code-reviewer.md`: Expert code reviewer for bugs, security, quality, and project guidelines
      - `code-security.md`: Security-focused review across multiple languages with automated scanning
- **`.claude-plugin`**: Configuration for Claude Code plugin integration
- **`README.md`**: (This file) The main entry point and guide for the repository
- **`LICENSE`**: MIT license for the repository

## Available Agents

### Developer Agents

#### Code Reviewer (`code-reviewer`)
Expert code reviewer specializing in modern software development. Reviews code for:
- Project guidelines compliance (CLAUDE.md conventions)
- Bug detection (logic errors, security vulnerabilities)
- Code quality issues
- Uses confidence-based filtering (≥80%) to report only high-priority issues

**Model**: Sonnet | **Color**: Green

#### Security Agent (`security`)
Pragmatic application security engineer for multi-language code review. Features:
- Cross-language security analysis (Python, Go, PHP, JavaScript, etc.)
- Automated security scanning (bandit, gosec, semgrep, npm audit, etc.)
- Dependency vulnerability checking
- CWE/CVE identification with actionable fixes
- Tracks security posture across commits

**Model**: Sonnet | **Color**: Red

## How to Contribute

We encourage everyone to contribute! A great prompt or agent can save your colleagues hours of work. The basic workflow is:

1.  **Create a New Branch**: Always start by creating a new branch for your changes (`git checkout -b your-feature-name`)
2.  **Add or Edit an Agent/Prompt**:
    - Find the appropriate plugin directory (`/plugins/<category>/agents/`)
    - Create a new `.md` file following the existing agent structure
    - Include frontmatter with name, description, tools, model, and color
3.  **Commit Your Changes**: Write a clear commit message describing your contribution
4.  **Submit a Pull Request (PR)**: Push your branch to GitHub and open a Pull Request to merge it into the `main` branch
5.  **Request a Review**: Assign a colleague or your team lead to review your PR for quality and clarity

## Using Agents in Your Projects

### Claude Code Integration

These agents are designed to work with Claude Code. To use them:

1. **Clone or sync the repository** to your local machine
2. **Link the agents** to your project using Claude Code's plugin system
3. **Invoke agents** directly from Claude Code using the agent name (e.g., `/code-reviewer` or `/security`)

For development use cases, you can clone the entire repository or set up a sparse checkout of specific plugin directories you need.

MIT licensed, see [LICENSE](./LICENSE) file.
