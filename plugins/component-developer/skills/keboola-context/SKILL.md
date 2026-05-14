---
name: keboola-context
description: >
  Keboola platform context — automatically load this whenever working on any Keboola Python
  component task (developing, testing, debugging, reviewing, schema design). Contains
  platform-level knowledge about how the Keboola Connection platform executes components,
  manages configuration, handles state, and runs jobs. This is not about code patterns —
  it is about platform behaviour that affects how code should be written and tested.
  Always pull this before making decisions about config structure, row handling, state,
  parallelism, or test data layout.
---

# Keboola Platform Context

Platform-level knowledge that affects how components behave at runtime. Read the relevant
reference file(s) when the topic comes up. Do not skip these — platform behaviour often
differs from what the code alone suggests.

## Reference files

| File | When to read |
|------|--------------|
| `references/config-rows.md` | Any time configRows, row-level config, parallelism, or per-row state is involved — including when writing or reviewing tests for row-based components |
| `references/telemetry.md` | Any time querying Keboola telemetry — connection details, key tables, column mappings, stack name mappings, anonymization rules |
