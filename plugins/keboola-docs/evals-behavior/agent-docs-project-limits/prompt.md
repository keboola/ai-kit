---
schema_version: "1.1"
name: agent-docs-project-limits
description: An agent can find the page that lists a project's storage and platform limits.
tags: [agent-docs]
runs: 2
max_turns: 12
allowed_tools: [WebFetch]
---
Answer from the Keboola documentation only. Start at https://help.keboola.com/llms.txt and fetch the pages it links (every page is also available as markdown by appending index.md to its URL). Do not answer from memory. End your reply with the URL of the page your answer comes from.

Which documentation page lists the storage size and platform quotas of a Keboola project? Give its URL.
