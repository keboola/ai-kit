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


def test_tmdl_parses_all_multiline_measures_and_relationships(tmp_path: Path):
    """Ensure TMDL parser extracts multiple multi-line measures and multiple relationships."""
    tmdl_dir = tmp_path / "tmdl"
    tables_dir = tmdl_dir / "tables"
    tables_dir.mkdir(parents=True)

    (tables_dir / "Fact.tmdl").write_text(
        "table Fact\n"
        "\tcolumn DateKey\n"
        "\t\tdataType: int64\n"
        "\t\tsummarizeBy: none\n"
        "\tcolumn ProductKey\n"
        "\t\tdataType: int64\n"
        "\tmeasure 'Litry LY' =\n"
        "\t\t\tCALCULATE(\n"
        "\t\t\t    SUM(Fact[volume_l]),\n"
        "\t\t\t    SAMEPERIODLASTYEAR(Calendar[Date])\n"
        "\t\t\t)\n"
        "\t\tformatString: #,0\n"
        "\t\tdescription: Liters last year\n"
        "\tmeasure 'Total Volume' = SUM(Fact[volume_l])\n"
        "\t\tformatString: #,0.0\n"
        "\tmeasure 'Fenced Metric' = ```\n"
        "\t\t\tVAR _x = 1\n"
        "\t\t\tRETURN _x\n"
        "\t\t\t```\n"
        "\t\tformatString: 0\n",
        encoding="utf-8",
    )
    (tables_dir / "Calendar.tmdl").write_text(
        "table Calendar\n\tcolumn DateKey\n\t\tdataType: int64\n",
        encoding="utf-8",
    )
    (tables_dir / "Product.tmdl").write_text(
        "table Product\n\tcolumn ProductKey\n\t\tdataType: int64\n",
        encoding="utf-8",
    )
    (tmdl_dir / "relationships.tmdl").write_text(
        "relationship r1\n"
        "\tfromColumn: Fact.DateKey\n"
        "\ttoColumn: Calendar.DateKey\n"
        "\n"
        "relationship r2\n"
        "\tfromColumn: Fact.ProductKey\n"
        "\ttoColumn: Product.ProductKey\n"
        "\n"
        "relationship r3_inactive\n"
        "\tfromColumn: Fact.DateKey\n"
        "\ttoColumn: Calendar.DateKey\n"
        "\tisActive: false\n",
        encoding="utf-8",
    )

    pbi = migrate.load_tmdl(tmdl_dir)
    fact = next(t for t in pbi.tables if t.name == "Fact")

    assert [m.name for m in fact.measures] == [
        "Litry LY",
        "Total Volume",
        "Fenced Metric",
    ]
    assert "SAMEPERIODLASTYEAR(Calendar[Date])" in fact.measures[0].expression
    assert fact.measures[0].description == "Liters last year"
    assert fact.measures[1].expression == "SUM(Fact[volume_l])"
    assert "RETURN _x" in fact.measures[2].expression

    assert len(pbi.relationships) == 3
    assert [r.is_active for r in pbi.relationships] == [True, True, False]


def test_emit_preserves_colliding_metric_and_relationship_slugs(tmp_path: Path):
    """Colliding metric/relationship slugs emit suffixed files + warnings without overwriting."""
    pbi = migrate.PbiModel(
        tables=[
            migrate.PbiTable(
                name="Fact",
                columns=[
                    migrate.PbiColumn(name="OrderDateKey", data_type="int64"),
                    migrate.PbiColumn(name="ShipDateKey", data_type="int64"),
                ],
                measures=[
                    migrate.PbiMeasure(name="Value AC-LY", expression="1"),
                    migrate.PbiMeasure(name="Value AC/LY", expression="2"),
                    migrate.PbiMeasure(name="WithRevenue", expression="3"),
                    migrate.PbiMeasure(name="%WithRevenue", expression="4"),
                ],
            ),
            migrate.PbiTable(
                name="Calendar",
                columns=[migrate.PbiColumn(name="DateKey", data_type="int64")],
            ),
        ],
        relationships=[
            migrate.PbiRelationship("Fact", "OrderDateKey", "Calendar", "DateKey"),
            migrate.PbiRelationship("Fact", "ShipDateKey", "Calendar", "DateKey"),
            migrate.PbiRelationship(
                "Fact", "ShipDateKey", "Calendar", "DateKey", is_active=False
            ),
        ],
    )

    out_dir = tmp_path / "out_collisions"
    warnings = migrate.emit_keboola_sl(
        pbi,
        out_dir=out_dir,
        bucket_prefix="in.c-test",
        model_name="collision-test",
        model_display="Collision Test",
    )

    metric_files = sorted((out_dir / "semantic-metric").glob("*.json"))
    assert [f.name for f in metric_files] == [
        "value-ac-ly-2.json",
        "value-ac-ly.json",
        "withrevenue-2.json",
        "withrevenue.json",
    ]
    metric_names = {json.loads(f.read_text(encoding="utf-8"))["name"] for f in metric_files}
    assert metric_names == {"Value AC-LY", "Value AC/LY", "WithRevenue", "%WithRevenue"}

    rel_files = sorted((out_dir / "semantic-relationship").glob("*.json"))
    assert [f.name for f in rel_files] == [
        "fact__calendar-2.json",
        "fact__calendar.json",
    ]
    assert any("slug collision" in w for w in warnings)
    assert any("skipped inactive relationship" in w for w in warnings)
