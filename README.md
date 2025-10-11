# Welcome to Claude Kit 🚀

This repository is the central library for all AI prompts and agent configurations used across the organization. Its purpose is to foster collaboration, maintain high standards, and accelerate our work by sharing effective and well-tested prompts and specialized agents.

## Installation

Run the following command to install Claude Kit marketplace:

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
