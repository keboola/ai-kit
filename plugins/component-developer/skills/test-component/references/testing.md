# Component Testing Guide

Complete guide for testing Keboola Python components using datadir tests and unit tests.

## Overview

Keboola components should be tested with:
1. **Datadir Tests** - Functional tests using the standard data directory structure
2. **Unit Tests** - Testing individual functions and methods
3. **Integration Tests** - Testing API interactions with mocked responses

## Datadir Testing

Datadir testing is the **standard approach** for testing Keboola components. It mirrors the production environment by using the same data directory structure.

### Directory Structure

The standard structure for datadir tests:

```
tests/
├── test_component.py
└── data/                    # or data_examples/
    ├── test_case_1/
    │   ├── config.json
    │   ├── in/
    │   │   ├── state.json
    │   │   ├── tables/
    │   │   │   ├── input.csv
    │   │   │   └── input.csv.manifest
    │   │   └── files/
    │   └── out/             # Expected outputs (for comparison)
    │       ├── state.json
    │       ├── tables/
    │       │   ├── output.csv
    │       │   └── output.csv.manifest
    │       └── files/
    ├── test_case_2/
    │   └── ...
    └── test_case_3/
        └── ...
```

### Basic Test Pattern

The simplest and most common pattern:

```python
import sys
import os
# Add src directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import unittest
from pathlib import Path
from component import Component


class TestComponent(unittest.TestCase):

    def setUp(self):
        """Set KBC_DATADIR to point to test data directory."""
        path = os.path.join(
            os.path.dirname(os.path.realpath(__file__)),
            'data',
            'test_full_load'
        )
        os.environ["KBC_DATADIR"] = path

    def test_full_load(self):
        """Test full data extraction."""
        comp = Component()
        comp.run()

        # Assert outputs exist
        out_dir = Path(os.environ["KBC_DATADIR"]) / "out" / "tables"
        self.assertTrue((out_dir / "output.csv").exists())
```

**Key points:**
- Set `KBC_DATADIR` environment variable to point to test case directory
- No temporary directories needed - point directly to test data
- Component reads from `{KBC_DATADIR}/in/` and writes to `{KBC_DATADIR}/out/`

### Test Case Setup

Each test case directory should contain:

**1. config.json** - Component configuration:
```json
{
  "parameters": {
    "#api_key": "test-key",
    "base_id": "appTestBase",
    "table_name": "tblTestTable"
  }
}
```

**2. in/state.json** (optional) - Input state for incremental loads:
```json
{
  "last_run": "2024-01-01 00:00:00"
}
```

**3. in/tables/** (optional) - Input CSV files with manifests (for writers/applications)

**4. out/** - Expected output files for comparison (optional but recommended)

### Testing with Mocks

For API-based components (extractors), mock external API calls:

```python
import unittest
import mock
from freezegun import freeze_time
from component import Component


class TestComponent(unittest.TestCase):

    def setUp(self):
        path = os.path.join(
            os.path.dirname(__file__),
            'data',
            'test_api_extraction'
        )
        os.environ["KBC_DATADIR"] = path

    @freeze_time("2024-01-15")
    @mock.patch("component.requests.get")
    def test_api_extraction(self, mock_get):
        """Test API data extraction with mocked response."""
        # Mock API response
        mock_response = mock.Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {"id": 1, "name": "Record 1"},
                {"id": 2, "name": "Record 2"}
            ]
        }
        mock_get.return_value = mock_response

        # Run component
        comp = Component()
        comp.run()

        # Assert API was called correctly
        mock_get.assert_called_once()

        # Assert output exists
        out_file = Path(os.environ["KBC_DATADIR"]) / "out" / "tables" / "output.csv"
        self.assertTrue(out_file.exists())
```

### Comparing Output Files

**Simple existence check:**
```python
def test_output_exists(self):
    comp = Component()
    comp.run()

    out_dir = Path(os.environ["KBC_DATADIR"]) / "out" / "tables"
    self.assertTrue((out_dir / "output.csv").exists())
    self.assertTrue((out_dir / "output.csv.manifest").exists())
```

**CSV content comparison:**
```python
import csv

def test_output_content(self):
    comp = Component()
    comp.run()

    # Read expected output
    expected_file = Path(__file__).parent / "data" / "test_case" / "out" / "tables" / "output.csv"
    with open(expected_file, 'r') as f:
        expected_reader = csv.DictReader(f)
        expected_rows = list(expected_reader)

    # Read actual output
    actual_file = Path(os.environ["KBC_DATADIR"]) / "out" / "tables" / "output.csv"
    with open(actual_file, 'r') as f:
        actual_reader = csv.DictReader(f)
        actual_rows = list(actual_reader)

    # Compare (order-independent for dict comparison)
    self.assertEqual(len(expected_rows), len(actual_rows))
    for expected, actual in zip(expected_rows, actual_rows):
        self.assertEqual(expected, actual)
```

**Manifest comparison:**
```python
import json

def test_output_manifest(self):
    comp = Component()
    comp.run()

    manifest_file = Path(os.environ["KBC_DATADIR"]) / "out" / "tables" / "output.csv.manifest"
    with open(manifest_file, 'r') as f:
        manifest = json.load(f)

    # Assert manifest properties
    self.assertEqual(manifest["incremental"], False)
    self.assertIn("id", manifest["columns"])
    self.assertIn("name", manifest["columns"])
```

**State file comparison:**
```python
def test_state_file(self):
    comp = Component()
    comp.run()

    state_file = Path(os.environ["KBC_DATADIR"]) / "out" / "state.json"
    with open(state_file, 'r') as f:
        state = json.load(f)

    # Assert state was updated
    self.assertIn("last_run", state)
    self.assertIsNotNone(state["last_run"])
```

### Multiple Test Cases

Create multiple test case directories for different scenarios:

```python
class TestComponent(unittest.TestCase):

    def _run_test_case(self, case_name):
        """Helper to run a test case by name."""
        path = os.path.join(
            os.path.dirname(__file__),
            'data',
            case_name
        )
        os.environ["KBC_DATADIR"] = path

        comp = Component()
        comp.run()

        return Path(path) / "out"

    def test_full_load(self):
        """Test full data load."""
        out_dir = self._run_test_case("test_full_load")
        self.assertTrue((out_dir / "tables" / "output.csv").exists())

    def test_incremental_load(self):
        """Test incremental load with state."""
        out_dir = self._run_test_case("test_incremental_load")

        # Verify state was updated
        with open(out_dir / "state.json", 'r') as f:
            state = json.load(f)
        self.assertIn("last_run", state)

    def test_empty_result(self):
        """Test handling of empty API response."""
        out_dir = self._run_test_case("test_empty_result")

        # Should create file but with only headers
        csv_file = out_dir / "tables" / "output.csv"
        with open(csv_file, 'r') as f:
            lines = f.readlines()
        self.assertEqual(len(lines), 1)  # Only header
```

### Testing Error Handling

Test that your component fails correctly:

```python
@mock.patch.dict(os.environ, {"KBC_DATADIR": "./non-existing-dir"})
def test_missing_config_fails(self):
    """Test that component fails with missing config."""
    with self.assertRaises(ValueError):
        comp = Component()

def test_invalid_config_fails(self):
    """Test that component fails with invalid config."""
    path = os.path.join(
        os.path.dirname(__file__),
        'data',
        'test_invalid_config'
    )
    os.environ["KBC_DATADIR"] = path

    with self.assertRaises(ValueError) as context:
        comp = Component()
        comp.run()

    self.assertIn("api_key", str(context.exception))
```

## Unit Testing

Test individual methods and functions separately:

```python
class TestDataTransformation(unittest.TestCase):

    def test_normalize_field_name(self):
        """Test field name normalization."""
        from component import normalize_field_name

        self.assertEqual(normalize_field_name("First Name"), "first_name")
        self.assertEqual(normalize_field_name("ID#"), "id_")
        self.assertEqual(normalize_field_name("email@domain"), "email_domain")

    def test_parse_date(self):
        """Test date parsing."""
        from component import parse_date

        result = parse_date("2024-01-15")
        self.assertEqual(result.year, 2024)
        self.assertEqual(result.month, 1)
        self.assertEqual(result.day, 15)

        # Test invalid date
        with self.assertRaises(ValueError):
            parse_date("invalid-date")
```

## Testing Best Practices

### 1. Use Fixtures for Test Data

Store common test data in fixtures:

```python
@pytest.fixture
def sample_api_response():
    return {
        "data": [
            {"id": 1, "name": "Test 1"},
            {"id": 2, "name": "Test 2"}
        ]
    }

def test_process_response(sample_api_response):
    result = process_api_response(sample_api_response)
    assert len(result) == 2
```

### 2. Test Edge Cases

Test boundary conditions and edge cases:

```python
def test_empty_response(self):
    """Test handling of empty API response."""
    # Setup test with empty expected data

def test_large_dataset(self):
    """Test handling of large datasets."""
    # Test with pagination, chunking

def test_special_characters(self):
    """Test handling of special characters in data."""
    # Test with Unicode, quotes, newlines

def test_api_rate_limiting(self):
    """Test handling of API rate limits."""
    # Mock 429 responses
```

### 3. Mock External Dependencies

Always mock external API calls and services:

```python
@mock.patch("component.api_client.ApiClient.get_data")
def test_api_call(self, mock_get):
    mock_get.return_value = {"data": [...]}
    # Test component logic
```

### 4. Use Freezegun for Time-Dependent Tests

For components with time-dependent logic:

```python
from freezegun import freeze_time

@freeze_time("2024-01-15 10:30:00")
def test_incremental_load_from_yesterday(self):
    # Test will always run as if it's Jan 15, 2024
    comp = Component()
    comp.run()
```

### 5. Clean Up After Tests

Ensure tests don't leave artifacts:

```python
def tearDown(self):
    """Clean up after each test."""
    # Remove any temporary files created during test
    out_dir = Path(os.environ["KBC_DATADIR"]) / "out"
    if out_dir.exists():
        for file in out_dir.glob("**/*"):
            if file.is_file():
                file.unlink()
```

## Running Tests

### Local Testing

```bash
# Run all tests
python -m unittest discover -s tests -p "test_*.py"

# Run specific test
python -m unittest tests.test_component.TestComponent.test_full_load

# Run with verbose output
python -m unittest discover -s tests -p "test_*.py" -v
```

### With pytest

If using pytest:

```bash
# Run all tests
pytest tests/

# Run specific test file
pytest tests/test_component.py

# Run with coverage
pytest --cov=src tests/

# Run specific test
pytest tests/test_component.py::TestComponent::test_full_load
```

### In CI/CD

Add to your GitHub Actions workflow:

```yaml
- name: Run tests
  run: |
    python -m unittest discover -s tests -p "test_*.py"
```

## Common Test Scenarios

### Testing Extractors

```python
class TestExtractor(unittest.TestCase):

    @mock.patch("component.api_client.fetch_data")
    def test_extract_full(self, mock_fetch):
        """Test full data extraction."""
        mock_fetch.return_value = [...]

        path = os.path.join(os.path.dirname(__file__), 'data', 'test_full')
        os.environ["KBC_DATADIR"] = path

        comp = Component()
        comp.run()

        # Verify output
        self.assertTrue(Path(path, "out", "tables", "data.csv").exists())

    @mock.patch("component.api_client.fetch_data")
    def test_extract_incremental(self, mock_fetch):
        """Test incremental extraction using state."""
        mock_fetch.return_value = [...]

        path = os.path.join(os.path.dirname(__file__), 'data', 'test_incremental')
        os.environ["KBC_DATADIR"] = path

        comp = Component()
        comp.run()

        # Verify state was updated
        with open(Path(path, "out", "state.json"), 'r') as f:
            state = json.load(f)
        self.assertGreater(state["last_timestamp"], 0)
```

### Testing Writers

```python
class TestWriter(unittest.TestCase):

    @mock.patch("component.api_client.write_data")
    def test_write_data(self, mock_write):
        """Test writing data to destination."""
        path = os.path.join(os.path.dirname(__file__), 'data', 'test_write')
        os.environ["KBC_DATADIR"] = path

        comp = Component()
        comp.run()

        # Verify API was called with correct data
        mock_write.assert_called_once()
        call_args = mock_write.call_args[0][0]
        self.assertEqual(len(call_args), 10)  # 10 rows written
```

### Testing Applications

```python
class TestApplication(unittest.TestCase):

    def test_transform_data(self):
        """Test data transformation logic."""
        path = os.path.join(os.path.dirname(__file__), 'data', 'test_transform')
        os.environ["KBC_DATADIR"] = path

        comp = Component()
        comp.run()

        # Verify transformation output
        output = Path(path, "out", "tables", "transformed.csv")
        with open(output, 'r') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        # Assert transformations were applied
        self.assertTrue(all(row["email"].endswith("@example.com") for row in rows))
```

## Test Data Management

### Creating Test Data

1. **Run component locally** with sample data:
   ```bash
   KBC_DATADIR=data/sample uv run src/component.py
   ```

2. **Copy output** to test case expected output:
   ```bash
   cp -r data/sample/out tests/data/test_case_1/out
   ```

3. **Adjust expected output** if needed to match desired behavior

### Sensitive Data in Tests

Never commit real credentials or sensitive data:

```json
{
  "parameters": {
    "#api_key": "test-mock-key-not-real",
    "endpoint": "https://api.example.com"
  }
}
```

For tests that need real credentials:
- Use environment variables in CI/CD
- Store in GitHub Secrets
- Load from `.env` file (not committed)

## Debugging Failed Tests

### Print Debug Information

```python
def test_with_debug(self):
    comp = Component()
    comp.run()

    # Print actual output for debugging
    out_file = Path(os.environ["KBC_DATADIR"]) / "out" / "tables" / "output.csv"
    if out_file.exists():
        with open(out_file, 'r') as f:
            print("Actual output:")
            print(f.read())
```

### Compare Expected vs Actual

```python
def test_with_diff(self):
    comp = Component()
    comp.run()

    expected = Path(__file__).parent / "data" / "test_case" / "out" / "tables" / "output.csv"
    actual = Path(os.environ["KBC_DATADIR"]) / "out" / "tables" / "output.csv"

    with open(expected, 'r') as f1, open(actual, 'r') as f2:
        expected_lines = f1.readlines()
        actual_lines = f2.readlines()

        for i, (exp, act) in enumerate(zip(expected_lines, actual_lines)):
            if exp != act:
                print(f"Line {i+1} differs:")
                print(f"Expected: {exp.strip()}")
                print(f"Actual:   {act.strip()}")
```

## Related Guides

- [Debugging Guide](debugging.md) - Local testing and debugging techniques
- [Architecture Guide](architecture.md) - Component structure and patterns
- [Code Quality Guide](code-quality.md) - Testing and quality standards
