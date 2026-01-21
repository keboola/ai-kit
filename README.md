# Welcome to Claude Kit 🚀

This repository is the central library for all AI prompts and agent configurations used across the organization. Its purpose is to foster collaboration, maintain high standards, and accelerate our work by sharing effective and well-tested prompts and specialized agents.

## Installation

Install skills using [add-skill](https://github.com/vercel-labs/add-skill): `npx add-skill keboola/ai-kit`

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
│   └── developer/           # Developer toolkit plugin
│       ├── .claude-plugin/
│       │   └── plugin.json  # Plugin configuration
│       ├── agents/          # AI agents (code review, security, etc.)
│       ├── commands/        # Slash commands (PR creation, etc.)
│       ├── scripts/         # Automation scripts (settings install hook)
│       ├── templates/       # Configuration templates (settings.json)
│       └── README.md        # Plugin documentation
├── README.md                # This file
└── LICENSE                  # MIT license
```

## Available Plugins

### Developer Plugin

**Location**: [`./plugins/developer`](./plugins/developer)

A comprehensive toolkit for developers including specialized agents for code review, security analysis, code quality management, and workflow automation.

**Features:**
- 🤖 **4 Agents**: Code review, security analysis, code mess detection & fixing
- ⚡ **1 Command**: AI-powered PR creation
- 🔌 **1 MCP Server**: Linear integration
- 🔐 **Auto-install Settings**: SessionStart hook that installs team-wide permissions automatically

**[→ View Developer Plugin Documentation](./plugins/developer/README.md)**

### Component Developer Plugin

**Location**: [`./plugins/component-developer`](./plugins/component-developer)

A specialized toolkit for building production-ready Keboola Python components following best practices and architectural patterns.

**Features:**
- 🤖 **1 Agent**: Keboola component builder with comprehensive knowledge
- 🏗️ **Component Architecture**: Cookiecutter template integration
- 📋 **Configuration Schemas**: JSON Schema with UI elements
- 📊 **CSV Processing**: Memory-efficient patterns
- 🔄 **State Management**: Incremental data processing
- 🚀 **CI/CD Integration**: Developer Portal and deployment workflows

**[→ View Component Developer Plugin Documentation](./plugins/component-developer/README.md)**

### Data App Developer Plugin

**Location**: [`./plugins/dataapp-developer`](./plugins/dataapp-developer)

A specialized toolkit for building production-ready Streamlit data apps for Keboola deployment with a systematic validate → build → verify workflow.

**Features:**
- 🎯 **1 Skill**: Data app development with validate → build → verify workflow
- 🔍 **Data Validation**: Automatic schema checking using Keboola MCP
- 🎨 **Visual Verification**: Browser testing with Playwright MCP
- 🏗️ **SQL-First Architecture**: Best practices for scalable data apps
- 📚 **Comprehensive Docs**: Quickstart, workflows, templates, and checklists
- 🛡️ **Bug Prevention**: Catches common issues before they become problems
- 🔌 **2 MCP Servers**: Keboola (remote HTTP) and Playwright (browser automation)

**[→ View Data App Developer Plugin Documentation](./plugins/dataapp-developer/README.md)**

### Incident Commander Plugin

**Location**: [`./plugins/incident-commander`](./plugins/incident-commander)

A specialized toolkit for incident response, helping incident commanders create comprehensive post-mortem documents from Slack incident channels.

**Features:**
- **1 Command**: Post-mortem creation from Slack incident channels
- **Confluence Integration**: Reads templates and creates structured documents
- **Slack Integration**: Gathers incident information from channels and threads
- **Structured Output**: Overview, Impact, Timeline, Action Items, and more
- **Blameless Format**: Focuses on systems and processes, not individuals

**[→ View Incident Commander Plugin Documentation](./plugins/incident-commander/README.md)**

## MCP Server Setup

Some commands and plugins require MCP (Model Context Protocol) servers to be configured. If MCP tools are not available when running a command, use the `/mcp` command to authenticate and configure them.

### Atlassian (Confluence & Jira)

Required for commands like `/create-postmortem` that interact with Confluence.

```bash
claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse
```

After adding the MCP server, run `/mcp` to authenticate with your Atlassian account.

### Slack

Required for commands like `/create-postmortem` that read incident information from Slack channels.

**Step 1: Get Slack Tokens from Browser**

You need two tokens from your Slack workspace:
- **XOXC token**: User token for API access
- **XOXD token**: Cookie token for authentication

To extract these tokens:

1. Open your Slack workspace in a web browser (not the desktop app)
2. Open Developer Tools (F12 or Right-click → Inspect)
3. Go to the **Application** tab (Chrome) or **Storage** tab (Firefox)
4. In the left sidebar, expand **Cookies** and select your Slack workspace URL
5. Find the cookie named `d` - its value is your **XOXD token** (starts with `xoxd-`)
6. Go to the **Console** tab and run: `localStorage.getItem('localConfig_v2')` 
7. In the output, find the `teams` object and look for `token` - this is your **XOXC token** (starts with `xoxc-`)

**Step 2: Add Slack MCP Server**

```bash
claude mcp add --transport stdio slack-mcp-server \
  --env SLACK_MCP_XOXC_TOKEN=<SLACK_MCP_XOXC_TOKEN> \
  --env SLACK_MCP_XOXD_TOKEN=<SLACK_MCP_XOXD_TOKEN> \
  -- npx -y slack-mcp-server
```

Replace `<SLACK_MCP_XOXC_TOKEN>` and `<SLACK_MCP_XOXD_TOKEN>` with your actual tokens from Step 1.

**Step 3: Verify Setup**

Run `/mcp` to verify the Slack MCP server is working and you can access your workspace channels.

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
