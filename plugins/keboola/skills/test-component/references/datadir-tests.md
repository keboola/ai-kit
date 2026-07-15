# Datadir Tests

Datadir testing is the primary testing method for Keboola components. It mirrors
production by setting `KBC_DATADIR` to a directory with the same structure the
platform uses at runtime.

## Directory structure

```
tests/
├── test_component.py
└── data/
    ├── test_full_load/
    │   ├── config.json
    │   ├── in/
    │   │   ├── state.json          # optional — for incremental tests
    │   │   └── tables/
    │   │       ├── input.csv
    │   │       └── input.csv.manifest
    │   └── out/                    # expected outputs (for comparison)
    │       ├── state.json
    │       └── tables/
    │           ├── output.csv
    │           └── output.csv.manifest
    └── test_incremental/
        └── ...
```

## Basic pattern

```python
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from component import Component


class TestComponent(unittest.TestCase):

    def _set_datadir(self, case_name):
        path = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'data', case_name)
        os.environ["KBC_DATADIR"] = path
        return Path(path)

    def test_full_load(self):
        datadir = self._set_datadir("test_full_load")
        Component().run()
        self.assertTrue((datadir / "out" / "tables" / "output.csv").exists())

    def test_incremental_load(self):
        datadir = self._set_datadir("test_incremental_load")
        Component().run()
        with open(datadir / "out" / "state.json") as f:
            state = json.load(f)
        self.assertIn("last_run", state)
```

**Key points:**
- Set `KBC_DATADIR` to point directly to the test case directory
- The component reads from `{KBC_DATADIR}/in/` and writes to `{KBC_DATADIR}/out/`
- No temporary directories — point straight to fixtures

## config.json format

```json
{
  "parameters": {
    "#api_key": "test-mock-key-not-real",
    "endpoint": "https://api.example.com",
    "limit": 100
  }
}
```

Never commit real credentials. Use obviously fake values (`"test-mock-key-not-real"`,
`"DUMMY_KEY"`) so they're clearly placeholders.

For row-based components, `config.json` contains only `parameters` — the platform
handles the row merge before the component receives the config.

## Output assertions

**File existence:**
```python
out_dir = Path(os.environ["KBC_DATADIR"]) / "out" / "tables"
self.assertTrue((out_dir / "output.csv").exists())
self.assertTrue((out_dir / "output.csv.manifest").exists())
```

**CSV content:**
```python
import csv

actual_file = Path(os.environ["KBC_DATADIR"]) / "out" / "tables" / "output.csv"
with open(actual_file) as f:
    rows = list(csv.DictReader(f))

self.assertEqual(len(rows), 5)
self.assertEqual(rows[0]["id"], "123")
```

**Manifest:**
```python
import json

manifest_file = Path(os.environ["KBC_DATADIR"]) / "out" / "tables" / "output.csv.manifest"
with open(manifest_file) as f:
    manifest = json.load(f)

self.assertEqual(manifest["incremental"], False)
self.assertIn("id", manifest["primary_key"])
```

**State file:**
```python
state_file = Path(os.environ["KBC_DATADIR"]) / "out" / "state.json"
with open(state_file) as f:
    state = json.load(f)

self.assertIn("last_run", state)
self.assertIsNotNone(state["last_run"])
```

## Error handling tests

```python
def test_invalid_config_fails(self):
    self._set_datadir("test_invalid_config")
    with self.assertRaises(ValueError) as ctx:
        Component().run()
    self.assertIn("api_key", str(ctx.exception))
```

The test data directory `test_invalid_config/config.json` should have a config
that triggers the expected error (e.g., missing a required field).

## Teardown

Component output is written into the test data directory. Clean up `out/` after each
test to avoid stale files affecting subsequent runs:

```python
def tearDown(self):
    out_dir = Path(os.environ["KBC_DATADIR"]) / "out"
    if out_dir.exists():
        for f in out_dir.glob("**/*"):
            if f.is_file():
                f.unlink()
```

Alternatively, use `tmp_path` (pytest) or `tempfile.TemporaryDirectory` and copy
input fixtures in, so the test data directory itself stays clean.

## Running tests

```bash
# All tests
uv run pytest

# Specific test
uv run pytest tests/test_component.py::TestComponent::test_full_load -v

# With coverage
uv run pytest --cov=src
```
