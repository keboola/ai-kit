# Welcome to Claude Kit 🚀

This repository is the central library for all AI prompts and agent configurations used across the organization. Its purpose is to foster collaboration, maintain high standards, and accelerate our work by sharing effective and well-tested prompts and specialized agents.

## Installation

Install skills using [skills tool](https://github.com/vercel-labs/skills): `npx skills add keboola/ai-kit`

Alternatively, install via the Claude Code plugin marketplace:

```bash
/plugin marketplace add keboola/claude-kit
```

After installation, enable the plugins you need:

```bash
/plugin install developer
```

## Repository Structure

The repository is organized into a plugin-based architecture to make prompts and agents easy to discover and use:

```
claude-kit/
├── .claude-plugin/
│   └── marketplace.json     # Marketplace configuration
├── plugins/
│   ├── developer/           # Developer toolkit plugin
│   ├── component-developer/ # Keboola Python component development
│   ├── dataapp-developer/   # Data app development & deployment for Keboola
│   └── keboola-cli/         # Keboola project management and review
├── README.md                # This file
└── LICENSE                  # MIT license
```

## Available Plugins

### Developer Plugin

**Location**: [`./plugins/developer`](./plugins/developer)

A comprehensive toolkit for developers including specialized agents for code review, security analysis, code quality management, and workflow automation.

**Features:**
- 🤖 **Agents**: Code review, security analysis, code mess detection & fixing
- ⚡ **Commands**: Task management, PR creation, merge conflict resolution, GitHub PR review processing
- 📊 **Scripts**: Context window progress bar for statusline
- 🔌 **MCP Server**: Linear integration

**[→ View Developer Plugin Documentation](./plugins/developer/README.md)**

### Component Developer Plugin

**Location**: [`./plugins/component-developer`](./plugins/component-developer)

A specialized toolkit for building production-ready Keboola Python components following best practices and architectural patterns.

**Features:**
- 🎯 **Skills**: Build component, build UI, debug, test, VCR test, review, backward compatibility review, migrate to UV, getting started
- ⚡ **Commands**: Init, run, fix, review, migrate-repo, schema-test
- 🔌 **MCP Server**: Keboola integration
- 📋 **Configuration Schemas**: JSON Schema with UI elements
- 🚀 **CI/CD Integration**: Developer Portal and deployment workflows

**[→ View Component Developer Plugin Documentation](./plugins/component-developer/README.md)**

### Data App Developer Plugin

**Location**: [`./plugins/dataapp-developer`](./plugins/dataapp-developer)

A toolkit for building and deploying data apps to Keboola — Streamlit development with validate/build/verify workflow, plus deployment guides for Node.js, Python, and any web framework.

**Features:**
- 🎯 **Skill**: Single `dataapp-development` skill covering both Streamlit and Python/JS apps with 12 topical references
- 🚀 **App Types**: Streamlit (Code or Git), single Node.js + static (dashboarding default), combined Python + Node
- 💾 **Storage**: RO workspace (default), RW direct access via Query Service, input mapping (legacy)
- 🔒 **Authentication**: None / Basic / OIDC / GitHub / GitLab / JumpCloud
- ⚡ **Performance**: Opinionated DuckDB caching pattern (Python + Node templates included)
- 🎨 **Styling**: Default Keboola theme + brand customization paths
- 🤖 **Kai Integration**: Optional natural-language assistant via `kai-client`
- 📦 **Templates**: 5 runnable starters (Streamlit, Python-only, Node-only, Python+Node, DuckDB cache)
- 🔌 **MCP Servers**: Keboola (remote HTTP) and Playwright (browser automation)

**[→ View Data App Developer Plugin Documentation](./plugins/dataapp-developer/README.md)**

### Keboola CLI Plugin

**Location**: [`./plugins/keboola-cli`](./plugins/keboola-cli)

A project management and review toolkit for Keboola projects. Includes CLI sync commands and a 10-agent review team that audits SQL quality, security, performance, financial logic, data quality, and template readiness.

**Features:**
- 🤖 **Agents**: 10 specialized review agents (SQL, Config, DWH Architecture, Data Quality, Financial Logic, Semantic Layer, Security, Performance, Template Readiness, Consolidator) + config analyzer
- ⚡ **Commands**: `/kbc-init`, `/kbc-pull`, `/kbc-push`, `/kbc-diff`, `/kbc-review`
- 🔌 **MCP Server**: Keboola integration for live project analysis
- 📊 **Financial Intelligence**: Multi-ERP awareness (NetSuite, SAP, Oracle, D365, QuickBooks, Xero), SaaS metrics, budget variance
- 🔒 **Security Audit**: Credential scanning, PII detection, GDPR/CCPA compliance checks

**[→ View Keboola CLI Plugin Documentation](./plugins/keboola-cli/README.md)**

## MCP Server Setup

Some commands and plugins require MCP (Model Context Protocol) servers to be configured. If MCP tools are not available when running a command, use the `/mcp` command to authenticate and configure them.

### Troubleshooting

If you encounter "MCP tools not available" errors:
1. Run `/mcp` to see available MCP servers and their status
2. Authenticate with the required MCP server
3. Re-run your command

## Development

### Validation

Always validate your changes before committing:

```bash
claude plugin validate .
```

### Testing

Test agents and commands locally:

```bash
# Test an agent
@agent-name

# Test a command
/command-name
```

### Versioning

We follow semantic versioning. Update version numbers in:
- `.claude-plugin/marketplace.json`
- `plugins/<name>/.claude-plugin/plugin.json`
- `plugins/<name>/README.md`

## License

MIT licensed, see [LICENSE](./LICENSE) file.
