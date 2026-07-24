"""Shared discovery helpers for ai-kit skill evals (Tier 0 lint + Tier 1 activation)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
PLUGINS_DIR = REPO_ROOT / "plugins"
MARKETPLACE_JSON = REPO_ROOT / ".claude-plugin" / "marketplace.json"


@dataclass
class Skill:
    """One SKILL.md with parsed frontmatter."""

    plugin: str
    skill_dir: Path  # directory containing SKILL.md
    path: Path  # the SKILL.md itself
    frontmatter: dict = field(default_factory=dict)
    frontmatter_error: str | None = None
    body: str = ""

    @property
    def dir_name(self) -> str:
        return self.skill_dir.name

    @property
    def name(self) -> str:
        return str(self.frontmatter.get("name", "") or "")

    @property
    def description(self) -> str:
        return str(self.frontmatter.get("description", "") or "")

    @property
    def qualified(self) -> str:
        return f"{self.plugin}:{self.dir_name}"


def parse_frontmatter(text: str) -> tuple[dict | None, str, str | None]:
    """Return (frontmatter dict, body, error). frontmatter is None when absent."""
    if not text.startswith("---\n"):
        return None, text, "file does not start with '---' frontmatter"
    end = text.find("\n---", 4)
    if end == -1:
        return None, text, "frontmatter is never closed with '---'"
    raw = text[4:end]
    body = text[end + 4 :]
    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError as exc:
        return None, body, f"frontmatter is not valid YAML: {exc}"
    if not isinstance(data, dict):
        return None, body, f"frontmatter is not a mapping (got {type(data).__name__})"
    return data, body, None


def discover_skills() -> list[Skill]:
    """Find every SKILL.md under plugins/ and parse its frontmatter."""
    skills = []
    for path in sorted(PLUGINS_DIR.glob("**/SKILL.md")):
        plugin = path.relative_to(PLUGINS_DIR).parts[0]
        fm, body, err = parse_frontmatter(path.read_text(encoding="utf-8"))
        skills.append(
            Skill(
                plugin=plugin,
                skill_dir=path.parent,
                path=path,
                frontmatter=fm or {},
                frontmatter_error=err,
                body=body,
            )
        )
    return skills


def discover_markdown(kind: str) -> list[Path]:
    """All command or agent markdown files across plugins (kind: 'commands'|'agents')."""
    return sorted(PLUGINS_DIR.glob(f"*/{kind}/*.md"))


@dataclass
class ActivationCase:
    query: str
    should_trigger: bool


@dataclass
class ActivationCaseSet:
    """trigger-evals.json for one skill: plugins/<plugin>/evals/<skill-dir>/trigger-evals.json."""

    plugin: str
    skill_dir_name: str
    path: Path
    cases: list[ActivationCase]


def discover_activation_cases() -> list[ActivationCaseSet]:
    sets = []
    for path in sorted(PLUGINS_DIR.glob("*/evals/*/trigger-evals.json")):
        plugin = path.relative_to(PLUGINS_DIR).parts[0]
        raw = json.loads(path.read_text(encoding="utf-8"))
        cases = [
            ActivationCase(query=c["query"], should_trigger=bool(c["should_trigger"]))
            for c in raw
        ]
        sets.append(
            ActivationCaseSet(
                plugin=plugin,
                skill_dir_name=path.parent.name,
                path=path,
                cases=cases,
            )
        )
    return sets


# Paths inside a skill/plugin that SKILL.md may reference and that must exist.
# Restricted to the skill-internal directory conventions so user-project paths
# never false-positive. `scripts/` is deliberately excluded: user component
# repos conventionally contain scripts/ too (e.g. scripts/build_n_test.sh),
# so a scripts/ mention in a SKILL.md usually points at the USER's repo.
INTERNAL_REF_RE = re.compile(
    r"`((?:\.\./[a-z0-9-]+/)?(?:references|template|templates|assets|examples)/[A-Za-z0-9_./\-]+)`"
)

MARKDOWN_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
