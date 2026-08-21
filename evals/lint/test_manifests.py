"""Tier 0 — marketplace/plugin manifest consistency.

Catches the classic drift: a plugin version bumped in plugin.json but not in
marketplace.json (or vice versa), plugins on disk that are not published, and
marketplace entries pointing at directories that do not exist.

Entries whose `source` is an object (not a path string) live in another repo —
their version is owned by that repo's release job, so the on-disk plugin.json
checks below only cover local entries.
"""

from __future__ import annotations

import json

import pytest

from common import MARKETPLACE_JSON, PLUGINS_DIR, REPO_ROOT

MARKETPLACE = json.loads(MARKETPLACE_JSON.read_text(encoding="utf-8"))
ENTRIES = {p["name"]: p for p in MARKETPLACE["plugins"]}
# Entries sourced from this repo (source is a "./plugins/<name>" path). External
# entries carry an object source and have nothing on disk to compare against.
LOCAL = {name: entry for name, entry in ENTRIES.items() if isinstance(entry["source"], str)}

# Source types Claude Code accepts for an external entry, and the keys each needs
# on top of its own "source" discriminator.
EXTERNAL_SOURCE_KEYS = {
    "github": ("repo",),
    "url": ("url",),
    "git-subdir": ("url", "path"),
}


def _plugin_json(name: str) -> dict:
    return json.loads(
        (PLUGINS_DIR / name / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8")
    )


def test_every_marketplace_source_exists():
    for name, entry in ENTRIES.items():
        if not isinstance(entry["source"], str):
            continue  # external entry — see test_external_sources_are_well_formed
        source = REPO_ROOT / entry["source"]
        assert source.is_dir(), f"marketplace.json: {name} points at missing {entry['source']}"
        assert (source / ".claude-plugin" / "plugin.json").is_file(), (
            f"{entry['source']} has no .claude-plugin/plugin.json"
        )


def test_every_plugin_dir_is_published():
    on_disk = {p.name for p in PLUGINS_DIR.iterdir() if p.is_dir()}
    unpublished = on_disk - set(ENTRIES)
    assert not unpublished, (
        f"Plugins on disk but missing from marketplace.json: {sorted(unpublished)}"
    )


@pytest.mark.parametrize("name", sorted(LOCAL))
def test_plugin_name_matches_manifest(name):
    assert _plugin_json(name)["name"] == name, (
        f"plugins/{name}/.claude-plugin/plugin.json name differs from its "
        "marketplace entry"
    )


@pytest.mark.parametrize("name", sorted(LOCAL))
def test_plugin_version_matches_marketplace(name):
    plugin_version = _plugin_json(name)["version"]
    marketplace_version = ENTRIES[name]["version"]
    assert plugin_version == marketplace_version, (
        f"{name}: plugin.json version {plugin_version} != marketplace.json "
        f"version {marketplace_version} — bump both (see CLAUDE.md)"
    )


@pytest.mark.parametrize("name", sorted(LOCAL))
def test_plugin_has_description(name):
    assert _plugin_json(name).get("description", "").strip()


def test_external_sources_are_well_formed():
    for name, entry in ENTRIES.items():
        source = entry["source"]
        if isinstance(source, str):
            continue
        assert isinstance(source, dict), (
            f"marketplace.json: {name} source must be a path string or an object, "
            f"got {type(source).__name__}"
        )
        kind = source.get("source")
        assert kind in EXTERNAL_SOURCE_KEYS, (
            f"marketplace.json: {name} has unknown source type {kind!r} — "
            f"expected one of {sorted(EXTERNAL_SOURCE_KEYS)}"
        )
        missing = [key for key in EXTERNAL_SOURCE_KEYS[kind] if not source.get(key)]
        assert not missing, (
            f"marketplace.json: {name} is a {kind} source missing {missing}"
        )
