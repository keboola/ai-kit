---
schema_version: "1.1"
name: docs-retire-duplicate
description: A delete request fires docs-retire and the reply names a redirect target before anything is deleted.
tags: [smoke, docs-retire]
runs: 2
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
---
Удали страницу data-apps/old-page, она дублирует data-apps/operate.
