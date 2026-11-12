---
schema_version: "1.1"
name: agent-docs-sheets-writer
description: An agent can find the connector that writes data to Google Sheets (its llms.txt entry has no description).
tags: [agent-docs]
runs: 2
max_turns: 12
allowed_tools: [WebFetch]
---
Answer from the Keboola documentation only. Start at https://help.keboola.com/llms.txt and fetch the pages it links (every page is also available as markdown by appending index.md to its URL). Do not answer from memory. End your reply with the URL of the page your answer comes from.

Which Keboola component writes (exports) a table into a Google Sheets spreadsheet, and where is its documentation page?
