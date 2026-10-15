---
schema_version: "1.1"
name: diataxis-check-triggers
description: A Russian "check the page by Diátaxis" request fires docs-diataxis-check.
tags: [smoke, docs-diataxis-check]
runs: 2
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
---
Проверь страницу по диатаксису: src/content/docs/data-apps/operate.md
