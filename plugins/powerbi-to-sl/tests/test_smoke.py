"""Smoke tests for the powerbi-to-sl migrator.

Run: python3 -m pytest tests/
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PLUGIN_ROOT / "scripts"))
import migrate  # noqa: E402

SYNTHETIC = PLUGIN_ROOT / "fixtures" / "synthetic"
SCHEMAS = Path(
    os.environ.get(
        "SCHEMAS_DIR",
        "/Users/jordanburger/Keboola/metastore_experiment/schemas",
    )
)


@pytest.fixture()
def synthetic_run(tmp_path: Path) -> Path:
    out = tmp_path / "out"
    rc = migrate.main(
        [
            "--input", str(SYNTHETIC),
            "--input-format", "per-table-json",
            "--bucket-prefix", "in.c-test-powerbi",
            "--model-name", "test-pbi-migration",
            "--output", str(out),
        ]
    )
    assert rc == 0
    return out


def test_emits_model_header(synthetic_run: Path):
    model = json.loads((synthetic_run / "semantic-model.json").read_text())
    assert model["name"] == "test-pbi-migration"
    assert model["sql_dialect"] == "Snowflake"
    assert "powerbi-migration" in model["tags"]


def test_emits_one_dataset_per_table(synthetic_run: Path):
    datasets = sorted((synthetic_run / "semantic-dataset").glob("*.json"))
    assert {d.stem for d in datasets} == {"sales", "products"}


def test_dataset_fields_carry_role_and_type(synthetic_run: Path):
    sales = json.loads(
        (synthetic_run / "semantic-dataset" / "sales.json").read_text()
    )
    by_name = {f["name"]: f for f in sales["fields"]}
    assert by_name["OrderId"]["type"] == "integer"
    assert by_name["OrderId"]["role"] == "key"
    assert by_name["OrderDate"]["role"] == "timestamp"
    assert by_name["Quantity"]["role"] == "measure"
    assert by_name["Channel"]["role"] == "dimension"


def test_primary_key_inferred_from_iskey(synthetic_run: Path):
    sales = json.loads(
        (synthetic_run / "semantic-dataset" / "sales.json").read_text()
    )
    assert sales["primaryKey"] == ["OrderId"]


def test_metrics_preserve_dax_verbatim(synthetic_run: Path):
    revenue = json.loads(
        (synthetic_run / "semantic-metric" / "total-revenue.json").read_text()
    )
    assert "SUMX('Sales'" in revenue["sql"]
    assert revenue["dataset"] == "in.c-test-powerbi.sales"


def test_complex_dax_logged_to_warnings(synthetic_run: Path):
    warnings = (synthetic_run / "WARNINGS.md").read_text()
    assert "Revenue YoY %" in warnings


def test_relationships_emit_inner_join_for_many_to_one(synthetic_run: Path):
    rel = json.loads(
        (
            synthetic_run / "semantic-relationship" / "sales__products.json"
        ).read_text()
    )
    assert rel["from"] == "in.c-test-powerbi.sales"
    assert rel["to"] == "in.c-test-powerbi.products"
    assert rel["type"] == "inner"
    assert 'from."ProductId" = to."ProductId"' in rel["on"]


@pytest.mark.skipif(
    not SCHEMAS.exists(),
    reason=f"metastore schemas not present at {SCHEMAS}",
)
def test_emitted_payloads_validate_against_keboola_schemas(synthetic_run: Path):
    """Validate against the real Keboola metastore JSON schemas.

    Skipped automatically if the schemas aren't on disk. Point SCHEMAS_DIR at
    any folder containing the `semantic-*_schema_1.0.0.json` files to
    override.
    """
    jsonschema = pytest.importorskip("jsonschema")

    def _load(name: str) -> dict:
        return json.loads(
            (SCHEMAS / f"semantic-{name}_schema_1.0.0.json").read_text()
        )

    jsonschema.validate(
        json.loads((synthetic_run / "semantic-model.json").read_text()),
        _load("model"),
    )
    dataset_schema = _load("dataset")
    metric_schema = _load("metric")
    rel_schema = _load("relationship")
    for f in (synthetic_run / "semantic-dataset").glob("*.json"):
        jsonschema.validate(json.loads(f.read_text()), dataset_schema)
    for f in (synthetic_run / "semantic-metric").glob("*.json"):
        jsonschema.validate(json.loads(f.read_text()), metric_schema)
    for f in (synthetic_run / "semantic-relationship").glob("*.json"):
        jsonschema.validate(json.loads(f.read_text()), rel_schema)
