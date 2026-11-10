"""Tier 0 — every app template with `keboola-config/supervisord/` can also run as a draft.

A draft starts from `keboola-config/supervisord-dev/` and `setup-dev.sh`; without them it stays `pending`.
"""

from __future__ import annotations

import os

import pytest

from common import PLUGINS_DIR

TEMPLATES = sorted(p.parent.parent for p in PLUGINS_DIR.glob("**/templates/*/keboola-config/supervisord"))


@pytest.mark.parametrize("template", TEMPLATES, ids=[t.name for t in TEMPLATES])
def test_template_ships_dev_mode(template):
    config = template / "keboola-config"
    assert list(config.glob("supervisord-dev/*/*.conf")), f"{template.name}: no supervisord-dev/*/*.conf"
    setup_dev = config / "setup-dev.sh"
    assert setup_dev.is_file(), f"{template.name}: no setup-dev.sh"
    assert os.access(setup_dev, os.X_OK), f"{template.name}: setup-dev.sh is not executable"
