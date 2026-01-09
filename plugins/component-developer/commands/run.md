---
description: Run Keboola component locally with test data and display results
allowed-tools: Bash, Read, Glob, Write
argument-hint: [config-file]
---

# Run Component Locally

Run your Keboola component locally with test configuration and automatically display results.

## What This Command Does

1. **Validates environment** - Checks `data/config.json` exists
2. **Runs component** - Executes with `KBC_DATADIR=data`
3. **Monitors output** - Streams logs and errors in real-time
4. **Shows results** - Displays output tables and files
5. **Summarizes execution** - Shows success/failure with timing

## Usage

```bash
# Run with default data/config.json
/run

# Run with specific config file
/run data/config-test.json

# Run with custom data directory
/run --datadir=test-data

# Run with verbose output
/run --verbose
```

## Instructions

### Step 1: Validate Environment

Check that we're in a component directory:

```bash
# Check for component files
test -f src/component.py || {
  echo "Error: Not in a component directory (src/component.py not found)"
  exit 1
}

# Check for pyproject.toml or requirements.txt
test -f pyproject.toml || test -f requirements.txt || {
  echo "Error: No pyproject.toml or requirements.txt found"
  exit 1
}
```

### Step 2: Determine Configuration

Extract config file from arguments or use default:

```bash
# Parse arguments
CONFIG_FILE="data/config.json"
DATA_DIR="data"
VERBOSE=false

# If $ARGUMENTS contains a path, use it
if [[ "$ARGUMENTS" == *.json ]]; then
  CONFIG_FILE="$ARGUMENTS"
  DATA_DIR=$(dirname "$CONFIG_FILE")
fi

# Check if --datadir specified
if [[ "$ARGUMENTS" == *"--datadir="* ]]; then
  DATA_DIR=$(echo "$ARGUMENTS" | grep -oP '(?<=--datadir=)[^ ]+')
  CONFIG_FILE="$DATA_DIR/config.json"
fi

# Check if config file exists
test -f "$CONFIG_FILE" || {
  echo "Error: Config file not found: $CONFIG_FILE"
  echo ""
  echo "Create it first:"
  echo "  mkdir -p $DATA_DIR"
  echo "  cat > $CONFIG_FILE << 'EOF'"
  echo '  {'
  echo '    "parameters": {'
  echo '      "debug": true'
  echo '    }'
  echo '  }'
  echo '  EOF'
  exit 1
}
```

### Step 3: Setup Data Directory Structure

Ensure all required Keboola directories exist:

```bash
# Create standard Keboola directory structure
mkdir -p "$DATA_DIR/in/tables"
mkdir -p "$DATA_DIR/in/files"
mkdir -p "$DATA_DIR/out/tables"
mkdir -p "$DATA_DIR/out/files"
mkdir -p "$DATA_DIR/out/state"

echo "✓ Data directory structure ready: $DATA_DIR"
```

### Step 4: Check Dependencies

Ensure dependencies are installed:

```bash
# Check if using uv (modern, faster)
if command -v uv &> /dev/null && test -f pyproject.toml; then
  echo "📦 Checking dependencies (uv)..."
  uv sync --quiet || {
    echo "⚠ Dependencies need to be installed"
    echo "Run: uv sync"
    exit 1
  }
  RUN_CMD="uv run python"
elif command -v python3 &> /dev/null; then
  echo "📦 Using python3..."
  RUN_CMD="python3"
else
  echo "Error: No Python found (tried: uv, python3)"
  exit 1
fi
```

### Step 5: Run Component

Execute the component with proper environment:

```bash
# Set environment
export KBC_DATADIR="$DATA_DIR"

# Show run info
echo ""
echo "🚀 Running component..."
echo "   Config: $CONFIG_FILE"
echo "   Data dir: $DATA_DIR"
echo "   Command: $RUN_CMD src/component.py"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run component and capture exit code
START_TIME=$(date +%s)

if $RUN_CMD src/component.py; then
  EXIT_CODE=0
else
  EXIT_CODE=$?
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
```

### Step 6: Display Results

Show execution results based on exit code:

```bash
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Component completed successfully ($DURATION seconds)"
  echo ""

  # Show output tables
  if [ -d "$DATA_DIR/out/tables" ] && [ "$(ls -A $DATA_DIR/out/tables 2>/dev/null)" ]; then
    echo "📊 Output tables:"
    for table in "$DATA_DIR/out/tables"/*.csv; do
      if [ -f "$table" ]; then
        filename=$(basename "$table")
        lines=$(wc -l < "$table" | xargs)
        size=$(du -h "$table" | cut -f1)
        echo "   • $filename ($lines lines, $size)"

        # Show first few rows if verbose
        if [[ "$ARGUMENTS" == *"--verbose"* ]]; then
          echo ""
          head -n 5 "$table" | column -t -s ',' || head -n 5 "$table"
          echo "   ..."
          echo ""
        fi
      fi
    done
    echo ""
  fi

  # Show output files
  if [ -d "$DATA_DIR/out/files" ] && [ "$(ls -A $DATA_DIR/out/files 2>/dev/null)" ]; then
    echo "📁 Output files:"
    for file in "$DATA_DIR/out/files"/*; do
      if [ -f "$file" ]; then
        filename=$(basename "$file")
        size=$(du -h "$file" | cut -f1)
        echo "   • $filename ($size)"
      fi
    done
    echo ""
  fi

  # Show state
  if [ -f "$DATA_DIR/out/state.json" ]; then
    echo "💾 State file created:"
    echo "   $(du -h $DATA_DIR/out/state.json | cut -f1) - $DATA_DIR/out/state.json"
    if [[ "$ARGUMENTS" == *"--verbose"* ]]; then
      echo ""
      cat "$DATA_DIR/out/state.json" | python3 -m json.tool 2>/dev/null || cat "$DATA_DIR/out/state.json"
      echo ""
    fi
  fi

  # Offer to open output directory
  echo "📂 Output location: $DATA_DIR/out/"
  echo ""
  echo "View output:"
  echo "   ls -lh $DATA_DIR/out/tables/"
  echo "   head $DATA_DIR/out/tables/*.csv"

else
  echo "❌ Component failed (exit code: $EXIT_CODE, duration: $DURATION seconds)"
  echo ""
  echo "Common issues:"
  echo "   • Exit code 1: User error (invalid config, missing params)"
  echo "   • Exit code 2: System error (network, API, unexpected exception)"
  echo ""
  echo "Debug steps:"
  echo "   1. Check error message above"
  echo "   2. Verify config: cat $CONFIG_FILE"
  echo "   3. Check logs for details"
  echo "   4. Run with debugger: python -m pdb src/component.py"
  echo ""
fi
```

### Step 7: Cleanup (Optional)

Ask if user wants to clean output for next run:

```bash
# Only ask if run was successful
if [ $EXIT_CODE -eq 0 ]; then
  echo "💡 Tip: To run again with fresh output, clean the out/ directory:"
  echo "   rm -rf $DATA_DIR/out/*"
fi
```

## Quick Tips

### Testing Different Configurations

Create multiple config files for different scenarios:

```bash
# Create configs
cat > data/config-minimal.json << 'EOF'
{"parameters": {"debug": true}}
EOF

cat > data/config-full.json << 'EOF'
{"parameters": {"api_url": "...", "limit": 100}}
EOF

# Run with different configs
/run data/config-minimal.json
/run data/config-full.json
```

### Adding Input Tables

```bash
# Create input table
cat > data/in/tables/users.csv << 'EOF'
id,name,email
1,John Doe,john@example.com
2,Jane Smith,jane@example.com
EOF

# Create manifest
cat > data/in/tables/users.csv.manifest << 'EOF'
{
  "id": "users",
  "primary_key": ["id"]
}
EOF

# Run component
/run
```

### Debugging Failed Runs

```bash
# Run with Python debugger
python -m pdb src/component.py

# Or with verbose logging
export KBC_LOGGER_VERBOSITY=verbose
/run --verbose

# Check component logs
tail -f logs/component.log  # if logging to file
```

## Safety Rules

1. **Never modify user config** - Only read, never write to config files
2. **Check exit codes** - Properly handle both success and failure
3. **Don't delete input data** - Only clean output, never input
4. **Preserve state** - Don't auto-delete state files without asking
5. **Stream output** - Show real-time progress, don't buffer everything

## Common Issues

### Issue: Permission denied on data/
```bash
# Fix permissions
chmod -R u+w data/
```

### Issue: Module not found
```bash
# Install dependencies
uv sync
# or
pip install -e .
```

### Issue: Wrong Python version
```bash
# Check Python version
python --version

# Use correct version
python3.11 src/component.py
```

### Issue: KBC_DATADIR not set
**This command handles it automatically** - sets `KBC_DATADIR=data` before running.

## Example Session

```
User: /run
Assistant: Running component locally...

✓ Data directory structure ready: data

📦 Checking dependencies (uv)...

🚀 Running component...
   Config: data/config.json
   Data dir: data
   Command: uv run python src/component.py

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INFO:root:Extracting data from API...
INFO:root:Processing 150 records...
INFO:root:Writing output table: users.csv

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Component completed successfully (3 seconds)

📊 Output tables:
   • users.csv (151 lines, 24K)

📂 Output location: data/out/

View output:
   ls -lh data/out/tables/
   head data/out/tables/*.csv

💡 Tip: To run again with fresh output, clean the out/ directory:
   rm -rf data/out/*
```

## Reference

For related commands:
- `/test` - Run pytest tests
- `/debug` - Debug failed Keboola jobs
- `@build-component` - Implementation help

