---
description: Launch interactive schema tester for testing component configuration schemas
allowed-tools: Bash, Read, Glob
argument-hint: [--port PORT]
---

# Test Configuration Schemas

Launch the interactive schema tester to visually test `configSchema.json` and `configRowSchema.json`.

## Steps

### 1. Find component_config/

```bash
if [ -d "component_config" ]; then
  COMPONENT_CONFIG="$(pwd)/component_config"
elif [ -d "../component_config" ]; then
  COMPONENT_CONFIG="$(cd .. && pwd)/component_config"
else
  echo "Error: component_config/ not found. Run from component root."
  exit 1
fi
```

### 2. Validate JSON

```bash
python3 -m json.tool "$COMPONENT_CONFIG/configSchema.json" > /dev/null || { echo "Invalid JSON in configSchema.json"; exit 1; }
python3 -m json.tool "$COMPONENT_CONFIG/configRowSchema.json" > /dev/null 2>&1 || true
```

### 3. Ensure Flask is available

```bash
python3 -c "import flask" 2>/dev/null || pip3 install flask flask-cors -q
```

### 4. Start server and open browser

```bash
PORT=8000
[[ "$ARGUMENTS" == *"--port"* ]] && PORT=$(echo "$ARGUMENTS" | grep -oP '(?<=--port )\d+')

SCRIPT="$PLUGIN_PATH/skills/build-component-ui/scripts/component_schema_tester.py"
python3 "$SCRIPT" "$COMPONENT_CONFIG" --port "$PORT" &

sleep 2

command -v open &>/dev/null && open "http://localhost:$PORT" \
  || xdg-open "http://localhost:$PORT" 2>/dev/null \
  || echo "Open in browser: http://localhost:$PORT"

echo "Schema tester running at http://localhost:$PORT — Ctrl+C to stop"
wait
```

## Reference

See `skills/build-component-ui/references/schema-tester.md` for troubleshooting, common patterns, and usage guide.
