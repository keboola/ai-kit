"""Offline validation of activation case sets (no API key needed).

Ensures every skill has a trigger-evals.json, every case set belongs to a
real skill, and each set is balanced enough to measure both precision and
recall. Runs on every PR alongside the Tier 0 lint; the LLM-backed routing
run lives in run_activation.py.
"""

from __future__ import annotations

import json

import pytest

from common import discover_activation_cases, discover_skills

SKILLS = discover_skills()
SKILLS_BY_DIR = {s.dir_name: s for s in SKILLS}
CASE_SETS = discover_activation_cases()
CASE_SET_IDS = [f"{cs.plugin}:{cs.skill_dir_name}" for cs in CASE_SETS]

MIN_CASES = 6
MIN_POSITIVE = 2
MIN_NEGATIVE = 2


def test_every_skill_has_activation_cases():
    covered = {cs.skill_dir_name for cs in CASE_SETS}
    missing = sorted(s.dir_name for s in SKILLS if s.dir_name not in covered)
    assert not missing, (
        f"Skills without activation cases (plugins/<plugin>/evals/<skill>/"
        f"trigger-evals.json): {missing}"
    )


@pytest.mark.parametrize("case_set", CASE_SETS, ids=CASE_SET_IDS)
def test_case_set_belongs_to_real_skill(case_set):
    assert case_set.skill_dir_name in SKILLS_BY_DIR, (
        f"{case_set.path}: no skill directory named {case_set.skill_dir_name!r} — "
        "the eval dir must be named after the skill it tests"
    )
    skill = SKILLS_BY_DIR[case_set.skill_dir_name]
    assert skill.plugin == case_set.plugin, (
        f"{case_set.path}: skill {case_set.skill_dir_name} lives in plugin "
        f"{skill.plugin!r}, not {case_set.plugin!r}"
    )


@pytest.mark.parametrize("case_set", CASE_SETS, ids=CASE_SET_IDS)
def test_case_set_shape(case_set):
    raw = json.loads(case_set.path.read_text(encoding="utf-8"))
    assert isinstance(raw, list)
    for i, case in enumerate(raw):
        assert set(case) == {"query", "should_trigger"}, (
            f"{case_set.path}[{i}]: cases must have exactly query + should_trigger"
        )
        assert isinstance(case["query"], str) and case["query"].strip()
        assert isinstance(case["should_trigger"], bool)


@pytest.mark.parametrize("case_set", CASE_SETS, ids=CASE_SET_IDS)
def test_case_set_balance(case_set):
    positives = sum(1 for c in case_set.cases if c.should_trigger)
    negatives = len(case_set.cases) - positives
    assert len(case_set.cases) >= MIN_CASES, (
        f"{case_set.path}: only {len(case_set.cases)} cases (min {MIN_CASES})"
    )
    assert positives >= MIN_POSITIVE, (
        f"{case_set.path}: needs >= {MIN_POSITIVE} should_trigger=true cases to measure recall"
    )
    assert negatives >= MIN_NEGATIVE, (
        f"{case_set.path}: needs >= {MIN_NEGATIVE} should_trigger=false cases to measure precision"
    )


@pytest.mark.parametrize("case_set", CASE_SETS, ids=CASE_SET_IDS)
def test_no_duplicate_queries(case_set):
    queries = [c.query for c in case_set.cases]
    dupes = {q for q in queries if queries.count(q) > 1}
    assert not dupes, f"{case_set.path}: duplicate queries: {sorted(dupes)[:3]}"
