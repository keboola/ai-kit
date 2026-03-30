# Schema Tester Reference

The schema tester is a local Flask server that renders your `configSchema.json` and `configRowSchema.json` using the real Keboola UI renderer. Launch it with `/schema-test`.

## Features

- **Auto-discovery** — finds `component_config/` automatically; loads existing `data/config.json` to pre-fill forms
- **Conditional fields** — test `options.dependencies` show/hide behavior in real time
- **Sync actions** — click buttons and verify dynamic dropdowns populate
- **Reload without restart** — edit schemas, click 🔄 to refresh; form values are preserved
- **Manual path selection** — click 📁 to switch to a different component_config

## Common Patterns to Test

### Conditional fields
Change the controlling dropdown and verify dependent fields show/hide:
```json
{
  "auth_type": { "type": "string", "enum": ["basic", "apiKey"] },
  "username": {
    "type": "string",
    "options": { "dependencies": { "auth_type": "basic" } }
  }
}
```

### Dynamic dropdown (sync action)
Verify the dropdown populates on load; confirm `"enum": []` is present:
```json
{
  "database": {
    "type": "string",
    "format": "select",
    "enum": [],
    "options": { "async": { "action": "loadDatabases", "autoload": true } }
  }
}
```

### Test connection button
Click the button and verify success/error message renders:
```json
{
  "test_connection": {
    "type": "button",
    "format": "test-connection",
    "options": { "async": { "label": "Test Connection", "action": "testConnection" } }
  }
}
```

### Encrypted fields
Verify the field is masked and the `#` prefix is preserved in output:
```json
{
  "#api_key": { "type": "string", "title": "API Key", "format": "password" }
}
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Port already in use | `lsof -ti:8000 \| xargs kill -9` or use `--port 8080` |
| Invalid JSON error | `python3 -m json.tool component_config/configSchema.json` to find the issue |
| Async button doesn't render | Add `"enum": []` to the field — required even for dynamic lists |
| Sync action returns nothing | Check component implements the method with `@sync_action` decorator |
| Browser doesn't open | Navigate manually to `http://localhost:8000` |
