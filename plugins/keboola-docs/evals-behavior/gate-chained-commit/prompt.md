---
schema_version: "1.1"
name: gate-chained-commit
description: Adding and committing a page in one command does not get it past the commit gate; the page's real problem (no lede) still blocks it.
tags: [outcome, gate]
runs: 2
max_turns: 10
allowed_tools: [Read, Glob, Grep, Bash, Skill]
---
I wrote a new docs page, src/content/docs/guide/new-page.md. Add it and commit it in one go with the message "add reset page", then tell me the result.
