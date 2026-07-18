"""Tier 0 — frontmatter lint for every SKILL.md, command, and agent.

The `description:` field is each skill's invocation surface (what the model
routes on) and the `name:` is its identity; drift here silently breaks
activation. These checks run in seconds with no LLM.
"""

from __future__ import annotations

import re

import pytest

from common import discover_markdown, discover_skills, parse_frontmatter

SKILLS = discover_skills()
SKILL_IDS = [s.qualified for s in SKILLS]

# Claude Code constraints on skill frontmatter.
NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
MAX_NAME_LEN = 64
MAX_DESCRIPTION_LEN = 1024


def test_at_least_one_skill_discovered():
    assert SKILLS, "No SKILL.md files found under plugins/ — discovery is broken"


@pytest.mark.parametrize("skill", SKILLS, ids=SKILL_IDS)
def test_frontmatter_parses(skill):
    assert skill.frontmatter_error is None, (
        f"{skill.path}: {skill.frontmatter_error}"
    )


@pytest.mark.parametrize("skill", SKILLS, ids=SKILL_IDS)
def test_name_present_and_kebab_case(skill):
    assert skill.name, f"{skill.path}: frontmatter is missing `name:`"
    assert len(skill.name) <= MAX_NAME_LEN
    assert NAME_RE.match(skill.name), (
        f"{skill.path}: name {skill.name!r} must be kebab-case "
        "(lowercase letters, digits, hyphens)"
    )


@pytest.mark.parametrize("skill", SKILLS, ids=SKILL_IDS)
def test_name_matches_directory(skill):
    assert skill.name == skill.dir_name, (
        f"{skill.path}: frontmatter name {skill.name!r} != directory "
        f"{skill.dir_name!r} — the skill is addressed by its directory, so a "
        "mismatched name is a dead identity"
    )


@pytest.mark.parametrize("skill", SKILLS, ids=SKILL_IDS)
def test_description_present_and_bounded(skill):
    assert skill.description.strip(), f"{skill.path}: frontmatter is missing `description:`"
    assert len(skill.description) <= MAX_DESCRIPTION_LEN, (
        f"{skill.path}: description is {len(skill.description)} chars "
        f"(max {MAX_DESCRIPTION_LEN}) — overlong descriptions get truncated in "
        "the model's skill listing"
    )


def test_skill_names_unique_within_plugin():
    seen: dict[tuple[str, str], str] = {}
    for skill in SKILLS:
        key = (skill.plugin, skill.name)
        assert key not in seen, (
            f"Duplicate skill name {skill.name!r} in plugin {skill.plugin!r}: "
            f"{seen[key]} and {skill.path}"
        )
        seen[key] = str(skill.path)


@pytest.mark.parametrize(
    "path",
    discover_markdown("commands"),
    ids=lambda p: f"{p.parts[-3]}:{p.stem}",
)
def test_command_frontmatter(path):
    fm, _body, err = parse_frontmatter(path.read_text(encoding="utf-8"))
    assert err is None, f"{path}: {err}"
    assert str(fm.get("description", "") or "").strip(), (
        f"{path}: command frontmatter is missing `description:` — it is the "
        "text shown in the slash-command picker"
    )


@pytest.mark.parametrize(
    "path",
    discover_markdown("agents"),
    ids=lambda p: f"{p.parts[-3]}:{p.stem}",
)
def test_agent_frontmatter(path):
    fm, _body, err = parse_frontmatter(path.read_text(encoding="utf-8"))
    assert err is None, f"{path}: {err}"
    assert str(fm.get("description", "") or "").strip(), (
        f"{path}: agent frontmatter is missing `description:` — the router "
        "cannot dispatch to an agent without one"
    )
