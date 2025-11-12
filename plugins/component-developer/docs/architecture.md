# Component Architecture

Complete architectural patterns and best practices for Keboola Python components.

## Main Component Implementation

**IMPORTANT**: The Keboola platform automatically creates all data directories (`data/in/`, `data/out/tables/`, `data/out/files/`, etc.). You **never** need to call `mkdir()` or create these directories manually.

### Basic Component Structure

```python
from keboola.component import CommonInterface
import logging
import sys
import traceback
from pathlib import Path

# REQUIRED_PARAMETERS should list all mandatory config parameters
REQUIRED_PARAMETERS = ['api_key', 'endpoint']

class Component(CommonInterface):
    def __init__(self):
        super().__init__()

    def run(self):
        """
        Main execution method containing all component logic.
        Handles state, config, tables, manifests, and logging.
        """
        try:
            # 1. Validate configuration
            self.validate_configuration(REQUIRED_PARAMETERS)
            params = self.configuration.parameters

            # 2. Get data directory paths (NO mkdir needed - platform creates them!)
            data_dir = Path(self.data_folder_path)
            out_files_dir = data_dir / "out" / "files"
            # Platform ensures these directories exist, just use them directly

            # 3. Load state (for incremental processing)
            state = self.get_state_file()
            last_run = state.get('last_timestamp')

            # 4. Process input tables (if applicable)
            input_tables = self.get_input_tables_definitions()
            for table in input_tables:
                logging.info(f"Processing table: {table.name}")
                self._process_table(table)

            # 5. Create output tables with proper manifests
            self._create_output_tables()

            # 6. Save state for next run
            self.write_state_file({'last_timestamp': current_timestamp})

        except ValueError as err:
            # User errors (configuration/input issues)
            logging.error(str(err))
            print(err, file=sys.stderr)
            sys.exit(1)
        except Exception as err:
            # System errors (unhandled exceptions)
            logging.exception("Unhandled error occurred")
            traceback.print_exc(file=sys.stderr)
            sys.exit(2)

    def _process_table(self, table_def):
        """Process individual table with CSV handling best practices."""
        # Use generator pattern for null character handling
        with open(table_def.full_path, 'r', encoding='utf-8') as in_file:
            lazy_lines = (line.replace('\0', '') for line in in_file)
            # Process rows efficiently without loading entire file
            # Implementation here...

    def _create_output_tables(self):
        """Create output tables with proper schema definitions."""
        from collections import OrderedDict
        from keboola.component.dao import ColumnDefinition, BaseType

        # Define schema
        schema = OrderedDict({
            "id": ColumnDefinition(
                data_types=BaseType.integer(),
                primary_key=True
            ),
            "name": ColumnDefinition(),
            "value": ColumnDefinition(
                data_types=BaseType.numeric(length="10,2")
            )
        })

        # Create table definition
        out_table = self.create_out_table_definition(
            name="results.csv",
            destination="out.c-data.results",
            schema=schema,
            incremental=True
        )

        # Write data
        import csv
        with open(out_table.full_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=out_table.column_names)
            writer.writeheader()
            # Write rows...

        # Write manifest
        self.write_manifest(out_table)

if __name__ == '__main__':
    try:
        comp = Component()
        comp.run()
    except Exception as e:
        logging.exception("Component execution failed")
        sys.exit(2)
```

## Configuration Schema

Create robust configuration schemas with proper UI elements:

```json
{
  "type": "object",
  "title": "Configuration",
  "required": ["api_key", "endpoint"],
  "properties": {
    "api_key": {
      "type": "string",
      "title": "API Key",
      "description": "Your API authentication token",
      "propertyOrder": 1,
      "format": "password"
    },
    "endpoint": {
      "type": "string",
      "title": "API Endpoint",
      "description": "Base URL for the API",
      "propertyOrder": 2
    },
    "incremental": {
      "type": "boolean",
      "title": "Incremental Load",
      "description": "Only fetch data since last run",
      "default": false,
      "propertyOrder": 3
    }
  }
}
```

### UI Elements & Features

**Sensitive Data**: Prefix with `#` to enable automatic hashing:
```json
{
  "#password": {
    "type": "string",
    "title": "Password",
    "format": "password"
  }
}
```

**Dynamic Dropdowns**: Use sync actions to populate options from API calls

**Code Editor**: Use ACE editor for multi-line input:
```json
{
  "query": {
    "type": "string",
    "title": "SQL Query",
    "format": "textarea",
    "options": {
      "ace": {
        "mode": "sql",
        "theme": "tomorrow"
      }
    }
  }
}
```

**Test Connection**: Add sync action for connection validation:
```json
{
  "test_connection": {
    "type": "button",
    "title": "Test Connection",
    "options": {
      "syncAction": "test-connection"
    }
  }
}
```

## CSV Processing Best Practices

Always follow these patterns when working with CSV files:

```python
import csv

# Reading input tables
def process_input_table(table_def):
    with open(table_def.full_path, 'r', encoding='utf-8') as in_file:
        # Handle null characters with generator
        lazy_lines = (line.replace('\0', '') for line in in_file)
        reader = csv.DictReader(lazy_lines, dialect='kbc')

        for row in reader:
            # Process row by row for memory efficiency
            yield process_row(row)

# Writing output tables with proper schema
def write_output_table(ci, rows, schema):
    out_table = ci.create_out_table_definition(
        name="output.csv",
        destination="out.c-data.output",
        schema=schema,
        incremental=True
    )

    with open(out_table.full_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=out_table.column_names, dialect='kbc')
        writer.writeheader()

        # Write rows as they're processed (don't load all into memory)
        for row in rows:
            writer.writerow(row)

    ci.write_manifest(out_table)
    return out_table
```

## State Management for Incremental Processing

Implement proper state handling for incremental loads:

```python
def run_incremental(ci):
    # Load previous state
    state = ci.get_state_file()
    last_timestamp = state.get('last_timestamp', '1970-01-01T00:00:00Z')

    # Fetch only new data since last_timestamp
    new_data = fetch_data_since(last_timestamp)

    # Process and save data
    process_data(new_data)

    # Update state with current timestamp
    current_timestamp = datetime.now(timezone.utc).isoformat()
    ci.write_state_file({
        'last_timestamp': current_timestamp,
        'records_processed': len(new_data),
        'last_run_stats': get_stats(new_data)
    })
```

## Error Handling & Logging

Follow Keboola's error handling conventions:

```python
import logging
import sys
import traceback

try:
    # Component logic
    validate_inputs(params)
    result = perform_operation()

except ValueError as err:
    # User errors: configuration problems, invalid inputs
    # Exit code 1 indicates user-fixable errors
    logging.error(f"Configuration error: {err}")
    print(err, file=sys.stderr)
    sys.exit(1)

except requests.HTTPError as err:
    # API errors: show user-friendly messages
    logging.error(f"API request failed: {err}")
    print(f"Failed to connect to API: {err.response.status_code}", file=sys.stderr)
    sys.exit(1)

except Exception as err:
    # System errors: unhandled exceptions
    # Exit code 2 indicates application errors
    logging.exception("Unhandled error in component execution")
    traceback.print_exc(file=sys.stderr)
    sys.exit(2)
```

**Logging Setup**: The `keboola.component` library automatically configures logging based on environment variables. Use standard Python logging:

```python
import logging

logging.info("Starting data extraction")
logging.warning("Rate limit approaching")
logging.error("Failed to fetch data")
logging.exception("Critical error with stack trace")
```

## Developer Portal Registration

### Prerequisites

- Developer Portal account (requires email confirmation + 2FA)
- Service account credentials (not personal credentials)
- GitHub repository created

### Registration Steps

```bash
# Component ID will be prefixed with vendor name
# e.g., input 'my-component' → returns 'keboola.my-component'
```

### CI/CD Configuration

Set these secrets in your repository:
- `KBC_DEVELOPERPORTAL_USERNAME` - service account username
- `KBC_DEVELOPERPORTAL_PASSWORD` - service account password
- `KBC_DEVELOPERPORTAL_APP` - full component ID with vendor prefix
- `KBC_STORAGE_TOKEN` - for testing

### Deployment

- Tag releases with semantic versioning: `v1.0.0`, `v1.1.0`, etc.
- GitHub Actions automatically builds Docker image
- Pushes to AWS ECR (only supported registry)
- Updates Developer Portal with new version
- Propagates to all Keboola instances (up to 5 minutes)

## Two-PR Workflow Strategy

For new component creation, use a structured approach:

**When to use base PR only**: If the user request contains only keywords like:
- "kickoff"
- "create component"
- "initialize"
- "setup"
- "bootstrap"

**Steps**:
1. **Base PR**: Create PR with cookiecutter-generated files only
   - Establishes component structure
   - Sets up CI/CD pipeline
   - Gets component registered

2. **Implementation PR** (if needed): Add custom logic
   - Implement specific feature requirements
   - Add custom validation
   - Extend functionality

This prevents Claude Code from triggering CI/CD workflows prematurely during iterative development.

## Testing Requirements

Always include comprehensive tests:

```python
import unittest
from src.component import Component

class TestComponent(unittest.TestCase):
    def test_configuration_validation(self):
        """Test that required parameters are validated."""
        # Test implementation

    def test_csv_processing(self):
        """Test CSV reading and writing with proper encoding."""
        # Test implementation

    def test_state_management(self):
        """Test state file persistence."""
        # Test implementation

    def test_error_handling(self):
        """Test proper error codes for different failure types."""
        # Test implementation

if __name__ == '__main__':
    unittest.main()
```

## Dockerfile Best Practices

Use efficient Docker images:

```dockerfile
FROM python:3.11-alpine

# Install dependencies
WORKDIR /code
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy component code
COPY src/ /code/src/

# Set entrypoint with unbuffered output
ENTRYPOINT ["python", "-u", "/code/src/component.py"]
```

**Key points**:
- Prefer Alpine images for smaller size
- Use `python -u` flag to disable output buffering
- Install `keboola.component` package via pip
- Set proper working directory

## Related Documentation

- [Code Quality Guidelines](code-quality.md)
- [Workflow Patterns](workflow-patterns.md)
- [Best Practices](best-practices.md)
