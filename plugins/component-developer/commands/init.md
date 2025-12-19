---
description: Initialize new Keboola component from cookiecutter template with automatic cleanup
allowed-tools: Bash, Read, Write, Edit, Glob, AskUserQuestion
argument-hint: [component-name]
---

# Initialize New Component

Quickly initialize a new Keboola Python component using the official cookiecutter template with automatic cleanup and best practices.

## What This Command Does

1. **Runs cookiecutter template** - Uses `gh:keboola/cookiecutter-python-component`
2. **Cleans up example files** - Removes cookiecutter examples from `data/`
3. **Creates test config** - Generates `data/config.json` with example parameters
4. **Initializes git** - Creates initial commit with proper structure
5. **Validates structure** - Ensures everything is set up correctly

## Usage

```bash
# Interactive mode (asks for component details)
/init

# With component name
/init my-awesome-extractor

# Specify output directory
/init my-component --output ~/projects/
```

## Instructions

### Step 1: Gather Component Information

If component name is provided in `$ARGUMENTS`, use it. Otherwise, ask the user:

```
Component name (e.g., ex-my-api):
Component ID (kebab-case, e.g., keboola.ex-my-api):
Component type (extractor/writer/application):
Short description:
```

**Naming conventions:**
- Don't include "extractor", "writer", or "application" in the name
- Use kebab-case for IDs (e.g., `keboola.ex-salesforce`)
- Follow pattern: `vendor.component-name`

### Step 2: Run Cookiecutter Template

```bash
# Install cookiecutter if needed
which cookiecutter || pip install cookiecutter

# Run template (non-interactive if we have all info)
cookiecutter gh:keboola/cookiecutter-python-component \
  --no-input \
  component_id="$COMPONENT_ID" \
  name="$COMPONENT_NAME" \
  type="$COMPONENT_TYPE" \
  description="$DESCRIPTION"

# Or interactive mode if user wants to customize
cookiecutter gh:keboola/cookiecutter-python-component
```

**Expected output:**
```
component_id: keboola.ex-my-api
name: ex-my-api
type: extractor
description: My awesome API extractor
...
✓ Created component in ./ex-my-api/
```

### Step 3: Navigate to Component Directory

```bash
cd $COMPONENT_NAME
ls -la
```

**Expected structure:**
```
ex-my-api/
├── .github/workflows/
│   └── push.yml
├── component_config/
│   ├── configSchema.json
│   ├── configRowSchema.json
│   └── component_*_description.md
├── data/
│   ├── test.csv          # ← TO BE REMOVED
│   ├── order1.xml         # ← TO BE REMOVED
│   └── .gitkeep           # ← TO BE REMOVED
├── src/
│   ├── component.py
│   └── configuration.py
├── tests/
├── Dockerfile
├── pyproject.toml
└── README.md
```

### Step 4: Clean Up Cookiecutter Examples

Remove example files that come with the template:

```bash
# Remove example data files
rm -f data/test.csv data/order1.xml data/.gitkeep

# Verify data/ directory is empty
ls -la data/
```

**Critical:** Keep the `data/` directory structure but remove ALL example files.

### Step 5: Create Component-Specific Config

Create `data/config.json` with realistic example parameters:

```bash
# Create config.json based on component type
cat > data/config.json << 'EOF'
{
  "parameters": {
    "api_url": "https://api.example.com/v1",
    "#api_key": "your-api-key-here",
    "debug": false
  }
}
EOF
```

**Adapt parameters based on configSchema.json:**
- Read `component_config/configSchema.json`
- Extract required fields
- Generate realistic example values
- Use `#` prefix for sensitive fields

### Step 6: Initialize Git Repository

```bash
# Initialize git if not already initialized
git init

# Add all files
git add -A

# Create initial commit
git commit -m "feat: initialize component from cookiecutter template

Component: $COMPONENT_NAME
Type: $COMPONENT_TYPE
Template: keboola/cookiecutter-python-component

- Removed cookiecutter example files from data/
- Created component-specific data/config.json with example parameters
- Ready for implementation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Step 7: Validate Structure

Run validation checks:

```bash
# Check required files exist
test -f src/component.py && echo "✓ component.py exists"
test -f component_config/configSchema.json && echo "✓ configSchema.json exists"
test -f data/config.json && echo "✓ config.json exists"
test -f pyproject.toml && echo "✓ pyproject.toml exists"

# Check example files are removed
! test -f data/test.csv && echo "✓ test.csv removed"
! test -f data/.gitkeep && echo "✓ .gitkeep removed"

# Check git is initialized
git log --oneline -1 && echo "✓ Git initialized"
```

### Step 8: Install Dependencies (Optional)

Ask user if they want to install dependencies now:

```bash
# Install dependencies with uv (faster) or pip
uv sync
# or
pip install -e .
```

### Step 9: Next Steps Summary

Provide clear next steps:

```
## ✅ Component Initialized Successfully!

**Location:** ./$COMPONENT_NAME/
**Component ID:** $COMPONENT_ID
**Type:** $COMPONENT_TYPE

### Structure Overview:
- src/component.py          # Main component logic (implement run() method)
- component_config/         # Configuration schemas and descriptions
- data/config.json          # Local test configuration
- tests/                    # Unit and datadir tests
- .github/workflows/        # CI/CD deployment

### Next Steps:

1. **Implement component logic:**
   cd $COMPONENT_NAME
   # Edit src/component.py and implement run() method

2. **Test locally:**
   /run                     # Run with data/config.json

3. **Design configuration schema:**
   /schema-test             # Interactive schema testing

4. **Write tests:**
   @test-component         # Get help with testing

5. **Create repository:**
   gh repo create keboola/$COMPONENT_NAME --private
   git remote add origin git@github.com:keboola/$COMPONENT_NAME.git
   git push -u origin main

### Helpful Commands:
- /run                      # Run component locally
- /test                     # Run tests
- /schema-test              # Test configuration schemas
- /review                   # Code review
- @build-component          # Get implementation help

### Resources:
- Component Tutorial: https://developers.keboola.com/extend/component/tutorial/
- Python Component Library: https://github.com/keboola/python-component
- Developer Portal: https://components.keboola.com/
```

## Safety Rules

1. **Never overwrite existing component** - Check if directory exists first
2. **Always clean up example files** - Users shouldn't commit cookiecutter examples
3. **Create realistic config.json** - Not empty, not minimal, but realistic
4. **Don't modify cookiecutter template** - Use it as-is, clean up after
5. **Ask before installing dependencies** - User might prefer manual setup

## Common Issues

### Issue: Directory already exists
```bash
# Check first
if [ -d "$COMPONENT_NAME" ]; then
  echo "Error: Directory $COMPONENT_NAME already exists"
  echo "Options:"
  echo "  1. Choose different name"
  echo "  2. Remove existing directory: rm -rf $COMPONENT_NAME"
  exit 1
fi
```

### Issue: Cookiecutter not installed
```bash
# Install cookiecutter
pip install --user cookiecutter
# or
pipx install cookiecutter
```

### Issue: Git user not configured
```bash
# Configure git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Example Session

```
User: /init ex-salesforce
Assistant: Running cookiecutter for ex-salesforce...

Component name: ex-salesforce
Component ID: keboola.ex-salesforce  
Type: extractor
Description: Salesforce data extractor

✓ Created component in ./ex-salesforce/

Cleaning up example files...
✓ Removed data/test.csv
✓ Removed data/order1.xml
✓ Removed data/.gitkeep

Creating data/config.json...
✓ Created with realistic Salesforce parameters

Initializing git...
✓ Initial commit created

## ✅ Component Initialized Successfully!

**Location:** ./ex-salesforce/
**Component ID:** keboola.ex-salesforce
**Type:** extractor

Next steps:
1. cd ex-salesforce
2. Implement src/component.py
3. Run locally: /run
4. Create GitHub repo: gh repo create keboola/ex-salesforce
```

## Reference

For implementation guidance after initialization, use:
- `@build-component` - Component architecture and patterns  
- `@build-component-ui` - Configuration schemas
- `@test-component` - Writing tests
- `@get-started` - Initialization details

