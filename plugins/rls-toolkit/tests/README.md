# rls-toolkit tests

Static checks of the skill (`pytest tests/`, no network, no Keboola project). CI runs them in the
`rls-toolkit static checks` job of `.github/workflows/skill-evals.yml`; the repo-level lint and trigger
evals under `evals/` run in the Tier 0 and Tier 1 jobs.

Run: `uv run --with pytest --with jsonschema pytest -q plugins/rls-toolkit/tests` (the schema test is
skipped without `jsonschema`). `schemas/` holds the metastore schemas `rls-policy` and `cls-policy`
1.2.0 with every `description` and `x-metastore` entry removed: only the validation keywords are kept, so
the examples of the references are checked against the real grammar. Refresh them when a newer schema
version becomes the default.
