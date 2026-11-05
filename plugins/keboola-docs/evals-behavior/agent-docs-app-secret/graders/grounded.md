---
type: llm
focus: trace
---
PASS if the final answer is taken from a help.keboola.com page the agent fetched in this run and names that page's URL.
FAIL if the answer contradicts the fetched pages, comes from memory without a fetched page behind it, or gives no URL.
