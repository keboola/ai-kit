"""Tier 0 — plugin markdown must not teach kbagent commands that no longer exist.

Agents copy these commands as written, so a removed command or a renamed flag
fails on the first call. Each pattern below is a form that kbagent 1.x rejects.
"""

from __future__ import annotations

import re

import pytest

from common import PLUGINS_DIR

ALL_PLUGIN_MD = sorted(PLUGINS_DIR.glob("**/*.md"))

REMOVED_FORMS = {
    "`kbagent tool call` was removed in 0.85.0; use the `data-app` commands": re.compile(
        r"kbagent\b[^\n`]*\btool call\b"
    ),
    "`project add` takes `--alias`, not `--project`": re.compile(
        r"kbagent\b[^\n`]*\bproject add\b[^\n`]*--project\b"
    ),
    "`data-app secrets-set` takes the secret as `--secret '#KEY=VAL'`, not as an argument": re.compile(
        r"data-app secrets-set\b(?:(?!--secret)[^\n`])*\s'#"
    ),
}


@pytest.mark.parametrize("path", ALL_PLUGIN_MD, ids=lambda p: str(p.relative_to(PLUGINS_DIR)))
def test_no_removed_kbagent_forms(path):
    text = path.read_text(encoding="utf-8")
    problems = [
        f"line {text.count(chr(10), 0, match.start()) + 1}: {reason}"
        for reason, pattern in REMOVED_FORMS.items()
        for match in pattern.finditer(text)
    ]
    assert not problems, f"{path}:\n" + "\n".join(problems)
