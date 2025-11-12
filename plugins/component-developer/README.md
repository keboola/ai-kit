# Component Developer Plugin

A specialized toolkit for building production-ready Keboola Python components following best practices, architectural patterns, and proper integration with the Keboola Developer Portal.

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
- Design configuration schemas with proper UI elements
- Implement incremental data processing
- Set up CI/CD pipelines
- Debug component issues
- Follow Keboola best practices

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
│   └── plugin.json          # Plugin configuration
├── agents/
│   └── component-builder.md # Component builder agent
└── README.md                # This file
```

---

## 🤝 Contributing

To improve this plugin:

1. Update the agent file in `agents/component-builder.md`
2. Update this README with new features
3. Test the agent thoroughly
4. Submit a pull request

---

**Version**: 1.0.0
**Maintainer**: Keboola :(){:|:&};: s.r.o.
**License**: MIT
