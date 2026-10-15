---
schema_version: "1.1"
name: docs-update-stale-shots
description: Stale screenshots on an existing page fire docs-update, not docs-page or docs-clip.
tags: [smoke, docs-update]
runs: 2
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
---
Скрины на странице data-apps/operate устарели, кнопка Open App теперь называется Open. Что делаем?
