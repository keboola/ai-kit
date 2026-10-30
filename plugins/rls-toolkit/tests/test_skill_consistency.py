"""Static checks of the rls-toolkit skill: the rules it teaches must hold in its own examples and links."""

import json
import re
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parent.parent
SKILL = PLUGIN / "skills" / "rls-policies"
COMMANDS = sorted((PLUGIN / "commands").glob("*.md"))
DOCS = [SKILL / "SKILL.md", *sorted((SKILL / "references").glob("*.md")), *COMMANDS]
JSON_BLOCK = re.compile(r"```json\n(.*?)\n```", re.S)
WRITE_VERBS = re.compile(r"\b(rls (create|update|delete|bind|unbind)|cls (create|update|delete)|config update|data-app deploy)\b")


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _policies():
    for path in DOCS:
        for block in JSON_BLOCK.findall(_text(path)):
            data = json.loads(block)
            if isinstance(data, dict) and "rules" in data and "table" in data:
                yield path.name, data


def test_skill_frontmatter_and_working_directory_section():
    text = _text(SKILL / "SKILL.md")
    assert "allowed-tools" not in text.split("---")[1]
    assert "## Working Directory Context" in text


@pytest.mark.parametrize("path", DOCS, ids=lambda p: p.name)
def test_no_email_selector_and_no_removed_kbagent_group(path):
    text = _text(path)
    assert not re.search(r"principals?\"?\s*[:\]]", text.replace("`principal` / `principals`", "")), path.name
    assert "kbagent tool call" not in text, "the tool group was removed in kbagent 0.85.0"


@pytest.mark.parametrize("path", [SKILL / "SKILL.md", *COMMANDS], ids=lambda p: p.name)
def test_referenced_files_exist(path):
    for ref in re.findall(r"`(?:skills/rls-policies/)?references/([\w\-]+\.md)`", _text(path)):
        assert (SKILL / "references" / ref).exists(), f"{path.name}: {ref}"


def test_example_policies_are_well_formed():
    seen = list(_policies())
    assert seen, "the references must carry example policies"
    for name, policy in seen:
        assert re.fullmatch(r"[A-Za-z0-9_.\-]+\.[A-Za-z0-9_\-]+", policy["table"]), name
        for rule in policy["rules"]:
            assert ("groups" in rule) != ("subjects" in rule), f"{name}: exactly one selector per rule"
        rls = [r for r in policy["rules"] if "condition" in r]
        cls = [r for r in policy["rules"] if "visible_columns" in r]
        assert bool(rls) != bool(cls), f"{name}: a policy is either rls or cls"
        assert (not rls) or "default" in policy, f"{name}: an rls example always sets a default"
        assert not (cls and "default" in policy), f"{name}: a cls-policy has no default"


def test_rls_show_is_read_only():
    assert not WRITE_VERBS.search(_text(PLUGIN / "commands" / "rls-show.md"))


def test_rls_build_gates_every_write_behind_go():
    text = _text(PLUGIN / "commands" / "rls-build.md")
    go, apply_section = text.index('answered "go"'), text.index("## 4. Apply")
    assert go < apply_section and "Ask for \"go\"" in text
    assert text.index("--dry-run") < apply_section
