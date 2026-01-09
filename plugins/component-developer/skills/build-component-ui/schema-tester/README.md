# Component Schema Tester

A unified, flexible testing tool for Keboola component schemas with auto-discovery and manual path selection.

## Quick Start

### Option 1: Auto-discovery (from component directory)
```bash
cd /path/to/your/component
python component_schema_tester.py
```

### Option 2: Specify component path
```bash
# From anywhere - provide component root path
python component_schema_tester.py /path/to/component

# Or provide component_config path directly
python component_schema_tester.py /path/to/component/component_config

# Specify custom port
python component_schema_tester.py /path/to/component --port 8080
```

### Option 3: Manual path selection in UI
```bash
# Start with any component, then change paths in the UI
python component_schema_tester.py /path/to/component1

# In browser: Use 📁 button to select different component_config folder
# Click "🔄 Reload Schemas" to apply
```

Then open: **http://localhost:8000**

That's it! Schemas load automatically.

## Features

### Auto-Discovery
- Automatically finds `component_config/` folder
- Loads `configSchema.json` and `configRowSchema.json`
- Pre-fills forms from `data/config.json` if it exists
- No configuration needed!

### Integrated Sync Actions
- All sync actions are handled automatically
- Calls your component methods directly
- No need to specify endpoints
- Supports all action types:
  - `testConnection`
  - `loadEntities`
  - `loadFields`
  - `loadPossiblePrimaryKeys`
  - `loadIncrementalFields`
  - `loadNavigationProperties`
  - `previewData`
  - `validateFilter`

### Smart Features
- **Watch Fields**: Automatically reloads dropdowns when dependencies change
- **Auto-load**: Dropdowns with `autoload: true` load on page start
- **Pre-filled Config**: Loads existing `data/config.json` values
- **Live Validation**: Real-time schema validation
- **Conditional Fields**: Full support for `options.dependencies`
- **Combined Output**: See complete `config.json` ready for Keboola

## How It Works

### 1. Auto-Discovery Process

```
component_schema_tester.py
    ↓
Searches upward for component_config/
    ↓
Finds project root
    ↓
Loads schemas: configSchema.json + configRowSchema.json
    ↓
Loads config (if exists): data/config.json
    ↓
Starts Flask server on port 8000
```

### 2. API Endpoints

The tool provides these endpoints:

- `GET /` - Serves the schema tester UI
- `GET /api/schemas` - Returns both schemas
- `GET /api/config` - Returns existing config.json parameters
- `POST /sync-action` - Handles all sync actions

### 3. Sync Action Flow

```
UI (dropdown) → POST /sync-action
    ↓
Write config to data/config.json
    ↓
Import Component from src/component.py
    ↓
Call action method (e.g., comp.load_entities())
    ↓
Return result to UI
    ↓
Update dropdown options
```

## Usage Examples

### Testing Conditional Fields

1. Edit your schema to add conditional fields:
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

2. Click "Reload Schemas"
3. Change `sync_type` to "incremental"
4. Watch `incremental_field` appear!

### Testing Async Dropdowns

1. Your schema has async dropdown:
   ```json
   {
     "entity_set": {
       "type": "string",
       "format": "select",
       "options": {
         "async": {
           "label": "Load Entity Sets",
           "action": "loadEntities",
           "autoload": true
         }
       }
     }
   }
   ```

2. The tester will:
   - Auto-load on page start (if `autoload: true`)
   - Add "Load Entity Sets" button
   - Call your `Component.load_entities()` method
   - Populate dropdown with results

### Testing with Existing Config

If you have `data/config.json`:

```json
{
  "parameters": {
    "base_url": "https://api.example.com",
    "api_key": "test123",
    "entity_set": "Products"
  }
}
```

The tester will:
1. Load the config on page start
2. Split parameters between component and row schemas
3. Pre-fill all form fields
4. Ready for testing!

## Development Workflow

### 1. Edit Schemas
```bash
vim component_config/configSchema.json
vim component_config/configRowSchema.json
```

### 2. Reload in Browser
Click "🔄 Reload Schemas" button

### 3. Test Changes
- Change values
- Test conditional fields
- Test async dropdowns
- Validate forms

### 4. Copy Final Config
Go to "Resulting configuration" tab and click "📋 Copy to Clipboard"

## Requirements

The tool requires these Python packages (already in your `pyproject.toml`):

```toml
[tool.poetry.group.dev.dependencies]
flask = "^3.0.0"
flask-cors = "^4.0.0"
```

## Troubleshooting

### "Could not find component_config/ folder"

**Solution**: Run the script from within your component project:

```bash
cd /path/to/your/component
python component_schema_tester.py
```

### "Could not import Component"

**Solution**: Ensure `src/component.py` exists and has a `Component` class.

### "Unknown action: myAction"

**Solution**: Add the action to the `action_map` in `component_schema_tester.py`:

```python
action_map = {
    'myAction': comp.my_action,
    # ... other actions
}
```

## Advantages Over Old Setup

### Before (Multiple Files)
```
tools/schema-tester/
├── server.py           # Flask server
├── schema-tester.html  # UI
├── start-server.sh     # Startup script
└── README.md           # Documentation
```

Required:
- Manual path configuration
- Separate HTML file
- Shell script to run
- Manual config.json setup

### After (Single File)
```
component_schema_tester.py  # Everything!
```

Features:
- Auto-discovers everything
- Embedded HTML (no external files)
- Pre-fills from config.json
- Direct component integration
- Zero configuration

## File Structure

```python
component_schema_tester.py
├── Auto-discovery functions
│   ├── find_project_root()
│   ├── find_component_config()
│   └── find_config_json()
├── Flask app setup
│   └── CORS enabled
├── API endpoints
│   ├── GET /
│   ├── GET /api/schemas
│   ├── GET /api/config
│   └── POST /sync-action
├── Embedded HTML
│   └── Complete schema-tester UI
└── Main entry point
    └── Auto-discover and start
```

## Tips

1. **Always reload after schema changes**: Click the reload button to see updates
2. **Check browser console**: Useful for debugging sync actions
3. **Use "Validate Form"**: Catches schema validation errors
4. **Test all tabs**: Component, Row, and Combined configs
5. **Copy final config**: Use the clipboard button in "Resulting configuration" tab

## Support

For issues or questions:
1. Check browser console for errors
2. Check terminal output for Flask logs
3. Verify your schemas are valid JSON
4. Ensure `src/component.py` has required methods

## License

Part of the Keboola Component Factory toolkit.
