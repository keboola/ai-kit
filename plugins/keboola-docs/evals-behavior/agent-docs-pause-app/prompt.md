---
schema_version: "1.1"
name: agent-docs-pause-app
description: An agent can find how to pause a Keboola app from a terminal using only the docs.
tags: [agent-docs]
runs: 2
max_turns: 12
allowed_tools: [WebFetch]
---
Answer from the Keboola documentation only. Start at https://help.keboola.com/llms.txt and fetch the pages it links (every page is also available as markdown by appending index.md to its URL). Do not answer from memory. End your reply with the URL of the page your answer comes from.

How do I pause a running Keboola app from a terminal, without the web UI? Give the exact command.
