"""Verify SKILL.md and command markdowns don't drift from canonical invariants.

These tests grep the markdown so changes to SKILL.md that re-introduce known bugs
(hardcoded KEBOOLA, camelCase sqlDialect, allowed-tools, etc.) fail in CI.
"""
import re
from pathlib import Path

PLUGIN_ROOT = Path(__file__).parent.parent
SKILL_MD    = PLUGIN_ROOT / "skills" / "semantic-layer" / "SKILL.md"
COMMANDS    = list((PLUGIN_ROOT / "commands").glob("*.md"))

ALL_MD = [SKILL_MD] + COMMANDS


def read(path):
    return path.read_text()


def test_skill_md_exists():
    assert SKILL_MD.is_file(), f"Missing canonical skill: {SKILL_MD}"


def test_no_hardcoded_keboola_in_fqn_construction():
    """Regression: M6 — fqn() must not hardcode "KEBOOLA". Allow educational mentions only."""
    text = read(SKILL_MD)
    # The literal pattern `f'"KEBOOLA"."` (without _projectId) is the bug.
    bad = re.findall(r'f[\'"][^\'"]*"KEBOOLA"\.', text)
    assert not bad, (
        f"SKILL.md contains hardcoded f-string `\"KEBOOLA\".` (no _projectId): {bad}. "
        "Use db_name() to resolve KEBOOLA_<projectId> at runtime."
    )

    for cmd in COMMANDS:
        cmd_text = read(cmd)
        bad = re.findall(r'f[\'"][^\'"]*"KEBOOLA"\.', cmd_text)
        # Allow 'KEBOOLA' only as a fallback in db resolution (preceded by 'falling back' / 'DB_NAME = ')
        for match in bad:
            ctx_idx = cmd_text.find(match)
            ctx     = cmd_text[max(0, ctx_idx-100):ctx_idx]
            assert 'falling back' in ctx or 'DB_NAME' in ctx, (
                f"{cmd.name}: hardcoded KEBOOLA fqn construction at offset {ctx_idx}: {match}"
            )


def test_sqldialect_is_snakecase():
    """The metastore semantic-model schema requires snake_case `sql_dialect`
    (see go-monorepo services/metastore/migrations/schema/semantic-model_schema_1.0.0.json:
    required=["name","sql_dialect"]). camelCase `sqlDialect` is silently ignored, so the
    required key is missing and the very first POST fails with 422. PR #72 pinned the wrong
    spelling; this asserts the correct one."""
    text = read(SKILL_MD)
    assert "sql_dialect" in text, "SKILL.md must document snake_case sql_dialect (metastore contract)"
    assert "sqlDialect" not in text, "camelCase sqlDialect is rejected by the metastore API"


def test_constraint_rule_is_documented():
    """The metastore semantic-constraint schema requires a string `rule`; documenting only
    `ruleExpression` causes 422 missing property 'rule'. SKILL.md must show `rule` in the
    semantic-constraint payload."""
    text = read(SKILL_MD)
    section = text[text.find("### semantic-constraint"):]
    section = section[: section.find("\n---")]
    assert '"rule"' in section, (
        "SKILL.md semantic-constraint payload must include the required string `rule` — "
        "ruleExpression alone is rejected by the metastore with 422 missing property 'rule'."
    )


def test_no_allowed_tools_wildcard_in_skill_frontmatter():
    """Regression: L12 — reference skill must not declare allowed-tools: ['*']."""
    text = read(SKILL_MD)
    # Extract frontmatter (first --- ... --- block)
    m = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
    assert m, "SKILL.md must have YAML frontmatter"
    fm = m.group(1)
    assert "allowed-tools" not in fm, (
        f"L12 regression: allowed-tools is meaningless on a reference skill. Frontmatter:\n{fm}"
    )


def test_multi_cloud_regex_used():
    """Regression: H1 — auth regex must match gcp|aws|azure, not just gcp."""
    text = read(SKILL_MD)
    # Find every connection-URL regex
    patterns = re.findall(r"r['\"]connection\\\.\([^)]+\)\\\.[^'\"]+keboola\\\.com['\"]", text)
    assert patterns, "SKILL.md must have at least one connection-URL regex"
    for p in patterns:
        assert "gcp|aws|azure" in p, (
            f"H1 regression: regex {p} is GCP-only; must match gcp|aws|azure"
        )


def test_no_literal_placeholder_strings_in_python_heredocs():
    """Regression: H2c — no literal 'PROJECT'/'TOKEN'/'METASTORE'/'CONV_ID' strings."""
    literals = ["'PROJECT_ALIAS'", "'CONV_ID'", "'TOKEN'", "'METASTORE'"]
    for md in ALL_MD:
        text = read(md)
        for lit in literals:
            assert lit not in text, (
                f"H2c regression in {md.name}: found placeholder literal {lit}. "
                "Use os.environ['...'] or a Python variable instead."
            )


def test_constraint_push_includes_semantic_constraint():
    """Regression: C1 — /sl-build push loop must include semantic-constraint."""
    sl_build = PLUGIN_ROOT / "commands" / "sl-build.md"
    assert sl_build.is_file()
    text = read(sl_build)
    # The push-loop tuple list should include semantic-constraint
    push_section = text[text.find("for type_path"):]
    assert "'semantic-constraint'" in push_section[:600], (
        "C1 regression: /sl-build push loop is missing 'semantic-constraint'. "
        "Greenfield models generate constraints but never persist them."
    )


def test_version_rule_does_not_hardcode_actual_only():
    """Regression: M7 — VERSION rule must instruct probing distinct values, not hardcode 'Actual'."""
    text = read(SKILL_MD)
    # Find the VERSION rule documentation block
    match = re.search(r"VERSION tables.*?(?=\n-\s|\n###|\Z)", text, re.DOTALL)
    assert match, "SKILL.md must document VERSION-table rule"
    block = match.group(0)
    assert "distinct values" in block.lower() or "probe" in block.lower(), (
        f"M7 regression: VERSION rule must instruct probing distinct values "
        f"before applying 'Actual'/'Budget' literals. Block:\n{block[:400]}"
    )
