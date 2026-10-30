"""Static checks of the rls-toolkit skill: the rules the skill teaches must hold in its own examples."""

import json
import re
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parent.parent
SKILL = PLUGIN / "skills" / "rls-policies"
DOCS = [SKILL / "SKILL.md", *sorted((SKILL / "references").glob("*.md")), *sorted((PLUGIN / "commands").glob("*.md"))]
JSON_BLOCK = re.compile(r"```json\n(.*?)\n```", re.S)


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _policies():
    for path in DOCS:
        for block in JSON_BLOCK.findall(_text(path)):
            data = json.loads(block)
            if isinstance(data, dict) and "rules" in data and "table" in data:
                yield path.name, data


def test_skill_frontmatter_has_no_allowed_tools():
    front = _text(SKILL / "SKILL.md").split("---")[1]
    assert "allowed-tools" not in front


def test_skill_documents_the_working_directory():
    assert "## Working Directory Context" in _text(SKILL / "SKILL.md")


@pytest.mark.parametrize("path", DOCS, ids=lambda p: p.name)
def test_no_email_selector_and_no_removed_kbagent_group(path):
    text = _text(path)
    assert not re.search(r'"principals?"\s*:', text), "email is not a selector in schema 1.2.0"
    assert "kbagent tool call" not in text, "the tool group was removed in kbagent 0.85.0"


def test_example_policies_are_well_formed():
    seen = list(_policies())
    assert seen, "the references must carry example policies"
    for name, policy in seen:
        assert re.fullmatch(r"[A-Za-z0-9_.\-]+\.[A-Za-z0-9_\-]+", policy["table"]), name
        for rule in policy["rules"]:
            assert ("groups" in rule) != ("subjects" in rule), f"{name}: exactly one selector per rule"
        rls = [r for r in policy["rules"] if "condition" in r]
        if rls:
            assert "default" in policy, f"{name}: an rls example always sets a default"
        cls = [r for r in policy["rules"] if "visible_columns" in r]
        assert not (rls and cls), name
        assert not (cls and "default" in policy), f"{name}: a cls-policy has no default"


def test_every_command_asks_for_go_before_writing():
    assert '"go"' in _text(PLUGIN / "commands" / "rls-build.md")
    assert "--dry-run" in _text(PLUGIN / "commands" / "rls-build.md")
