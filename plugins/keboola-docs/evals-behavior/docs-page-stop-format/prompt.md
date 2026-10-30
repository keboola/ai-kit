---
schema_version: "1.1"
name: docs-page-stop-format
description: docs-page stops at the page map and shows it as a table with the rule behind each decision, writing nothing yet.
tags: [outcome, docs-page]
runs: 2
max_turns: 14
allowed_tools: [Read, Glob, Grep, Bash, Skill]
---
This is a checkout of our docs site. I need a new page that tells readers how to reset the guide to its first state (the command is `guide reset`). Start the page.
