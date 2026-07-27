"""Round-trip jsonschema validation for every metastore entity type.

These tests guard against key-name drift from the metastore contract: the model schema
requires snake_case `sql_dialect` and forbids the camelCase spelling via `not.anyOf`, and
the constraint fixture must carry the required string `rule`.
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
    """The metastore requires snake_case `sql_dialect`; camelCase `sqlDialect` is ignored and
    the required key ends up missing (422 on the first POST). Assert the correct spelling."""
    fixture = load(FIXTURES / "semantic-model.json")
    assert "sql_dialect" in fixture["data"], "semantic-model.data must use snake_case sql_dialect"
    assert "sqlDialect" not in fixture["data"], "camelCase sqlDialect is rejected by the metastore API"


def test_constraint_requires_rule():
    """The metastore semantic-constraint schema requires a string `rule` (required=[...,'rule',...]).
    `ruleExpression` alone triggers 422 missing property 'rule'. Send both: `rule` for the API,
    `ruleExpression` for downstream pipelines that read the bounds."""
    fixture = load(FIXTURES / "semantic-constraint.json")["data"]
    assert isinstance(fixture.get("rule"), str) and fixture["rule"], "constraint must include a string `rule`"
    assert "ruleExpression" in fixture, "constraint should retain ruleExpression for downstream pipelines"


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
