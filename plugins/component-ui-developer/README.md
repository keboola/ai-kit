# Keboola Component UI Developer

Expert agent for developing Keboola Component configuration schemas and UI.

## What This Plugin Does

This plugin specializes in:
- ✅ **Configuration Schemas** - Creating `configSchema.json` and `configRowSchema.json`
- ✅ **Conditional Fields** - Using correct `options.dependencies` syntax (not JSON Schema dependencies)
- ✅ **UI Elements** - All form elements, sync actions, buttons, etc.
- ✅ **Schema Testing** - Interactive schema tester with 100% Keboola UI parity
- ✅ **Automated Testing** - Playwright MCP integration for E2E schema tests

## Why This Plugin Exists

The main `component-developer` plugin is large and handles all aspects of component development. This specialized plugin focuses ONLY on UI/schema development, providing:
- 🎯 **Faster responses** - Smaller context, more focused
- 📚 **Better documentation** - Only UI-related guides
- 🧪 **Testing tools** - Schema tester and Playwright integration
- ✅ **Correct syntax** - Uses `options.dependencies` (not JSON Schema dependencies)

## Quick Start

### 1. Launch the UI Developer Agent

```bash
/plugin component-ui-developer ui-developer
```

### 2. Use the Schema Tester

The schema tester provides an interactive HTML interface for testing your schemas:

```bash
cd ~/.claude/plugins/marketplaces/keboola-claude-kit/plugins/component-ui-developer/tools/schema-tester
./start-server.sh
```

Then open: http://localhost:8000/

### 3. Run Automated Tests with Playwright

See `tools/playwright-setup/README.md` for Playwright MCP setup.

## When to Use This Plugin

Use `component-ui-developer` when you need to:
- Create or modify configuration schemas
- Add conditional fields (show/hide based on other fields)
- Test schema UI interactively
- Run automated E2E tests on schemas
- Debug UI issues
- Understand Keboola UI elements

Use `component-developer` for everything else:
- Component architecture
- API client development
- Data processing logic
- Keboola API integration
- Deployment

## Key Concept: Conditional Fields

⚠️ **IMPORTANT**: Keboola uses `options.dependencies`, NOT JSON Schema `dependencies`.

### ✅ Correct Syntax

```json
{
  "properties": {
    "auth_type": {
      "type": "string",
      "enum": ["basic", "apiKey"]
    },
    "username": {
      "type": "string",
      "options": {
        "dependencies": {
          "auth_type": "basic"
        }
      }
    }
  }
}
```

### ❌ Wrong Syntax (Don't Use)

```json
{
  "dependencies": {
    "auth_type": {
      "oneOf": [...]
    }
  }
}
```

The wrong syntax creates a switcher dropdown instead of dynamic show/hide.

## Tools

### Schema Tester

Interactive HTML tool for testing configuration schemas:
- 100% UI parity with Keboola platform
- Real-time JSON output
- Conditional fields testing
- Copy to clipboard
- Hot reload

Location: `tools/schema-tester/`

### Playwright Setup

Scripts for setting up Playwright MCP for automated testing:
- Installation guide
- Example test scripts
- Integration with schema-tester

Location: `tools/playwright-setup/`

## Guides

- **conditional-fields.md** - Quick reference for conditional fields
- **schema-basics.md** - Configuration schema fundamentals
- **ui-elements.md** - All available UI elements
- **sync-actions.md** - Dynamic field loading
- **examples.md** - Real-world examples

## Architecture

```
component-ui-developer/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── agents/
│   └── ui-developer.md          # Main agent
├── guides/
│   ├── conditional-fields.md    # Quick reference
│   ├── schema-basics.md
│   ├── ui-elements.md
│   ├── sync-actions.md
│   └── examples.md
└── tools/
    ├── schema-tester/           # Interactive testing tool
    │   ├── index.html
    │   ├── README.md
    │   └── start-server.sh
    └── playwright-setup/        # Automated testing setup
        ├── install.sh
        └── README.md
```

## Integration with component-developer

The `component-builder` agent in `component-developer` will automatically delegate UI tasks to this plugin:

```
User: "Add conditional fields to my schema"
↓
component-builder (orchestrator)
↓
component-ui-developer/ui-developer (specialist)
```

## Version History

### 1.0.0 (2025-12-05)
- Initial release
- Schema tester tool
- Playwright MCP integration
- Correct `options.dependencies` syntax
- Comprehensive guides

## Resources

- [Keboola Configuration Schema Docs](https://developers.keboola.com/extend/component/ui-options/configuration-schema/)
- [@json-editor/json-editor](https://github.com/json-editor/json-editor)
- [Playwright MCP](https://github.com/executeautomation/mcp-playwright)
