"""Tier 0 — no dangling references in skill/command/agent markdown.

Two classes of reference are checked:

1. Backticked skill-internal paths (`references/...`, `scripts/...`,
   `template/...`, `assets/...`, `examples/...`) mentioned in a SKILL.md must
   exist relative to the skill directory. These directory prefixes are the
   ai-kit conventions for skill-owned files, so user-project paths
   (src/component.py, data/config.json, ...) never false-positive.
2. Relative markdown links in any plugin markdown must resolve on disk.

Also enforces the repo convention that skill scripts are executable and
locate themselves via BASH_SOURCE (see CLAUDE.md).
"""

from __future__ import annotations

import os

import pytest

from common import (
    INTERNAL_REF_RE,
    MARKDOWN_LINK_RE,
    PLUGINS_DIR,
    discover_skills,
)

SKILLS = discover_skills()
SKILL_IDS = [s.qualified for s in SKILLS]

ALL_PLUGIN_MD = sorted(PLUGINS_DIR.glob("**/*.md"))


@pytest.mark.parametrize("skill", SKILLS, ids=SKILL_IDS)
def test_internal_paths_exist(skill):
    text = skill.path.read_text(encoding="utf-8")
    missing = []
    for ref in sorted(set(INTERNAL_REF_RE.findall(text))):
        candidate = skill.skill_dir / ref
        if not candidate.exists():
            missing.append(ref)
    assert not missing, (
        f"{skill.path} references skill-internal files that do not exist: {missing}"
    )


@pytest.mark.parametrize(
    "path",
    ALL_PLUGIN_MD,
    ids=lambda p: str(p.relative_to(PLUGINS_DIR)),
)
def test_relative_markdown_links_resolve(path):
    text = path.read_text(encoding="utf-8")
    broken = []
    for target in MARKDOWN_LINK_RE.findall(text):
        if target.startswith(("http://", "https://", "mailto:", "#", "<")):
            continue
        # strip anchors and querystrings
        clean = target.split("#", 1)[0].split("?", 1)[0]
        if not clean:
            continue
        # Template-variable paths can't be checked statically
        if "{" in clean or "$" in clean or "*" in clean:
            continue
        resolved = (path.parent / clean).resolve()
        if not resolved.exists():
            broken.append(target)
    assert not broken, f"{path}: broken relative links: {broken}"


@pytest.mark.parametrize("skill", SKILLS, ids=SKILL_IDS)
def test_skill_scripts_are_executable(skill):
    scripts_dir = skill.skill_dir / "scripts"
    if not scripts_dir.is_dir():
        pytest.skip("skill has no scripts/")
    not_executable = [
        p.name
        for p in sorted(scripts_dir.glob("*.sh"))
        if not os.access(p, os.X_OK)
    ]
    assert not not_executable, (
        f"{skill.qualified}: scripts are not executable (chmod +x): {not_executable}"
    )


# Standalone scripts that never touch skill-relative files are exempt from
# the BASH_SOURCE self-location convention. Keep this list short and justified.
SELF_LOCATE_EXEMPT = {
    # environment installer (configures Playwright MCP); reads no skill files
    "component-developer:build-component-ui/install.sh",
}


@pytest.mark.parametrize("skill", SKILLS, ids=SKILL_IDS)
def test_skill_scripts_self_locate(skill):
    """CLAUDE.md convention: scripts detect their own location via BASH_SOURCE
    because they run from the user's project root, never the skill dir."""
    scripts_dir = skill.skill_dir / "scripts"
    if not scripts_dir.is_dir():
        pytest.skip("skill has no scripts/")
    offenders = []
    for p in sorted(scripts_dir.glob("*.sh")):
        if f"{skill.qualified.split(':')[0]}:{skill.dir_name}/{p.name}" in SELF_LOCATE_EXEMPT:
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        if "BASH_SOURCE" not in text:
            offenders.append(p.name)
    assert not offenders, (
        f"{skill.qualified}: scripts missing BASH_SOURCE self-location "
        f"(see CLAUDE.md conventions): {offenders}"
    )
