"""Static checks of the rls-toolkit skill: the rules it teaches must hold in its own examples and links."""

import json
import re
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parent.parent
SKILL = PLUGIN / "skills" / "rls-policies"
COMMANDS = sorted((PLUGIN / "commands").glob("*.md"))
DOCS = [SKILL / "SKILL.md", *sorted((SKILL / "references").glob("*.md")), *COMMANDS]
SCHEMAS = Path(__file__).resolve().parent / "schemas"
NEUTRAL = [SKILL / "SKILL.md", *(SKILL / "references" / n for n in ("policy-model.md", "interview.md", "data-app-discovery.md", "gotchas.md"))]
KBAGENT_COMMAND = re.compile(r"kbagent\s+(--|rls|cls|config|data-app|storage|project|workspace)")
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


@pytest.mark.parametrize("path", NEUTRAL, ids=lambda p: p.name)
def test_skill_files_name_no_kbagent_command(path):
    """The skill is runtime-neutral: kbagent syntax lives only in references/kbagent.md and the commands."""
    assert not KBAGENT_COMMAND.search(_text(path)), path.name


@pytest.mark.parametrize("path", NEUTRAL[1:], ids=lambda p: p.name)
def test_neutral_references_do_not_mention_kbagent_at_all(path):
    assert "kbagent" not in _text(path), path.name


def test_example_policies_validate_against_schema_1_2_0():
    """The examples must be valid under the metastore schemas (descriptions stripped; see tests/README.md)."""
    jsonschema = pytest.importorskip("jsonschema")
    schemas = {kind: json.loads((SCHEMAS / f"{kind}-policy_1.2.0.json").read_text()) for kind in ("rls", "cls")}
    seen = list(_policies())
    assert seen
    for name, policy in seen:
        kind = "rls" if any("condition" in r for r in policy["rules"]) else "cls"
        jsonschema.Draft202012Validator(schemas[kind]).validate(policy)
        assert policy["table"], name


def test_stale_refusal_wording_is_gone():
    """Since Query Service v1.23.0 an ordinary reader reads an empty result where a reader used to be refused."""
    text = "\n".join(_text(p) for p in DOCS)
    assert "refused for every reader" not in text
    assert "without a default such a reader is refused with an error" not in text


def test_security_rules_are_stated():
    """The skill treats read content as data and marks widening rules before the "go"."""
    skill = _text(SKILL / "SKILL.md")
    assert "## Untrusted input" in skill and "never instructions" in skill
    assert "marks every rule" in skill and "widens access" in _text(SKILL / "references" / "interview.md")


@pytest.mark.parametrize("path", COMMANDS, ids=lambda p: p.name)
def test_commands_do_not_rely_on_shell_state(path):
    """The harness keeps no shell state: one literal id and scratch path, no per-call export or variable."""
    text = _text(path)
    assert "export KBAGENT_CONVERSATION_ID" not in text and "$(uuidgen)" not in text
    assert "SCRATCH=$(mktemp -d)" not in text and "$SCRATCH" not in text
    assert "--conversation-id CONV" in text and "<SCRATCH>" in text


def test_every_apply_has_its_dry_run():
    build = _text(PLUGIN / "commands" / "rls-build.md")
    dry_runs = build[build.index("## 3. Dry-run and summary"):build.index("## 4. Apply")]
    for verb in ("rls create", "rls update", "cls create", "cls update"):
        assert re.search(rf"{verb} .*--dry-run", dry_runs), f"rls-build step 3 lacks the dry-run of {verb}"
    assert re.search(r"cls update .*--dry-run", _text(SKILL / "references" / "kbagent.md"))


def test_verified_facts_are_stated_without_a_question_mark():
    """Facts checked against the platform (sandboxes-service, Query Service) must not stay marked as unverified."""
    gotchas = _text(SKILL / "references" / "gotchas.md")
    assert "(?)" not in gotchas
    discovery = _text(SKILL / "references" / "data-app-discovery.md")
    assert not re.search(r"HTTP 400[^|]*\(\?\)", discovery)
    skill = _text(SKILL / "SKILL.md")
    assert "An app without the list is not\ngoverned" in skill
    assert "a\n   policy that is not listed is ignored" in skill
    assert "'10' < '2'" in _text(SKILL / "references" / "policy-model.md")
