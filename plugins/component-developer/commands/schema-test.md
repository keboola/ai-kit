---
description: Launch interactive schema tester for testing component configuration schemas
allowed-tools: Bash, Read, Glob
argument-hint: [--component | --row]
---

# Test Configuration Schemas

Launch the interactive schema tester to test and validate component configuration schemas (`configSchema.json` and `configRowSchema.json`).

## What This Command Does

1. **Finds schemas** - Locates `component_config/` directory
2. **Validates schemas** - Checks JSON syntax and structure
3. **Starts schema-tester** - Launches Flask server with interactive UI
4. **Opens browser** - Automatically opens `http://localhost:8000`
5. **Monitors changes** - Auto-reloads on schema changes

## Usage

```bash
# Test both schemas (default)
/schema-test

# Test only component schema
/schema-test --component

# Test only row schema
/schema-test --row

# Use custom port
/schema-test --port 8080

# Specify component path
/schema-test /path/to/component
```

## Instructions

### Step 1: Locate Component Config Directory

Find the `component_config/` directory:

```bash
# Check current directory
if [ -d "component_config" ]; then
  COMPONENT_CONFIG="$(pwd)/component_config"
elif [ -d "../component_config" ]; then
  COMPONENT_CONFIG="$(cd .. && pwd)/component_config"
else
  echo "Error: component_config/ directory not found"
  echo ""
  echo "Make sure you're in a component directory with:"
  echo "   component_config/configSchema.json"
  echo "   component_config/configRowSchema.json"
  exit 1
fi

echo "✓ Found component_config: $COMPONENT_CONFIG"
```

### Step 2: Validate Schemas Exist

Check that schema files exist and are valid JSON:

```bash
# Check for schemas
COMPONENT_SCHEMA="$COMPONENT_CONFIG/configSchema.json"
ROW_SCHEMA="$COMPONENT_CONFIG/configRowSchema.json"

if [ ! -f "$COMPONENT_SCHEMA" ]; then
  echo "⚠ Component schema not found: $COMPONENT_SCHEMA"
  echo "Creating minimal schema..."
  cat > "$COMPONENT_SCHEMA" << 'EOF'
{
  "type": "object",
  "title": "Configuration",
  "required": [],
  "properties": {
    "debug": {
      "type": "boolean",
      "title": "Debug Mode",
      "default": false
    }
  }
}
EOF
  echo "✓ Created minimal configSchema.json"
fi

if [ ! -f "$ROW_SCHEMA" ]; then
  echo "⚠ Row schema not found: $ROW_SCHEMA"
  echo "Creating minimal schema..."
  cat > "$ROW_SCHEMA" << 'EOF'
{
  "type": "object",
  "title": "Row Configuration",
  "required": [],
  "properties": {
    "name": {
      "type": "string",
      "title": "Row Name"
    }
  }
}
EOF
  echo "✓ Created minimal configRowSchema.json"
fi

# Validate JSON syntax
echo "Validating schemas..."
python3 -m json.tool "$COMPONENT_SCHEMA" > /dev/null || {
  echo "Error: Invalid JSON in $COMPONENT_SCHEMA"
  exit 1
}
python3 -m json.tool "$ROW_SCHEMA" > /dev/null || {
  echo "Error: Invalid JSON in $ROW_SCHEMA"
  exit 1
}

echo "✓ Schemas are valid JSON"
```

### Step 3: Locate Schema Tester Tool

Find the schema-tester in the plugin:

```bash
# Get path to schema-tester tool
SCHEMA_TESTER_PATH="$PLUGIN_PATH/skills/build-component-ui/schema-tester"

if [ ! -f "$SCHEMA_TESTER_PATH/component_schema_tester.py" ]; then
  echo "Error: schema-tester not found"
  echo "Expected: $SCHEMA_TESTER_PATH/component_schema_tester.py"
  exit 1
fi

echo "✓ Found schema-tester: $SCHEMA_TESTER_PATH"
```

### Step 4: Check Dependencies

Ensure Flask is installed:

```bash
# Check if Flask is available
python3 -c "import flask" 2>/dev/null || {
  echo "⚠ Flask not installed"
  echo "Installing flask and flask-cors..."
  pip3 install flask flask-cors
}

echo "✓ Dependencies ready"
```

### Step 5: Start Schema Tester

Launch the Flask server:

```bash
# Parse port from arguments (default 8000)
PORT=8000
if [[ "$ARGUMENTS" == *"--port"* ]]; then
  PORT=$(echo "$ARGUMENTS" | grep -oP '(?<=--port )\d+')
fi

echo ""
echo "🚀 Starting schema tester..."
echo "   Component: $(basename $(dirname $COMPONENT_CONFIG))"
echo "   Port: $PORT"
echo "   URL: http://localhost:$PORT"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run schema tester
cd "$SCHEMA_TESTER_PATH"
python3 component_schema_tester.py "$COMPONENT_CONFIG" --port $PORT &
TESTER_PID=$!

# Wait for server to start
sleep 2

# Check if server started successfully
if ! kill -0 $TESTER_PID 2>/dev/null; then
  echo "Error: Schema tester failed to start"
  exit 1
fi

echo "✓ Schema tester running (PID: $TESTER_PID)"
```

### Step 6: Open Browser

Automatically open the browser:

```bash
# Open browser based on OS
if command -v xdg-open &> /dev/null; then
  xdg-open "http://localhost:$PORT"
elif command -v open &> /dev/null; then
  open "http://localhost:$PORT"
else
  echo "Open in browser: http://localhost:$PORT"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
```

### Step 7: Provide Usage Instructions

Show user how to use the tester:

```bash
echo "📖 Schema Tester Guide:"
echo ""
echo "1. **Test Forms**"
echo "   • Component tab: Test configSchema.json"
echo "   • Row tab: Test configRowSchema.json"
echo "   • Fill fields and see validation"
echo ""
echo "2. **Test Conditional Fields**"
echo "   • Change dropdown values"
echo "   • Watch fields show/hide based on dependencies"
echo "   • Verify options.dependencies work correctly"
echo ""
echo "3. **Test Sync Actions**"
echo "   • Click buttons (Test Connection, Load Data, etc.)"
echo "   • Verify dynamic dropdowns populate"
echo "   • Check autoload behaviors"
echo ""
echo "4. **Manual Path Selection**"
echo "   • Click 📁 button to browse for different component_config"
echo "   • Click 🔄 to reload schemas after changes"
echo ""
echo "5. **Reload on Changes**"
echo "   • Edit configSchema.json or configRowSchema.json"
echo "   • Click 🔄 Reload Schemas to see changes"
echo "   • No need to restart server"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Wait for user to stop (Ctrl+C)
wait $TESTER_PID
```

## Features of Schema Tester

### Auto-Discovery
- Automatically finds `component_config/` folder
- Loads both configSchema.json and configRowSchema.json
- Reads existing config.json and pre-fills forms

### Interactive Testing
- **Real-time validation** - See errors as you type
- **Conditional fields** - Test options.dependencies behavior
- **Sync actions** - Test button clicks and dynamic dropdowns
- **Multiple tabs** - Switch between component and row schemas

### Change Detection
- Click "🔄 Reload Schemas" to refresh after editing
- No need to restart server
- Preserves form values during reload

### Manual Configuration
- Click "📁" to browse for different component_config folder
- Test multiple components without restarting
- Quick switching between projects

## Common Schema Patterns to Test

### 1. Conditional Fields
```json
{
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
```
**Test:** Change auth_type dropdown, verify username shows/hides

### 2. Sync Actions
```json
{
  "database": {
    "type": "string",
    "format": "select",
    "options": {
      "async": {
        "action": "loadDatabases",
        "autoload": true
      }
    }
  }
}
```
**Test:** Verify dropdown populates on load

### 3. Test Connection Button
```json
{
  "test_connection": {
    "type": "button",
    "format": "test-connection",
    "options": {
      "async": {
        "label": "Test Connection",
        "action": "testConnection"
      }
    }
  }
}
```
**Test:** Click button, verify success/error message

### 4. Encrypted Fields
```json
{
  "#api_key": {
    "type": "string",
    "title": "API Key",
    "format": "password"
  }
}
```
**Test:** Verify field is masked, saved with # prefix

## Troubleshooting

### Port already in use
```bash
# Kill existing process on port 8000
lsof -ti:8000 | xargs kill -9

# Or use different port
/schema-test --port 8080
```

### Schema validation errors
```bash
# Validate JSON manually
python3 -m json.tool component_config/configSchema.json

# Check for common issues:
# - Missing commas
# - Trailing commas (not allowed in JSON)
# - Wrong quotes (use double quotes "")
```

### Sync actions not working
Make sure your component implements the sync action methods:
```python
# In src/component.py
def test_connection(self):
    return {"status": "success", "message": "Connected!"}

def load_databases(self):
    return {"status": "success", "options": ["db1", "db2"]}
```

### Browser doesn't open automatically
```bash
# Open manually
open http://localhost:8000
# or
xdg-open http://localhost:8000
```

## Safety Rules

1. **Read-only by default** - Doesn't modify your schemas
2. **No auto-save** - Changes in tester don't write back to files
3. **Safe reload** - Preserves form state when reloading schemas
4. **Port conflicts** - Detects and reports port issues

## Example Session

```
User: /schema-test
Assistant: Testing configuration schemas...

✓ Found component_config: /path/to/component/component_config
✓ Schemas are valid JSON
✓ Found schema-tester
✓ Dependencies ready

🚀 Starting schema tester...
   Component: ex-my-api
   Port: 8000
   URL: http://localhost:8000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Schema tester running (PID: 12345)
✓ Browser opened

📖 Schema Tester Guide:

1. **Test Forms**
   • Component tab: Test configSchema.json
   • Row tab: Test configRowSchema.json

2. **Test Conditional Fields**
   • Change dropdowns to see fields show/hide

3. **Test Sync Actions**
   • Click buttons to test dynamic loading

4. **Manual Path Selection**
   • Click 📁 to browse different component_config

5. **Reload on Changes**
   • Edit schemas, click 🔄 to reload

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Press Ctrl+C to stop the server

[Server running...]
```

## Reference

For schema development help:
- `@build-component-ui` - Schema design patterns
- `/review` - Review schema code
- Guides: skills/build-component-ui/references/

