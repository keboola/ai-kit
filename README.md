# Welcome to Claude Kit 🚀

This repository is the central library for all AI prompts and agent configurations used across the organization. Its purpose is to foster collaboration, maintain high standards, and accelerate our work by sharing effective and well-tested prompts and specialized agents.

## Installation

Install skills using [skills tool](https://github.com/vercel-labs/skills): `npx skills add keboola/ai-kit`

Alternatively, install via the Claude Code plugin marketplace:

```bash
/plugin marketplace add keboola/claude-kit
```

After adding the marketplace, install the single unified plugin:

```bash
/plugin install keboola
```

> **Note:** As of marketplace v2.0.0 this repo ships **one** plugin, `keboola`,
> that consolidates the six former plugins (`component-developer`,
> `dataapp-developer`, `keboola-cli`, `keboola-git`, `powerbi-to-sl`,
> `sl-toolkit`). Installing it enables every area at once. Installing the plugin
> also wires up the Keboola MCP server for all areas — previously three of the
> old plugins were MCP-free.

## Repository Structure

The repository uses a single-plugin architecture; skills are grouped by area inside the plugin:

```
claude-kit/
├── .claude-plugin/
│   └── marketplace.json     # Marketplace configuration (one plugin entry)
├── plugins/
│   └── keboola/             # The unified Keboola plugin
│       ├── .claude-plugin/plugin.json
│       ├── README.md
│       ├── skills/          # 18 skills, flat: skills/<skill-name>/SKILL.md
│       ├── commands/        # 12 slash commands (all areas)
│       ├── agents/          # 14 agents (3 component + 11 CLI review)
│       └── tests/           # semantic-layer consistency tests
├── README.md                # This file
└── LICENSE                  # MIT license
```

## The `keboola` Plugin

**Location**: [`./plugins/keboola`](./plugins/keboola)

One plugin, every Keboola workflow. Skills are grouped by area (the grouping is
documentation only — skills live flat under `skills/<skill-name>/`, and their
invocation names are unchanged).

### Components — build production-ready Keboola Python components
- **Skills**: `develop-component`, `build-component-ui`, `debug-component`, `test-component` (datadir + unit/mock + VCR), `review` (code quality + backward compatibility), `get-started`, `migrate-to-uv`, `component-defaults`, `keboola-context`
- **Commands**: `/review`, `/schema-test`, `/generate-vcr-tests`
- **Agents**: `component-builder`, `ui-developer`, `tester`

### Data Apps — build & deploy Keboola Apps
- **Skills**: `dataapp-development` (Streamlit + Python/JS full lifecycle, 14 references, 5 templates), `mcp-data-app` (host an MCP server as a data app), `semantic-layer-usage` (confirm physical columns before querying)

### CLI — project management & review
- **Skills**: `keboola-cli`, `keboola-config`, `duckdb-transformation`
- **Commands**: `/kbc-init`, `/kbc-pull`, `/kbc-push`, `/kbc-diff`, `/kbc-review`
- **Agents (10-agent review team + analyzer)**: `kbc-sql-reviewer`, `kbc-config-reviewer`, `kbc-dwh-architect`, `kbc-data-quality-analyst`, `kbc-financial-analyst`, `kbc-semantic-layer-reviewer`, `kbc-security-auditor`, `kbc-performance-optimizer`, `kbc-template-readiness`, `kbc-review-consolidator`, `keboola-config-analyzer`

### Git — Keboola-managed Git (Forgejo) for data apps
- **Skill**: `keboola-git` (provision repos, mint push credentials, raw clone/push, 15MB/HTTP-413 build-at-deploy, deploy + verify)
- **Command**: `/keboola-git-copy` (bidirectional GitHub ↔ Keboola-git copy)

### Power BI — migrate Power BI semantic models
- **Skill**: `powerbi-to-sl` (TMDL or per-table JSON → Keboola semantic layer; DAX preserved verbatim; bundles `scripts/migrate.py`, `fixtures/`, `tests/`)

### Semantic Layer — inspect / validate / build + conversational CRUD
- **Skill**: `semantic-layer` (deep validation, cascade rename with rollback, multi-cloud)
- **Commands**: `/sl-show`, `/sl-validate`, `/sl-build`

**[→ View the Keboola Plugin Documentation](./plugins/keboola/README.md)**

## MCP Server Setup

The `keboola` plugin declares two MCP servers: `keboola` (remote HTTP, project/data
validation and live queries) and `playwright` (local, browser automation). Some
commands and agents require the Keboola MCP server. If MCP tools are not available
when running a command, use the `/mcp` command to authenticate and configure them.

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
- `.claude-plugin/marketplace.json` (both the marketplace `version` and the `keboola` plugin entry's `version`)
- `plugins/keboola/.claude-plugin/plugin.json`

## License

MIT licensed, see [LICENSE](./LICENSE) file.
