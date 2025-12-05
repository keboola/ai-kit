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

## Static Methods in Components

**IMPORTANT:** Always use `@staticmethod` decorator for methods that don't access `self`.

### When to Use @staticmethod

Use `@staticmethod` for utility methods that:
- Don't access instance attributes (self.something)
- Don't call other instance methods
- Are pure functions that could work standalone
- Transform, validate, or parse data

```python
class Component(ComponentBase):
    def __init__(self):
        super().__init__()
        # Load configuration and initialize client in constructor
        # so sync_actions and other methods can use them
        self.config = self._load_configuration()
        self.client = self._initialize_client(self.config.api)

    def run(self):
        # Configuration and client already available via self
        raw_response = self.client.fetch_data()          # Client handles endpoints internally
        data = self._parse_response(raw_response)        # Static: pure transformation
        self._save_results(data)                         # Uses self.files_out_path → instance

    def _load_configuration(self) -> Configuration:
        """Instance method - accesses self.configuration."""
        return Configuration(**self.configuration.parameters)

    @staticmethod
    def _initialize_client(api_config: ApiConfig) -> APIClient:
        """Static method - pure function, no self needed."""
        return APIClient(
            api_key=api_config.api_key,
            base_url=api_config.base_url,
            timeout=api_config.timeout,
        )

    @staticmethod
    def _parse_response(response: dict) -> list[dict]:
        """Static method - operates only on arguments."""
        return response.get('data', [])

    def _save_results(self, data: list[dict]) -> None:
        """Instance method - uses self.files_out_path."""
        output_path = self.files_out_path / "results.json"
        with open(output_path, 'w') as f:
            json.dump(data, f)
```

> **IMPORTANT:** Configuration loading and client initialization MUST happen in `__init__()`, not in `run()`. This ensures that sync_actions and other methods (defined by the `action` parameter in config.json) have access to `self.config` and `self.client`.

> **Note:** This is a simplified example focused on the `@staticmethod` rule. The API client is stored on the instance (`self.client`) and API configuration (keys, endpoints, timeouts) is encapsulated in an `ApiConfig` model. For complete patterns on structuring API clients and configuration models, see the **API Client Organization** section below.

### Quick Rule

- **Uses `self.anything`?** → Instance method (no decorator)
- **Only uses arguments?** → `@staticmethod` decorator

## API Client Organization

For components that integrate with external APIs or services, **separate API client logic into dedicated client files** when:

1. The API integration is complex (multiple endpoints, authentication, retry logic)
2. The client code would exceed ~100 lines
3. The client might be reusable across multiple methods
4. You want to isolate external service dependencies for testing

### When to Create Separate Client Files

**✅ DO create separate client files:**
- Complex API integrations (Anthropic, OpenAI, Salesforce, etc.)
- Browser automation setup (Playwright, Selenium)
- Database connections with connection pooling
- Services requiring authentication, retry logic, or rate limiting

**❌ DON'T create separate client files:**
- Simple HTTP requests (use `requests` directly in component.py)
- Single-endpoint APIs with no special logic
- When the "client" would be < 50 lines of trivial wrapper code

### Example Structure

```
src/
├── component.py           # Main component orchestration
├── configuration.py       # Pydantic configuration
├── anthropic_client.py    # Claude API client
└── playwright_client.py   # Browser automation client
```

### Example: Anthropic Client

**src/anthropic_client.py:**
```python
"""Claude AI client for web scraping tasks."""

import logging
from typing import Any

import anthropic
from anthropic.types import MessageParam


class AnthropicClient:
    """Wrapper for Anthropic Claude API with scraping-specific methods."""

    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022"):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model
        logging.info(f"Initialized Anthropic client with model {model}")

    def extract_data_from_html(
        self,
        page_title: str,
        page_content: str,
        extraction_prompt: str,
    ) -> str:
        """
        Extract structured data from HTML using Claude AI.

        Args:
            page_title: Title of the webpage
            page_content: HTML content (will be truncated to 10k chars)
            extraction_prompt: User's data extraction instructions

        Returns:
            Claude's response as JSON string
        """
        system_prompt = """You are a web scraping expert.
Extract requested data and return as JSON:
{
    "data": [{"field": "value"}, ...],
    "metadata": {"url": "...", "timestamp": "...", "total_records": N}
}"""

        user_message: MessageParam = {
            "role": "user",
            "content": (
                f"Page Title: {page_title}\n\n"
                f"Request: {extraction_prompt}\n\n"
                f"HTML Content:\n{page_content[:10000]}\n\n"
                f"Extract data in JSON format."
            ),
        }

        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            messages=[user_message],
        )

        response_text = response.content[0].text
        logging.debug(f"Claude response: {response_text[:200]}...")
        return response_text

    def generate_prompt_improvements(
        self, original_prompt: str, metadata: dict[str, Any]
    ) -> str:
        """Generate suggestions for improving extraction prompts."""
        user_message: MessageParam = {
            "role": "user",
            "content": (
                f"Analyze this prompt: {original_prompt}\n\n"
                f"Results: {metadata}\n\n"
                f"Provide 3-5 suggestions as JSON."
            ),
        }

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[user_message],
        )

        return response.content[0].text
```

**src/playwright_client.py:**
```python
"""Playwright browser automation client."""

import logging
from pathlib import Path

from playwright.sync_api import Browser, Page, Playwright, sync_playwright


class PlaywrightClient:
    """Wrapper for Playwright browser automation."""

    def __init__(self, headless: bool = True):
        self.headless = headless
        self.playwright_ctx: Playwright | None = None
        self.browser: Browser | None = None
        self.page: Page | None = None
        logging.info("Initializing Playwright browser client")

    def start(self):
        """Initialize and start browser."""
        self.playwright_ctx = sync_playwright().start()
        self.browser = self.playwright_ctx.chromium.launch(headless=self.headless)
        self.page = self.browser.new_page()
        logging.info("Browser started successfully")

    def navigate(self, url: str, timeout: int = 30000):
        """Navigate to URL with timeout."""
        if not self.page:
            raise RuntimeError("Browser not started. Call start() first.")
        logging.info(f"Navigating to {url}")
        self.page.goto(url, timeout=timeout)

    def get_content(self) -> tuple[str, str]:
        """Get page title and HTML content."""
        if not self.page:
            raise RuntimeError("Browser not started")
        return self.page.title(), self.page.content()

    def screenshot(self, path: Path):
        """Capture screenshot to file."""
        if not self.page:
            raise RuntimeError("Browser not started")
        self.page.screenshot(path=str(path))
        logging.info(f"Screenshot saved: {path}")

    def close(self):
        """Clean up browser resources."""
        if self.page:
            self.page.close()
        if self.browser:
            self.browser.close()
        if self.playwright_ctx:
            self.playwright_ctx.stop()
        logging.info("Browser closed")
```

**Using clients in component.py:**
```python
from anthropic_client import AnthropicClient
from playwright_client import PlaywrightClient

class Component(ComponentBase):
    def __init__(self):
        super().__init__()
        # Load configuration and initialize clients in constructor
        # so sync_actions and other methods can use them
        self.params = self._validate_configuration()
        self.ai_client = AnthropicClient(self.params.anthropic_api_key)
        self.browser_client = PlaywrightClient(headless=True)
        self.browser_client.start()

    def run(self):
        try:
            # Configuration and clients already available via self
            self.browser_client.navigate(self.params.target_url, self.params.timeout * 1000)
            title, content = self.browser_client.get_content()

            data = self.ai_client.extract_data_from_html(title, content, self.params.prompt)
            # ... process data

        finally:
            if self.browser_client:
                self.browser_client.close()
```

### Benefits of Separate Client Files

1. **Testability**: Mock clients easily in unit tests
2. **Reusability**: Share client code across multiple component methods
3. **Separation of Concerns**: Keep API logic separate from business logic
4. **Maintainability**: Changes to API integration don't affect component logic
5. **Type Safety**: Dedicated classes provide better type hints and IDE support

### When Not to Separate

For simple cases, keep it in component.py:

```python
# ✅ FINE - Simple API call, keep in component.py
def _fetch_data(self, url: str) -> dict:
    response = requests.get(url, headers={"Authorization": f"Bearer {self.api_key}"})
    response.raise_for_status()
    return response.json()
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
