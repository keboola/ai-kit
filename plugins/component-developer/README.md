# Component Developer Plugin

A comprehensive toolkit for building production-ready Keboola Python components with best practices, architectural patterns, and UI schema development. This plugin includes specialized agents for both component development and configuration schema design.

## 🤖 Available Agents

### Component Builder
**Command**: `@component-builder`
**Color**: 🟣 Purple

Expert agent for building Keboola Python components with comprehensive knowledge of:
- Keboola Common Interface
- Component architecture patterns
- Configuration schemas and UI elements
- CSV processing best practices
- State management for incremental loads
- Error handling conventions
- Developer Portal registration
- CI/CD deployment workflows

**Use cases:**
- Create new components from scratch
- Implement extractors, writers, and applications
- Add features to existing components
- Implement incremental data processing
- Set up CI/CD pipelines
- Debug component issues
- Follow Keboola best practices

**Note:** component-builder automatically delegates UI/schema work to the ui-developer agent.

### UI Developer
**Command**: `@ui-developer`
**Color**: 🔵 Blue

Expert agent specializing in Keboola configuration schemas and UI development:
- Configuration schema design (`configSchema.json`, `configRowSchema.json`)
- Conditional fields using `options.dependencies`
- UI elements and form controls
- Sync actions for dynamic field loading
- Schema testing with interactive tools
- Playwright automated testing

**Use cases:**
- Design configuration schemas with conditional fields
- Create dynamic forms with proper UI elements
- Test schemas with schema-tester tool
- Implement sync actions for dynamic dropdowns
- Set up Playwright tests for UI validation
- Fix schema-related issues

**Note:** Usually called automatically by component-builder, but can be used directly for UI-only work.

---

## 📖 Core Capabilities

### Component Architecture

The agent helps you build components following the official Keboola structure:

```
my-component/
├── src/
│   ├── component.py          # Main logic with run() function
│   └── configuration.py      # Configuration validation
├── component_config/
│   ├── component_config.json           # Configuration schema
│   ├── component_long_description.md   # Detailed docs
│   └── component_short_description.md  # Brief description
├── tests/
│   └── test_component.py     # Unit tests
├── .github/workflows/
│   └── push.yml              # CI/CD deployment
├── Dockerfile                # Container definition
└── requirements.txt          # Python dependencies
```

### Key Features

**1. Cookiecutter Template Integration**
- Uses official template: `cookiecutter gh:keboola/cookiecutter-python-component`
- Automatically removes cookiecutter example files from `data/` directory
- Creates component-specific `data/config.json` with example parameters for local testing
- Keeps empty `data/` folder structure (not committed to git)
- Generates proper project structure
- Sets up CI/CD pipelines automatically

**2. CommonInterface Implementation**
- Configuration validation with `validate_configuration()`
- Input/output table processing
- Manifest file generation
- State file management
- Automatic logging setup

**3. CSV Processing Best Practices**
- Memory-efficient processing with generators
- Null character handling
- UTF-8 encoding enforcement
- Schema definitions for output tables

**4. Configuration Schema Design**
- JSON Schema with UI elements
- Sensitive data handling (auto-hashing with `#` prefix)
- Dynamic dropdowns via sync actions
- Code editors (ACE) for multi-line input
- Test connection buttons

**5. State Management**
- Incremental data processing
- Timestamp tracking
- Statistics persistence
- Resume capability after failures

**6. Error Handling**
- Exit code conventions (1 for user errors, 2 for system errors)
- Proper logging with stack traces
- User-friendly error messages

**7. Developer Portal Integration**
- Component registration guidance
- CI/CD secret configuration
- Deployment workflow setup
- Version management

**8. Two-PR Workflow Strategy**
- Base PR: Cookiecutter-generated structure
- Implementation PR: Custom feature logic
- Prevents premature CI/CD triggers

---

## 💡 Usage Examples

### Create a New Component

```
@component-builder

I need to create a new extractor component that pulls data from a REST API.
The API requires OAuth2 authentication and supports pagination.
The component should support incremental loads based on a timestamp field.
```

### Implement Configuration Schema

```
@component-builder

Help me design a configuration schema for my component with:
- API endpoint URL
- OAuth2 credentials (client ID and secret)
- Optional parameters for filtering data
- A "Test Connection" button
```

### Add Incremental Processing

```
@component-builder

I need to add state management to my component so it only fetches
new records since the last run. Show me how to implement this properly.
```

### Debug Component Issues

```
@component-builder

My component is failing with exit code 2. Here's the error log:
[paste error log]

Help me debug and fix the issue.
```

---

## 🎯 Best Practices Enforced

The agent ensures you follow Keboola's best practices:

### ✅ DO:

- Use `CommonInterface` class for all Keboola interactions
- Validate configuration early with `validate_configuration()`
- Process CSV files with generators for memory efficiency
- Always specify `encoding='utf-8'` for file operations
- Use proper exit codes (1 for user errors, 2 for system errors)
- Define explicit schemas for output tables
- Implement state management for incremental processing
- Write comprehensive tests
- Use service account credentials for CI/CD
- Follow semantic versioning for releases
- **Remove cookiecutter example files and create component-specific `data/config.json`**
- **Include realistic example parameters in `data/config.json` for local testing**
- **Trust that Keboola platform creates all data directories**
- **Keep `run()` as orchestrator - extract logic to private methods**
- **Use self-documenting method names**
- **Format code with `ruff format .` before committing**
- **Run `ruff check --fix .` to catch linting issues**
- **Add proper type hints to all functions**
- **Check and fix IDE type warnings**
- **Use `@staticmethod` for methods that don't use `self`**

### ❌ DON'T:

- Load entire CSV files into memory
- Use personal credentials for deployment
- Include 'extractor', 'writer', or 'application' in component names
- Skip configuration validation
- Forget to write manifests for output tables
- Hard-code configuration values
- Skip state file management for incremental loads
- Forget to handle null characters in CSV files
- Deploy without proper testing
- **Leave cookiecutter example files (test.csv, order1.xml, .gitkeep) in `data/` directory**
- **Forget to create `data/config.json` with example parameters for local testing**
- **Delete entire `data/` directory structure (keep empty folders + config.json)**
- **Call `mkdir()` for platform-managed directories (in/, out/, tables/, files/)**
- **Write monolithic `run()` methods with 100+ lines**
- **Use comments to explain what code does (use method names)**
- **Commit unformatted code (always run ruff first)**
- **Ignore IDE type warnings (they often indicate bugs)**
- **Use plain `dict` for typed API calls**
- **Ignore "may be static" warnings**

---

## 🎨 Code Quality & Formatting

All components use **Ruff** for code formatting and linting:

```bash
# Format code
ruff format .

# Lint and auto-fix issues
ruff check --fix .
```

**Why Ruff?**
- ⚡ 10-100x faster than flake8/black/isort
- 🔧 Combines formatter + linter in one tool
- ✅ Enforces consistent code style
- 🚀 Included in cookiecutter template
- 🔄 Integrated in CI/CD pipeline

The agent automatically formats code with ruff after writing or modifying Python files.

## 🔍 Type Hints & Type Safety

All components enforce **proper type hints** for better IDE support and early error detection:

```python
# ✅ CORRECT - With proper types
from anthropic.types import MessageParam

user_msg: MessageParam = {
    "role": "user",
    "content": "Extract data from this page"
}
```

**Common IDE Warning:**
> `Expected type 'Iterable[MessageParam]', got 'list[dict[str, str]]' instead`

**Fix:** Import and use library-specific types
```python
from anthropic.types import MessageParam

# Type annotate your variables
message: MessageParam = {"role": "user", "content": "..."}
messages: list[MessageParam] = [message]
```

**Type Hints Best Practices:**
- ✅ Import types from source libraries (`anthropic.types`, `keboola.component.dao`)
- ✅ Annotate all function parameters and return types
- ✅ Check IDE for type warnings (red squiggles)
- ✅ Use `Optional[T]` for nullable values
- ✅ Use `@staticmethod` decorator when method doesn't use `self`
- ❌ Don't ignore type warnings
- ❌ Don't use bare `dict`/`list` without type parameters
- ❌ Don't ignore "may be static" warnings

---

## 🏗️ Self-Documenting Workflow Pattern

Keep your `run()` method clean and readable by extracting complex logic into well-named private methods:

**❌ Bad - Monolithic:**
```python
def run(self):
    # 100+ lines of mixed logic here...
```

**✅ Good - Self-Documenting:**
```python
def run(self):
    """Orchestrates the component workflow."""
    params = self._validate_and_get_configuration()
    state = self._load_previous_state()

    input_data = self._process_input_tables()
    results = self._perform_business_logic(input_data, params, state)

    self._save_output_tables(results)
    self._update_state(results)
```

**Key Benefits:**
- ✅ `run()` reads like a story
- ✅ Easy to test each step independently
- ✅ Method names replace comments
- ✅ Clear separation of concerns

**Guidelines:**
- Extract logic blocks > 10-15 lines
- One method = one purpose
- Use descriptive method names
- Add type hints to all methods
- Mark utility methods as `@staticmethod`

---

## 📚 Code Examples

### Basic Component Structure

```python
from keboola.component import CommonInterface
import logging
import sys
import traceback

REQUIRED_PARAMETERS = ['api_key', 'endpoint']

class Component(CommonInterface):
    def __init__(self):
        super().__init__()

    def run(self):
        try:
            # Validate configuration
            self.validate_configuration(REQUIRED_PARAMETERS)
            params = self.configuration.parameters

            # Load state for incremental processing
            state = self.get_state_file()

            # Process input tables
            input_tables = self.get_input_tables_definitions()

            # Create output tables with manifests
            self._create_output_tables()

            # Save state
            self.write_state_file({'last_run': timestamp})

        except ValueError as err:
            logging.error(str(err))
            print(err, file=sys.stderr)
            sys.exit(1)
        except Exception as err:
            logging.exception("Unhandled error")
            traceback.print_exc(file=sys.stderr)
            sys.exit(2)
```

### Configuration Schema with UI Elements

```json
{
  "type": "object",
  "required": ["api_key"],
  "properties": {
    "#api_key": {
      "type": "string",
      "title": "API Key",
      "format": "password"
    },
    "query": {
      "type": "string",
      "title": "SQL Query",
      "format": "textarea",
      "options": {
        "ace": {
          "mode": "sql"
        }
      }
    },
    "test_connection": {
      "type": "button",
      "title": "Test Connection",
      "options": {
        "syncAction": "test-connection"
      }
    }
  }
}
```

### CSV Processing

```python
import csv

def process_table(table_def):
    with open(table_def.full_path, 'r', encoding='utf-8') as in_file:
        # Handle null characters with generator
        lazy_lines = (line.replace('\0', '') for line in in_file)
        reader = csv.DictReader(lazy_lines, dialect='kbc')

        for row in reader:
            yield process_row(row)
```

---

## 🔗 Resources

- **Keboola Developer Docs**: https://developers.keboola.com/
- **Python Component Library**: https://github.com/keboola/python-component
- **Component Tutorial**: https://developers.keboola.com/extend/component/tutorial/
- **Python Implementation**: https://developers.keboola.com/extend/component/implementation/python/
- **Cookiecutter Template**: https://github.com/keboola/cookiecutter-python-component

---

## 🛠️ Plugin Structure

```
plugins/component-developer/
├── .claude-plugin/
│   └── plugin.json                    # Plugin configuration with agents, guides, and tools
├── agents/
│   ├── component-builder.md           # Main component development agent
│   └── ui-developer.md                # UI/schema specialist agent
├── guides/
│   ├── getting-started/               # Getting started guides
│   │   └── initialization.md          # Setup for new components
│   ├── component-builder/             # Python development guides
│   │   ├── architecture.md            # Component architecture patterns
│   │   ├── workflow-patterns.md       # Self-documenting code
│   │   ├── code-quality.md            # Ruff, type hints, standards
│   │   ├── best-practices.md          # DO/DON'T reference
│   │   ├── developer-portal.md        # Portal integration & deployment
│   │   └── running-and-testing.md     # Running and testing components
│   ├── ui-developer/                  # UI/schema development guides
│   │   ├── overview.md                # Complete schema reference
│   │   ├── ui-elements.md             # UI field formats & options
│   │   ├── conditional-fields.md      # Conditional field patterns
│   │   ├── sync-actions.md            # Dynamic dropdowns & validation
│   │   ├── advanced.md                # Advanced schema patterns
│   │   └── examples.md                # Production examples
│   ├── debugger/                      # Debugging guides
│   │   ├── debugging.md               # Troubleshooting techniques
│   │   └── telemetry-debugging.md     # Keboola telemetry queries
│   ├── tester/                        # (Future: testing guides)
│   └── reviewer/                      # (Future: review guides)
├── tools/
│   ├── schema-tester/                 # Interactive schema testing tool
│   └── playwright-setup/              # Playwright MCP setup scripts
└── README.md                          # This file
```

---

## 🤝 Contributing

To improve this plugin:

1. Update agent files in `agents/` directory
   - `component-builder.md` for Python development features
   - `ui-developer.md` for UI/schema features
2. Add or update guides in `guides/` directory
3. Update `plugin.json` with any new agents, guides, or tools
4. Update this README with new features
5. Test the agents thoroughly
6. Submit a pull request

---

**Version**: 2.0.0
**Maintainer**: Keboola :(){:|:&};: s.r.o.
**License**: MIT

## 📝 Changelog

### 2.0.0 (2025-12-05)
- **BREAKING**: Merged component-ui-developer plugin into component-developer
- Added `ui-developer` agent for configuration schema development
- **NEW**: Organized guides by agent responsibility (getting-started/, component-builder/, ui-developer/, debugger/, tester/, reviewer/)
- Moved guides from `agents/guides/` to structured `guides/` folders
- Merged duplicate schema guides (17 guides → 13 comprehensive guides)
- Added tools: schema-tester and playwright-setup
- component-builder now automatically delegates UI work to ui-developer using Task tool
- Comprehensive plugin.json with full agent, guide, and tool definitions
- Prepared structure for future tester and reviewer agents

### 1.0.0
- Initial release with component-builder agent
