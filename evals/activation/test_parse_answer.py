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


class TestAnswerText:
    """Haiku 5.5 replies can start with thinking blocks, be cut off by thinking,
    or be refusals; answer_text must read text blocks by type and report the
    rest as errors instead of crashing."""

    @staticmethod
    def _resp(blocks, stop_reason="end_turn", category=None):
        from types import SimpleNamespace

        return SimpleNamespace(
            content=[SimpleNamespace(**b) for b in blocks],
            stop_reason=stop_reason,
            stop_details=SimpleNamespace(category=category) if category else None,
        )

    def test_skips_leading_thinking_block(self):
        from run_activation import answer_text

        resp = self._resp([{"type": "thinking", "thinking": ""}, {"type": "text", "text": '["get-started"]'}])
        assert answer_text(resp) == ('["get-started"]', None)

    def test_refusal_is_an_error(self):
        from run_activation import answer_text

        text, err = answer_text(self._resp([], stop_reason="refusal", category="cyber"))
        assert text is None and err == "refusal (cyber)"

    def test_max_tokens_without_text_is_an_error(self):
        from run_activation import answer_text

        resp = self._resp([{"type": "thinking", "thinking": ""}], stop_reason="max_tokens")
        assert answer_text(resp) == (None, "max_tokens reached before any text")
