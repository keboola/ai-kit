"""Offline tests for the classifier-reply parser (no API key needed).

Regressions guarded (PR #89 review): the parser must not grab a prose
bracket pair that precedes the JSON answer, and an unparseable reply must be
distinguishable from a genuine empty answer.
"""

from __future__ import annotations

from run_activation import parse_answer


class TestParseAnswer:
    def test_plain_array(self):
        assert parse_answer('["get-started"]') == (["get-started"], None)

    def test_empty_array(self):
        assert parse_answer("[]") == ([], None)

    def test_prose_brackets_before_json_ignored(self):
        # The lazy first-match regex used to capture [the description],
        # fail to parse, and silently grade as "invoked nothing".
        skills, err = parse_answer(
            'Based on [the description] I would pick ["debug-component"]'
        )
        assert skills == ["debug-component"]
        assert err is None

    def test_json_fence_wins(self):
        skills, err = parse_answer(
            'Here is my answer:\n```json\n["semantic-layer"]\n```\nDone.'
        )
        assert skills == ["semantic-layer"]
        assert err is None

    def test_multiple_skills(self):
        skills, err = parse_answer('["a", "b"]')
        assert skills == ["a", "b"]
        assert err is None

    def test_unparseable_reply_returns_raw_as_error(self):
        skills, err = parse_answer("I would invoke the get-started skill.")
        assert skills == []
        assert err == "I would invoke the get-started skill."

    def test_only_prose_brackets_is_a_parse_error(self):
        skills, err = parse_answer("see [the docs] for details")
        assert skills == []
        assert err is not None
