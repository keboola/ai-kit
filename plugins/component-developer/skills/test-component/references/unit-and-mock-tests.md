# Unit Tests and Mock-Based Tests

## Unit tests

Test individual functions and methods in isolation — no KBC_DATADIR needed.

```python
class TestDataTransformation(unittest.TestCase):

    def test_normalize_field_name(self):
        from component import normalize_field_name
        self.assertEqual(normalize_field_name("First Name"), "first_name")
        self.assertEqual(normalize_field_name("ID#"), "id_")

    def test_parse_date_invalid(self):
        from component import parse_date
        with self.assertRaises(ValueError):
            parse_date("not-a-date")
```

Unit tests are appropriate for: data transformation functions, validation logic,
configuration parsing, complex business rules. Avoid testing implementation details
(private methods, internal state) — test behaviour through the public interface.

## Mocking external APIs

For components that call external APIs, patch at the point of use (where the name
is looked up, not where it's defined):

```python
from unittest.mock import patch, MagicMock

@patch("component.requests.get")
def test_api_extraction(self, mock_get):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"data": [{"id": 1}, {"id": 2}]}
    mock_get.return_value = mock_response

    Component().run()

    mock_get.assert_called_once()
```

If the component uses a separate client class:

```python
@patch("component.ApiClient.get_data")
def test_via_client(self, mock_get):
    mock_get.return_value = [{"id": 1}]
    Component().run()
    mock_get.assert_called_once_with(limit=100)
```

**Note:** For extractors and writers that call HTTP APIs, prefer VCR tests over
manual mocks — see `references/vcr/quickstart.md`. Mocks are appropriate when the
component has no HTTP calls or when unit-testing a function in isolation.

## Time-dependent tests

Use `freezegun` when component behaviour depends on the current time (incremental
load watermarks, date-range calculations, etc.):

```python
from freezegun import freeze_time

@freeze_time("2024-01-15 10:30:00")
def test_incremental_watermark(self):
    self._set_datadir("test_incremental")
    Component().run()
    with open(Path(os.environ["KBC_DATADIR"]) / "out" / "state.json") as f:
        state = json.load(f)
    self.assertEqual(state["last_run"], "2024-01-15T10:30:00")
```

## By component type

### Extractors

```python
@patch("component.api_client.fetch_data")
def test_extract_incremental(self, mock_fetch):
    mock_fetch.return_value = [{"id": 10}, {"id": 11}]
    datadir = self._set_datadir("test_incremental")
    Component().run()

    with open(datadir / "out" / "state.json") as f:
        state = json.load(f)
    self.assertGreater(state["last_id"], 0)
```

### Writers

```python
@patch("component.api_client.write_data")
def test_write_rows(self, mock_write):
    self._set_datadir("test_write")  # has in/tables/input.csv
    Component().run()

    mock_write.assert_called_once()
    written_rows = mock_write.call_args[0][0]
    self.assertEqual(len(written_rows), 10)
```

### Applications (transformations)

No mocking needed — applications typically read from `in/tables/` and write to
`out/tables/` without external calls:

```python
def test_transform(self):
    datadir = self._set_datadir("test_transform")
    Component().run()

    output = datadir / "out" / "tables" / "transformed.csv"
    with open(output) as f:
        rows = list(csv.DictReader(f))
    self.assertTrue(all(row["status"] == "active" for row in rows))
```

## pytest fixtures

For shared test data across multiple tests:

```python
import pytest

@pytest.fixture
def sample_response():
    return {"data": [{"id": 1, "name": "Test"}]}

def test_process_response(sample_response):
    result = process_api_response(sample_response)
    assert len(result) == 1
    assert result[0]["name"] == "Test"
```
