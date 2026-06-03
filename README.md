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
/plugin install component-developer
```

## Repository Structure

The repository is organized into a plugin-based architecture to make prompts and agents easy to discover and use:

```
claude-kit/
├── .claude-plugin/
│   └── marketplace.json     # Marketplace configuration
├── plugins/
│   ├── component-developer/ # Keboola Python component development
│   ├── dataapp-developer/   # Data app development & deployment for Keboola
│   ├── keboola-cli/         # Keboola project management and review
│   ├── keboola-git/         # Keboola-managed Git (Forgejo) access for data apps
│   ├── powerbi-to-sl/       # Migrate Power BI semantic models to Keboola
│   └── sl-toolkit/          # Semantic layer inspect, validate, build + conversational CRUD
├── README.md                # This file
└── LICENSE                  # MIT license
```

## Available Plugins

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
- 🎯 **Skills**: Streamlit development (validate → build → verify) + data app deployment (Nginx, Supervisord, Docker)
- 🚀 **Deployment**: keboola-config directory setup, SSE/WebSocket streaming through Nginx, env var mapping, common error solutions
- 🔍 **Data Validation**: Automatic schema checking using Keboola MCP
- 🎨 **Visual Verification**: Browser testing with Playwright MCP
- 🏗️ **Multi-Framework**: Node.js (Express), Python (Flask, FastAPI, Streamlit, Gunicorn), or any web framework
- 📚 **Comprehensive Docs**: Quickstart, workflows, templates, checklists, and deployment guides
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

### Keboola Git Plugin

**Location**: [`./plugins/keboola-git`](./plugins/keboola-git)

Access Keboola-managed Git (Forgejo) repos for python-js data apps via the `kbagent` CLI — provision repos, mint push credentials, push source with raw git, and deploy, including the ~15MB / HTTP 413 build-at-deploy path.

**Features:**
- 🎯 **Skill**: `keboola-git` — provision/find the managed repo, mint a one-time `git_clone_url`, raw clone/push, 413 + build-at-deploy recipe, deploy + verify
- ⚡ **Command**: `/keboola-git-copy to-keboola|to-github` — bidirectional GitHub ↔ Keboola git source copy with size guard and scratch-branch safety
- 📦 **Build-at-deploy**: untrack committed builds (`frontend/.next`), build in `keboola-config/setup.sh` to stay under the 15MB push cap
- 🔒 **Credential safety**: one-time push secrets kept in shell vars, never committed; no force-push, scratch-branch-only reverse copies
- 🛠️ **kbagent-CLI driven**: ships no MCP server

**[→ View Keboola Git Plugin Documentation](./plugins/keboola-git/README.md)**

### sl-toolkit Plugin

**Location**: [`./plugins/sl-toolkit`](./plugins/sl-toolkit)

Semantic layer tools for Keboola — inspect, validate, and build models via the metastore API. Works with or without the Semantic Layer data app.

**Features:**
- ⚡ **Commands**: `/sl-show`, `/sl-validate`, `/sl-build`
- 🗣️ **Conversational CRUD**: add/edit/remove entities by just asking — the `semantic-layer` skill handles it
- 🔑 **kbagent-free**: show, validate, and all CRUD require only a Storage API token
- 🔄 **Cascade rename**: editing a metric name auto-updates all constraint references, with rollback on failure
- ✅ **Deep validation**: phantom field and type-mismatch checks against actual Snowflake schemas
- 🏗️ **Greenfield wizard**: `sl-build` does full schema discovery → SQL analysis → generate → validate → push
- 🌐 **Multi-cloud**: supports GCP, AWS, and Azure stacks

**[→ View sl-toolkit Plugin Documentation](./plugins/sl-toolkit/README.md)**

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
