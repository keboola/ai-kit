---
name: kbc-fi
description: Run financial intelligence project review. Use when the user asks to "review financial project", "run FI review", "check financial logic", or mentions /kbc-fi. Shorthand for /kbc-review --fi.
allowed-tools:
  - Skill
argument-hint: "[project-directory] [--scope=agent1,agent2] [--quick] [--consolidate-only]"
---

# Financial Intelligence Review

Shorthand for `/kbc-review --fi`. Runs the full Keboola project review with Financial Intelligence agents included (7 general + 3 FI agents: financial-analyst, template-readiness, fi-template-spec).

Execute the `/kbc-review` command with `--fi` plus any arguments the user passed to this command.
