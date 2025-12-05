# Keboola Schema Tester

Interactive HTML tool for testing Keboola configuration schemas with 100% UI parity to the Keboola platform.

## Features

✅ **100% Identical UI** - Uses the same library (@json-editor/json-editor) as Keboola
✅ **Conditional Fields** - Test `options.dependencies` show/hide behavior
✅ **Real-time JSON Output** - See generated configuration instantly
✅ **Tab Interface** - Test Component Config, Row Config, and Combined Config
✅ **Hot Reload** - Update schemas and reload without page refresh
✅ **Copy to Clipboard** - One-click copy of generated JSON

## Quick Start

### 1. Start the Server

```bash
cd ~/.claude/plugins/marketplaces/keboola-claude-kit/plugins/component-ui-developer/tools/schema-tester
./start-server.sh
```

### 2. Open in Browser

Navigate to: http://localhost:8000/

### 3. Point to Your Schemas

The tester automatically looks for schemas in your project's `component_config/` directory:
- `component_config/configSchema.json` - Component Configuration
- `component_config/configRowSchema.json` - Row Configuration

## Usage

### Testing Component Config

1. Click the "Component Config" tab
2. Fill in fields
3. Change dropdown values to test conditional fields
4. Check JSON output updates in real-time

### Testing Row Config

1. Click the "Row Config" tab
2. Test entity-specific settings
3. Verify conditional fields (e.g., incremental sync fields)

### Testing Combined Config

1. Click the "Combined Config" tab
2. See the complete `config.json` structure
3. Click "Copy to Clipboard" to use in tests

## Hot Reload

When you modify your schemas:

1. Save the schema file
2. Click "🔄 Reload Schemas" button
3. Changes appear instantly

No need to restart the server or refresh the page!

## Testing Conditional Fields

The schema tester is perfect for testing conditional fields:

### Example: Auth Type

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

**Test:**
1. Set auth_type to "basic" → username field appears
2. Set auth_type to "apiKey" → username field disappears

### Example: Sync Type

```json
{
  "properties": {
    "sync_type": {
      "type": "string",
      "enum": ["full", "incremental"]
    },
    "incremental_field": {
      "type": "string",
      "options": {
        "dependencies": {
          "sync_type": "incremental"
        }
      }
    }
  }
}
```

**Test:**
1. Set sync_type to "full" → incremental_field hidden
2. Set sync_type to "incremental" → incremental_field appears

## Troubleshooting

### Port 8000 Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill it
kill -9 <PID>

# Or use different port
python3 -m http.server 8001
```

### Schemas Not Loading

Make sure your project has the correct structure:

```
your-component/
├── component_config/
│   ├── configSchema.json
│   └── configRowSchema.json
└── ...
```

The tester looks for schemas at `../component_config/` relative to the tester location.

### Fields Not Appearing/Disappearing

If conditional fields don't work:

1. ✅ Check you're using `options.dependencies` (not root `dependencies`)
2. ✅ Check all properties are in flat structure (no `oneOf` nesting)
3. ✅ Check dependency values match exactly (e.g., "incremental" not "Incremental")
4. ✅ For booleans, use `true`/`false` (not strings `"true"`/`"false"`)

## Automated Testing

For automated E2E testing, use Playwright MCP. See `../playwright-setup/README.md`.

## Technical Details

### Libraries Used

- **@json-editor/json-editor** - Same as Keboola platform
- **Bootstrap 5** - UI framework
- **Vanilla JavaScript** - No build step needed

### How It Works

1. Loads schemas via fetch from `../component_config/`
2. Initializes two JSON Editor instances (component and row)
3. Listens for changes and updates JSON output
4. Handles conditional field visibility via `options.dependencies`

### Configuration

The tester uses these JSON Editor options:

```javascript
{
  schema: schema,
  theme: 'bootstrap5',
  iconlib: 'bootstrap',
  no_additional_properties: false,
  required_by_default: false,
  keep_oneof_values: false,
  use_default_values: true,
  show_errors: 'always'
}
```

## Integration with Development Workflow

### Recommended Workflow

1. **Design** - Draft schema structure
2. **Implement** - Write `configSchema.json`
3. **Test** - Use schema-tester to verify UI
4. **Iterate** - Fix issues, reload, test again
5. **Automate** - Write Playwright tests for critical paths
6. **Deploy** - Push to component repository

### Example Session

```bash
# Terminal 1: Start tester
cd ~/.claude/plugins/.../schema-tester
./start-server.sh

# Terminal 2: Edit schemas
cd ~/your-component
vim component_config/configSchema.json

# Browser: Test → Reload → Verify → Repeat
```

## Best Practices

1. **Test Early** - Start testing as soon as you have basic schema structure
2. **Test All Paths** - Try all combinations of conditional fields
3. **Test Edge Cases** - Empty values, required fields, validation
4. **Use with Playwright** - Automate repetitive tests
5. **Keep Running** - Leave server running during development for instant feedback

## Comparison with Keboola Platform

| Feature | Keboola Platform | Schema Tester | Match |
|---------|------------------|---------------|-------|
| Library | @json-editor/json-editor | @json-editor/json-editor | ✅ 100% |
| Conditional Fields | options.dependencies | options.dependencies | ✅ 100% |
| UI Theme | Bootstrap 5 | Bootstrap 5 | ✅ 100% |
| Field Types | All | All | ✅ 100% |
| Validation | Real-time | Real-time | ✅ 100% |

The tester provides **100% UI parity** with the Keboola platform!

## FAQ

**Q: Can I test sync actions?**
A: Not directly. Sync actions require backend API calls. Test these in actual Keboola platform or mock them in Playwright tests.

**Q: Can I test multiple configurations?**
A: Yes! Modify your schemas, click "Reload Schemas", and test different configurations.

**Q: Does it work with complex nested schemas?**
A: Yes, it supports all JSON Editor features including nested objects and arrays.

**Q: Can I use it for non-Keboola projects?**
A: Yes! It's a generic @json-editor testing tool. Just point it to any valid JSON Schema.

## Resources

- [Keboola Configuration Schema Docs](https://developers.keboola.com/extend/component/ui-options/configuration-schema/)
- [@json-editor/json-editor GitHub](https://github.com/json-editor/json-editor)
- [JSON Schema Specification](https://json-schema.org/)

## Version History

### 1.0.0 (2025-12-05)
- Initial release
- 100% UI parity with Keboola
- Conditional fields support (`options.dependencies`)
- Hot reload functionality
- Tab interface
- Real-time JSON output
