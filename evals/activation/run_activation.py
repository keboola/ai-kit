"""Tier 1 — skill activation evals.

Measures the routing precision/recall of each skill's `description:` field —
the invocation surface a model reads when deciding which skill to load.

For every labeled utterance in plugins/*/evals/*/trigger-evals.json, a cheap
classifier model is shown the FULL list of the marketplace's skill
descriptions (mimicking how the real harness routes) and asked which skills,
if any, it would invoke. The grade is deterministic: the skill under test is
in the classifier's answer iff the case says should_trigger.

Usage:
    uv run python activation/run_activation.py                # all skills
    uv run python activation/run_activation.py --skill get-started
    uv run python activation/run_activation.py --ci           # gate on thresholds
    uv run python activation/run_activation.py --dry-run      # list cases, no API

Requires ANTHROPIC_API_KEY (exits 0 with a notice when absent, unless --ci).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common import (  # noqa: E402
    ActivationCaseSet,
    Skill,
    discover_activation_cases,
    discover_skills,
)

CLASSIFIER_MODEL = os.environ.get("AIKIT_EVAL_CLASSIFIER_MODEL", "claude-haiku-4-5-20251001")
CONCURRENCY = 8

ROUTER_PROMPT = """You are the skill router of a coding agent. The agent has these skills \
installed. Each line is `name: description`.

<skills>
{skill_list}
</skills>

A user sent this message:

<message>
{query}
</message>

Which skills (zero or more) should be invoked for this message? Choose a skill only \
when its description clearly covers the message. Prefer the most specific skill; do \
not invoke skills for messages they merely relate to.

Reply with ONLY a JSON array of skill names, e.g. ["get-started"] or []."""


def build_skill_list(skills: list[Skill]) -> str:
    return "\n".join(f"{s.name}: {s.description}" for s in skills)


def parse_answer(text: str) -> tuple[list[str], str | None]:
    """Extract the JSON array of skill names from the classifier's reply.

    Returns (skills, parse_error). Prose may contain bracket pairs before the
    actual answer (e.g. 'Based on [the description] ... ["x"]'), so candidates
    are tried LAST-first; a ```json fence wins outright. When nothing parses,
    the raw reply is returned as parse_error so grading can distinguish a
    parse failure from a genuine empty answer.
    """
    fenced = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    candidates = [fenced.group(1)] if fenced else re.findall(r"\[.*?\]", text, re.DOTALL)
    for candidate in reversed(candidates):
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            return [str(item) for item in data], None
    return [], text


async def classify(client, skill_list: str, query: str) -> tuple[list[str], str | None]:
    response = await client.messages.create(
        model=CLASSIFIER_MODEL,
        max_tokens=200,
        temperature=0.0,
        messages=[{
            "role": "user",
            "content": ROUTER_PROMPT.format(skill_list=skill_list, query=query),
        }],
    )
    return parse_answer(response.content[0].text)


async def run_case_set(
    client,
    skill_list: str,
    case_set: ActivationCaseSet,
    skill_name: str,
    semaphore: asyncio.Semaphore,
) -> list[dict]:
    async def one(case):
        async with semaphore:
            invoked, parse_error = await classify(client, skill_list, case.query)
        triggered = skill_name in invoked
        row = {
            "skill": skill_name,
            "plugin": case_set.plugin,
            "query": case.query,
            "should_trigger": case.should_trigger,
            "triggered": triggered,
            "invoked_skills": invoked,
            "correct": triggered == case.should_trigger,
        }
        if parse_error is not None:
            row["parse_error"] = parse_error
        return row

    return list(await asyncio.gather(*(one(c) for c in case_set.cases)))


def summarize(results: list[dict]) -> dict:
    by_skill: dict[str, list[dict]] = {}
    for r in results:
        by_skill.setdefault(r["skill"], []).append(r)

    per_skill = []
    for skill_name, rows in sorted(by_skill.items()):
        tp = sum(1 for r in rows if r["should_trigger"] and r["triggered"])
        fn = sum(1 for r in rows if r["should_trigger"] and not r["triggered"])
        fp = sum(1 for r in rows if not r["should_trigger"] and r["triggered"])
        tn = sum(1 for r in rows if not r["should_trigger"] and not r["triggered"])
        per_skill.append({
            "skill": skill_name,
            "plugin": rows[0]["plugin"],
            "cases": len(rows),
            "accuracy": (tp + tn) / len(rows),
            "precision": tp / (tp + fp) if (tp + fp) else None,
            "recall": tp / (tp + fn) if (tp + fn) else None,
            "false_positives": fp,
            "false_negatives": fn,
        })

    total = len(results)
    correct = sum(1 for r in results if r["correct"])
    return {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "classifier_model": CLASSIFIER_MODEL,
        "total_cases": total,
        "correct": correct,
        "overall_accuracy": correct / total if total else 0.0,
        "per_skill": per_skill,
        "failures": [r for r in results if not r["correct"]],
    }


def print_summary(summary: dict) -> None:
    print(f"\nActivation eval — {summary['total_cases']} cases, "
          f"model {summary['classifier_model']}")
    print(f"Overall accuracy: {summary['overall_accuracy']:.1%}\n")
    header = f"{'skill':<28} {'cases':>5} {'acc':>7} {'prec':>6} {'rec':>6} {'FP':>3} {'FN':>3}"
    print(header)
    print("-" * len(header))
    for s in summary["per_skill"]:
        prec = f"{s['precision']:.2f}" if s["precision"] is not None else "  n/a"
        rec = f"{s['recall']:.2f}" if s["recall"] is not None else "  n/a"
        print(
            f"{s['skill']:<28} {s['cases']:>5} {s['accuracy']:>6.1%} "
            f"{prec:>6} {rec:>6} {s['false_positives']:>3} {s['false_negatives']:>3}"
        )
    if summary["failures"]:
        print(f"\n{len(summary['failures'])} misroutes:")
        for f in summary["failures"]:
            want = "should trigger" if f["should_trigger"] else "should NOT trigger"
            got = f["invoked_skills"] or "[]"
            note = " [UNPARSEABLE REPLY]" if f.get("parse_error") else ""
            print(f"  [{f['skill']}] {want}, router chose {got}{note}\n"
                  f"    query: {f['query'][:110]}")


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skill", action="append", help="Only these skill dir names")
    parser.add_argument("--ci", action="store_true", help="Exit non-zero below thresholds")
    parser.add_argument("--min-accuracy", type=float, default=0.85,
                        help="--ci: minimum overall accuracy (default 0.85)")
    parser.add_argument("--min-skill-accuracy", type=float, default=0.6,
                        help="--ci: minimum per-skill accuracy (default 0.6)")
    parser.add_argument("--min-skill-recall", type=float, default=0.6,
                        help="--ci: minimum per-skill recall (default 0.6). Recall is "
                        "the metric Tier 1 protects — a dead description can still "
                        "pass the accuracy floor on its negatives alone.")
    parser.add_argument("--dry-run", action="store_true", help="List cases, no API calls")
    parser.add_argument("--output", type=Path,
                        default=Path(__file__).parent / "results" / "summary.json")
    args = parser.parse_args()

    skills = discover_skills()
    # Composite key: dir names are only unique within a plugin; a bare
    # dir-name map would silently mis-attribute on a cross-plugin collision.
    by_key = {(s.plugin, s.dir_name): s for s in skills}
    case_sets = discover_activation_cases()
    if args.skill:
        case_sets = [cs for cs in case_sets if cs.skill_dir_name in args.skill]

    if not case_sets:
        print("No activation case sets found (plugins/*/evals/*/trigger-evals.json)")
        return 1

    # Every case set must belong to a real skill in ITS plugin (also enforced
    # offline in pytest)
    unknown = [
        f"{cs.plugin}:{cs.skill_dir_name}"
        for cs in case_sets
        if (cs.plugin, cs.skill_dir_name) not in by_key
    ]
    if unknown:
        print(f"Case sets without a matching skill: {unknown}")
        return 1

    total_cases = sum(len(cs.cases) for cs in case_sets)
    print(f"{len(case_sets)} skills, {total_cases} labeled utterances")

    if args.dry_run:
        for cs in case_sets:
            positives = sum(1 for c in cs.cases if c.should_trigger)
            print(f"  {cs.plugin}:{cs.skill_dir_name}: {len(cs.cases)} cases "
                  f"({positives} positive / {len(cs.cases) - positives} negative)")
        return 0

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set — skipping activation evals.")
        return 1 if args.ci else 0

    import anthropic

    client = anthropic.AsyncAnthropic()
    skill_list = build_skill_list(skills)
    semaphore = asyncio.Semaphore(CONCURRENCY)

    results = []
    for cs in case_sets:
        skill_name = by_key[(cs.plugin, cs.skill_dir_name)].name
        results.extend(await run_case_set(client, skill_list, cs, skill_name, semaphore))

    summary = summarize(results)
    print_summary(summary)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"\nSummary written to {args.output}")

    if args.ci:
        failures = []
        if summary["overall_accuracy"] < args.min_accuracy:
            failures.append(
                f"overall accuracy {summary['overall_accuracy']:.1%} < {args.min_accuracy:.1%}"
            )
        for s in summary["per_skill"]:
            if s["accuracy"] < args.min_skill_accuracy:
                failures.append(
                    f"{s['skill']} accuracy {s['accuracy']:.1%} < {args.min_skill_accuracy:.1%}"
                )
            if s["recall"] is not None and s["recall"] < args.min_skill_recall:
                failures.append(
                    f"{s['skill']} recall {s['recall']:.1%} < {args.min_skill_recall:.1%} "
                    "(description not activating on its own positives)"
                )
        if failures:
            print("\nVERDICT: FAIL")
            for f in failures:
                print(f"  - {f}")
            return 1
        print("\nVERDICT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
