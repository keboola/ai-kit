# Component Developer Plugin

A comprehensive toolkit for building production-ready Keboola Python components with best practices, architectural patterns, and UI schema development. This plugin uses the Agent Skills format with specialized skills for component development, UI/schema design, testing, debugging, and code review.

## 🎯 Available Skills

### Develop Component
**Command**: `@develop-component` (alias: `@component-builder`)
**Color**: 🟣 Purple

Expert agent for developing Keboola Python components — both new and existing.

**Use cases:**
- Implement extractors, writers, and applications
- Add features to existing components
- Implement incremental data processing
- API client separation and architecture
- Self-documenting workflow patterns
- Code quality with Ruff

**Note:** Automatically delegates UI/schema work to the build-component-ui skill.

### Build Component UI
**Command**: `@build-component-ui` (alias: `@ui-developer`)
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

**Note:** Usually called automatically by develop-component, but can be used directly for UI-only work.

### Debug Component
**Command**: `@debug-component` (alias: `@debugger`)
**Color**: 🟠 Orange

Expert skill for debugging Keboola components using Keboola MCP tools and local testing.

### Test Component
**Command**: `@test-component` (alias: `@tester`)
**Color**: 🟢 Green

Unified testing skill covering all test types for Keboola components.

**Use cases:**
- Datadir tests (primary method — mirrors KBC_DATADIR production structure)
- Unit tests and mock-based tests for logic and transformation code
- VCR functional tests with `keboola.datadirtest` — records real HTTP interactions once, replays in CI without credentials
- Setting up VCR infrastructure: scaffold, sanitizers, secrets
- Regression tests from platform debug job output (`stage_output.zip`)

### Review
**Command**: `/review` (or `@review`)
**Color**: 🔴 Red

Single consolidated reviewer covering code quality and backward compatibility in one pass.

**Code quality:** architecture patterns (Config/Client separation, `__init__` initialization, `run()` as orchestrator), typing, Pythonic best practices. Runs ruff automatically for formatting and lint.

**Backward compatibility:** configSchema field changes, Pydantic model changes, sync action preservation, output table stability, state file compatibility — with real-world impact via Keboola telemetry.

All telemetry output is anonymized. Never writes client names, project names, or stack URLs to public repos.

### Get Started
**Command**: `@get-started`
**Color**: 🟢 Green

Initializes new Keboola components from cookiecutter template. Auto-detects whether a repo is already set up and skips initialization if so. Triggers conversationally when you describe a new component you want to build.

### Migrate Component to UV
**Command**: `@migrate-component-to-uv`
**Color**: 🟣 Purple

Expert skill for migrating Keboola Python components from `requirements.txt` + pip to `pyproject.toml` + uv with ruff linting.

**Use cases:**
- Migrate from `requirements.txt` to `pyproject.toml`
- Upgrade Dockerfile to Python 3.13 + uv
- Add deterministic dependency management with `uv.lock`
- Update CI/CD workflows: `branches-ignore`, ruff, pytest
- Align non-source files with cookiecutter template

### Component Defaults
**Command**: `@component-defaults`
**Color**: 🟣 Purple

Loads the canonical template files for Keboola components into context. Invoked automatically by other skills during alignment checks.

**Use cases:**
- Get the standard Dockerfile, push.yml, build_n_test.sh, docker-compose.yml, pre-commit-config.yaml, and pyproject.toml templates
- Used internally by migrate-to-uv and develop-component for cookiecutter alignment

### Keboola Context
**Command**: `@keboola-context`

Platform-level knowledge about how Keboola Connection executes components. Pulled automatically whenever platform behaviour affects a decision — config structure, row handling, state, parallelism, test data layout.

**Reference files:**
- `config-rows.md` — how configRow parameters are merged, parallel execution, per-row state, and test fixture implications

---

## ⚡ Available Commands

Quick actions for common component development tasks:

### `/schema-test` - Test Configuration Schemas
Launch interactive schema tester for testing and validating configSchema.json and configRowSchema.json.
```bash
/schema-test            # Opens http://localhost:8000
/schema-test --port 8080
```

### `/review` - Code Review
Perform thorough code review focusing on Keboola best practices and architecture.
```bash
/review                 # Review unstaged changes
/review src/component.py
```

### `/generate-vcr-tests` - Generate VCR Functional Tests
Set up VCR-based functional tests — records real HTTP interactions and replays them in CI without credentials.
```bash
/generate-vcr-tests                          # Interactive setup
/generate-vcr-tests --secrets secrets.json   # With pre-existing secrets
```

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

## 🛠️ Plugin Structure (Agent Skills Format)

```
plugins/component-developer/
├── .claude-plugin/
│   └── plugin.json                    # Plugin configuration
├── skills/                             # Agent Skills format
│   ├── develop-component/             # Python component development
│   │   ├── SKILL.md                   # Skill definition
│   │   └── references/                # Documentation
│   │       ├── architecture.md
│   │       ├── best-practices.md
│   │       ├── code-quality.md
│   │       ├── workflow-patterns.md
│   │       ├── developer-portal.md
│   │       └── running-and-testing.md
│   ├── build-component-ui/            # UI/schema development
│   │   ├── SKILL.md
│   │   ├── references/
│   │   │   ├── overview.md
│   │   │   ├── ui-elements.md
│   │   │   ├── conditional-fields.md
│   │   │   ├── sync-actions.md
│   │   │   ├── advanced.md
│   │   │   └── examples.md
│   │   ├── schema-tester/             # Interactive testing tool
│   │   ├── playwright-setup/          # Automated testing
│   │   └── scripts/
│   ├── debug-component/               # Debugging
│   │   ├── SKILL.md
│   │   ├── references/
│   │   │   ├── debugging.md
│   │   │   └── telemetry-debugging.md
│   │   └── scripts/
│   ├── test-component/                # Testing (datadir, unit, VCR)
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── datadir-tests.md
│   │       ├── unit-and-mock-tests.md
│   │       ├── vcr-configs-format.md
│   │       ├── vcr-sanitizers.md
│   │       ├── vcr-quickstart.md
│   │       ├── vcr-troubleshooting.md
│   │       └── vcr-debug-from-platform.md
│   ├── review/                        # Code quality + backward compatibility review
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── code-quality.md
│   │       ├── breaking-changes.md
│   │       └── telemetry.md
│   └── get-started/                   # Getting started
│       └── SKILL.md
├── commands/                           # Slash commands
│   ├── generate-vcr-tests.md         # Generate VCR functional tests
│   ├── review.md                      # Code review
│   └── schema-test.md                 # Test configuration schemas
└── README.md                          # This file
```

---

## 🤝 Contributing

To improve this plugin:

1. Update skill files in `skills/*/SKILL.md`
   - `develop-component/SKILL.md` for Python development
   - `build-component-ui/SKILL.md` for UI/schema development
   - Other skills as needed
2. Add or update documentation in `skills/*/references/`
3. Add helper scripts to `skills/*/scripts/`
4. Update `plugin.json` version if needed
5. Update this README with new features
6. Test the skills thoroughly
7. Submit a pull request

---

**Version**: 3.3.0
**Maintainer**: Keboola :(){:|:&};: s.r.o.
**License**: MIT

## 📝 Changelog

### 3.5.0 (2026-03-30)
- **MERGED**: `test-component-vcr` skill absorbed into `test-component` — one unified testing entry point
- **REMOVED**: `vcr-tester` skill (superseded)
- **RESTRUCTURED**: `test-component` references split into `datadir-tests.md`, `unit-and-mock-tests.md`, and `vcr/` subdirectory
- **UPDATED**: `/generate-vcr-tests` command now uses `test-component` skill
- **UPDATED**: `tester` agent description updated to mention VCR

### 3.4.0 (2026-03-26)
- **CONSOLIDATED**: `review-component` and `review-backward-compatibility` skills merged into single `review` skill
- **REMOVED**: `reviewer` agent (replaced by `review` skill + `/review` command)
- **SIMPLIFIED**: `/review` command is now a lean entry point — all logic lives in the skill
- **IMPROVED**: Review now runs `ruff format --check` and `ruff check` automatically; linting issues reported as "run ruff" rather than individual findings
- **TRIMMED**: Removed checklist and style-guide reference files; code-quality.md consolidated and lean

### 3.3.1 (2026-03-26)
- **RENAMED**: `build-component` skill → `develop-component` (better reflects ongoing development, not just greenfield)
- **AGENT**: Redesigned `reviewer` agent — now covers both code quality AND backward compatibility in one pass, read-only tools, Opus model
- **AGENT**: Removed `backward-compatibility-reviewer` agent (subsumed into `reviewer`)
- **REMOVED**: `fix`, `migrate-repo`, `run`, `init` slash commands (bloated or obsolete)
- **SKILL**: `get-started` converted from thin routing stub to actionable cookiecutter skill with state detection
- **SKILL**: `test-component` gains "Running Locally" section (KBC_DATADIR, exit codes, debug steps)
- **FIXED**: Stale `../guides/component-builder/` paths in `review-component` and `debug-component`

### 3.3.0 (2026-03-05)
- **NEW**: Added `test-component-vcr` skill for VCR-based functional testing
- Records real HTTP interactions as cassettes and replays them in CI without credentials
- Supports OAuth token chaining, time freezing, and automatic credential sanitization
- Includes quick reference guide and step-by-step setup instructions
- **NEW**: Added `review-backward-compatibility` skill and `@backward-compatibility-reviewer` agent
- Backward compatibility review for component PRs (configSchema, Pydantic models, sync actions, output tables, state files)
- Telemetry-powered impact analysis via Keboola MCP (active configs, job stats, error rates)
- Structured review output with severity levels (HIGH/MEDIUM/LOW/SAFE) and verdicts
- Anonymized telemetry — never exposes client names, project names, or stack URLs in public repos
- Breaking changes reference and telemetry analysis reference documentation

### 3.0.0 (2025-12-19)
- **BREAKING**: Migrated to Agent Skills format
- **NEW Structure**: Reorganized from `agents/` + `guides/` to unified `skills/` directory
- **Renamed Skills** for consistency:
  - `component-builder` → `build-component`
  - `ui-developer` → `build-component-ui`
  - `debugger` → `debug-component`
  - `tester` → `test-component`
  - `reviewer` → `review-component`
  - Added: `get-started` skill
- **Skill Structure**: Each skill now contains:
  - `SKILL.md` - Main skill definition with YAML frontmatter
  - `references/` - Documentation files
  - `scripts/` - Helper scripts
- **Tools Reorganized**: Moved to `build-component-ui/` (schema-tester, playwright-setup)
- **Backwards Compatible**: Aliased old names (`@component-builder`, `@ui-developer`, etc.)
- **Progressive Disclosure**: Follows agentskills.io standard for better performance

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
