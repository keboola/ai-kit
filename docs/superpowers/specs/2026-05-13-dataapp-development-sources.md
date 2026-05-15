# Sources consolidated into the `dataapp-development` skill

Plain list of every source used during the consolidation. Provenance only — not loaded by the skill at runtime.

## Brief

- Linear [AI-3147](https://linear.app/keboola/issue/AI-3147/extend-data-app-development-skill-to-cover-full-lifecycle-storage-git)
- Internal Obsidian note that scoped the merge (areas, client-path matrix, materials list)

## Prior skills in this plugin (consolidated and removed)

- `dataapp-dev` (Streamlit, validate → build → verify)
- `dataapp-deployment` (Python/JS, Nginx + Supervisord + base image)

## Companion skill

- `keboola-js-data-app` — provided by Fisa

## External-team contribution

- [`keboola/ai-kit#71`](https://github.com/keboola/ai-kit/pull/71) (`miro-AJDA-2519` branch)

## Keboola GitHub repos

- [`keboola/mcp-server`](https://github.com/keboola/mcp-server)
- [`keboola/data-app-python-js`](https://github.com/keboola/data-app-python-js)
- [`keboola/query-service-api-python-sdk`](https://github.com/keboola/query-service-api-python-sdk)
- [`keboola/query-service-api-js-sdk`](https://github.com/keboola/query-service-api-js-sdk)
- [`keboola/kai-client`](https://github.com/keboola/kai-client)
- [`keboola-rnd/kai-pricing-calculator-app`](https://github.com/keboola-rnd/kai-pricing-calculator-app/tree/nodejs-pricing-simulator) (`nodejs-pricing-simulator` branch)
- [`keboola/profitline-js-app`](https://github.com/keboola/profitline-js-app)
- [`keboola-rnd/keboola-financial-intelligence-app`](https://github.com/keboola-rnd/keboola-financial-intelligence-app)
- [`keboola-rnd/agent-usage-data-app`](https://github.com/keboola-rnd/agent-usage-data-app)
- [`padak/keboola_agent_cli`](https://github.com/padak/keboola_agent_cli)

## Keboola Connection documentation

- https://help.keboola.com/data-apps/ and its subpages (Streamlit, Python/JS, Storage Access, Authentication, OIDC, General Design Guide, Terminal Log)

## Live verifications

- `mcp__keboola__get_project_info` against a real Keboola project (confirmed `branch_id` / `is_development_branch` / `workspace_id` field shapes)
- Three end-to-end test sessions of the resulting skill against a real Keboola project

## Anthropic / Claude Code platform

- Claude Code plugin + skill format, `.mcp.json` discovery, slash commands, permission modes
- `@anthropic-ai/superpowers` skills: `brainstorming`, `writing-plans`, `subagent-driven-development` (used to drive the consolidation work itself)
