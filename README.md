# Welcome to Claude Kit 🚀

This repository is the central library for all AI prompts and agent configurations used across the organization. Its purpose is to foster collaboration, maintain high standards, and accelerate our work by sharing effective and well-tested prompts and specialized agents.

## Installation

### Using add-skill (Recommended)

The simplest way to install Claude Kit skills is using the [add-skill](https://github.com/vercel-labs/add-skill) package from Vercel Labs. This method works across multiple AI coding agents including Claude Code, Cursor, Codex, OpenCode, and more.

```bash
npx add-skill keboola/ai-kit
```

This command will automatically detect your installed AI coding agents and install the available skills to the appropriate directories.

**Prerequisites:**
- Node.js 18+
- npm or pnpm

**Options:**

```bash
# List available skills without installing
npx add-skill keboola/ai-kit --list

# Install to specific agents
npx add-skill keboola/ai-kit -a claude-code -a cursor

# Install specific skills only
npx add-skill keboola/ai-kit --skill component-builder --skill dataapp-dev

# Install globally (user directory instead of project)
npx add-skill keboola/ai-kit -g

# Non-interactive installation (CI/CD friendly)
npx add-skill keboola/ai-kit -y -g
```

**Supported Agents:**
- Claude Code (`.claude/skills/`)
- Cursor (`.cursor/skills/`)
- Codex (`.codex/skills/`)
- OpenCode (`.opencode/skills/`)
- GitHub Copilot (`.github/skills/`)
- And [many more](https://github.com/vercel-labs/add-skill#available-agents)

**Available Skills:**

| Skill | Plugin | Description |
|-------|--------|-------------|
| `component-builder` | component-developer | Build production-ready Keboola Python components |
| `get-started` | component-developer | Initialize new Keboola components with cookiecutter |
| `review-component` | component-developer | Review component code for best practices |
| `debug-component` | component-developer | Debug failing Keboola components |
| `test-component` | component-developer | Write comprehensive tests for components |
| `build-component-ui` | component-developer | Build configuration schemas and UI elements |
| `migrate-component-to-uv` | component-developer | Migrate components to uv package manager |
| `dataapp-dev` | dataapp-developer | Build Streamlit data apps for Keboola deployment |

**Verification:**

After installation, verify the skills are available by checking the appropriate directory for your agent:

```bash
# For Claude Code
ls .claude/skills/

# For Cursor
ls .cursor/skills/
```

### Using Claude Code Plugin Marketplace

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
