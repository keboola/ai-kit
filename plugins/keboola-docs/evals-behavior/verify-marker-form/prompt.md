---
schema_version: "1.1"
name: verify-marker-form
description: Asking how to flag an unchecked claim fires docs-verify-markers and the answer shows the VERIFY(Owner) form.
tags: [smoke, docs-verify-markers]
runs: 2
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
---
I'm editing a help.keboola.com page and could not check one claim live (the default auto-sleep timeout). How do I flag it on the page so readers never see the note?
