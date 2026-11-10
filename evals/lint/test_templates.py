"""Tier 0 — every app template with `keboola-config/supervisord/` can also run as a draft.

A draft starts from `keboola-config/supervisord-dev/`; without it the draft stays `pending`.
"""

from __future__ import annotations

import pytest

from common import PLUGINS_DIR

TEMPLATES = sorted(p.parent.parent for p in PLUGINS_DIR.glob("**/templates/*/keboola-config/supervisord"))


@pytest.mark.parametrize("template", TEMPLATES, ids=[t.name for t in TEMPLATES])
def test_template_ships_dev_mode(template):
    dev = template / "keboola-config" / "supervisord-dev"
    assert list(dev.glob("*/*.conf")), f"{template.name}: no supervisord-dev/*/*.conf"
