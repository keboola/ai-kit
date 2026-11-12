---
schema_version: "1.1"
name: docs-update-impact-map
description: docs-update finds every place a renamed button touches (text, alt text, screenshot) and stops with the map.
tags: [outcome, docs-update]
runs: 2
max_turns: 14
allowed_tools: [Read, Glob, Grep, Bash, Skill]
---
The product renamed the "Open App" button to "Open". Our docs in this checkout need to follow. What has to change?
