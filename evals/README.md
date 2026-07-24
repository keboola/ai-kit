# Skill evals

Empirical quality gates for ai-kit skills: edit a skill → CI measures whether
an equipped agent behaves better → regressions block the PR.

This is the fast half (Tiers 0–1) of the four-tier design shared with
[keboola/KaiBench](https://github.com/keboola/KaiBench) (see its
`docs/skill-evals.md`). The heavy tiers — Tier 2 behavior evals (agent runs a
case with only the target skill loaded, graded by KaiBench's graders) and
Tier 3 live E2E — run from KaiBench, which supports `skill`-tagged cases,
`--skill-dir` skill loading, and per-skill metrics.

| Tier | What | Cost | Where |
|------|------|------|-------|
| **0 — Static lint** | Frontmatter validity, name↔directory, manifest/version consistency, dangling references, script conventions | Seconds, no LLM | here, every PR |
| **1 — Activation** | Routing precision/recall of each skill's `description:` against labeled utterances | ~200 cheap classifier calls | here, every PR (needs `ANTHROPIC_API_KEY`) |
| 2 — Behavior | Agent + isolated skill on graded cases (`outcome_score` / `process_score`) | Medium | KaiBench |
| 3 — Live E2E | Live Keboola project ops on the full harness | Slow | KaiBench, nightly |

## Running locally

```bash
cd evals

# Tier 0 + offline case validation (no API key)
uv run --group dev pytest -q

# Tier 1 — activation routing (needs ANTHROPIC_API_KEY)
uv run python activation/run_activation.py            # report only
uv run python activation/run_activation.py --ci       # gate on thresholds
uv run python activation/run_activation.py --skill get-started
uv run python activation/run_activation.py --dry-run  # list cases, no API
```

The activation run writes `activation/results/summary.json` (overall accuracy,
per-skill precision/recall, every misroute with the router's actual pick).

## How Tier 1 works

The classifier (Claude Haiku, temperature 0) is shown the **full list of the
marketplace's skill descriptions** — the same surface the real harness routes
on — plus one user utterance, and asked which skills it would invoke. Grading
is deterministic: the skill under test must appear iff the case says
`should_trigger`. Perfect recall with some co-activation false positives is
the common failure texture; the misroute list is the backlog for sharpening
`description:` fields.

CI thresholds (see `--min-accuracy` / `--min-skill-accuracy`): ≥85% overall,
≥60% per skill.

## Adding cases

Every skill must have `plugins/<plugin>/evals/<skill-dir>/trigger-evals.json`
(enforced by Tier 0). Format:

```json
[
  {"query": "brand new component for the github api, where do i start", "should_trigger": true},
  {"query": "my component job fails with exit code 2", "should_trigger": false}
]
```

Guidelines:

- ≥6 cases, ≥2 positive and ≥2 negative (enforced).
- Write **hard negatives**: utterances that belong to a *sibling* skill
  (e.g. debug-component vs develop-component), not obviously unrelated ones.
- Positives should paraphrase real user phrasing, including the trigger
  phrases the description promises to catch.
- When you edit a `description:`, re-run Tier 1 and check the skill's
  precision/recall — that is the whole point of the loop.
