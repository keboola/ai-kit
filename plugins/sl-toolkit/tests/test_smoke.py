"""Round-trip jsonschema validation for every metastore entity type.

These tests would have caught the sql_dialect/sqlDialect divergence from PR #72:
the model schema explicitly forbids snake_case spellings via `not.anyOf`.
"""
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

ROOT      = Path(__file__).parent
FIXTURES  = ROOT / "fixtures"
SCHEMAS   = ROOT / "schemas"

ENTITY_TYPES = [
    "semantic-model",
    "semantic-dataset",
    "semantic-metric",
    "semantic-relationship",
    "semantic-glossary",
    "semantic-constraint",
]


def load(path):
    return json.loads(path.read_text())


@pytest.mark.parametrize("entity", ENTITY_TYPES)
def test_envelope_shape(entity):
    fixture = load(FIXTURES / f"{entity}.json")
    schema  = load(SCHEMAS / "envelope.json")
    Draft202012Validator(schema).validate(fixture)


@pytest.mark.parametrize("entity", ENTITY_TYPES)
def test_data_shape(entity):
    fixture = load(FIXTURES / f"{entity}.json")
    schema  = load(SCHEMAS / f"{entity}.json")
    Draft202012Validator(schema).validate(fixture["data"])


def test_no_dialect_drift():
    """Regression test for PR #72: sqlDialect must be camelCase, never snake_case."""
    fixture = load(FIXTURES / "semantic-model.json")
    assert "sqlDialect"  in fixture["data"], "semantic-model.data must use camelCase sqlDialect"
    assert "sql_dialect" not in fixture["data"], "snake_case sql_dialect is the bug from #72"


def test_constraint_severity_suffix():
    """Constraint names must end with one of the four severity suffixes."""
    fixture = load(FIXTURES / "semantic-constraint.json")
    name    = fixture["data"]["name"]
    suffixes = ("_critical", "_warning", "_healthy", "_review")
    assert name.endswith(suffixes), f"Constraint name '{name}' lacks severity suffix"


def test_dataset_fqn_uses_projectid_db():
    """FQN must reference KEBOOLA_<id>, not bare KEBOOLA (regression: M6)."""
    fixture = load(FIXTURES / "semantic-dataset.json")
    fqn     = fixture["data"]["fqn"]
    assert fqn.startswith('"KEBOOLA_'), (
        f"Dataset fqn must use KEBOOLA_<projectId> (e.g. KEBOOLA_293), got: {fqn}. "
        "Bare 'KEBOOLA' will fail at Snowflake query time in projects where the DB is "
        "named KEBOOLA_<projectId> (which is most real projects)."
    )
