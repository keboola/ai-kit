# TODO — dataapp-development

Open items that affect this skill's completeness. Grouped by where the gap lives (Keboola platform, MCP server, `kbagent` CLI, skill content, live testing) so each can be picked up by the right owner.

## Platform — blocking the skill

Open Linear issues whose resolution will change what the skill teaches. Until these land, the skill carries workarounds and caveats.

- **[AI-3219](https://linear.app/keboola/issue/AI-3219/) — Discussion with @miro: branched workspaces + dev-branch app support.** Umbrella issue for the three platform questions below. Drives skill changes for RW apps and the "where does an app live" framing.
- **AI-3219 #1 — Branched workspaces for write-enabled apps.** Currently the only way to develop a RW app locally is a workspace with writes to production tables. Skill can't ship clean RW guidance until there's a path to a branched workspace.
- **[PROF-114](https://linear.app/keboola/issue/PROF-114/) — Data Apps in development branches.** If accepted, drafts/previews of an app config bound to a dev branch become a real concept; skill needs to be rewritten for the new model. If rejected, document the production-only constraint more firmly.
- **[AI-3218](https://linear.app/keboola/issue/AI-3218/) — `workspace.enabled=true` by default.** Removes the "if your app was created via UI you may need to flip workspace on first" caveat from SKILL.md and `deployment-paths.md`.
- **BigQuery support for direct-grant Storage Access.** Currently "Snowflake only" — `storage-access.md` §Read-write direct access. Need a public roadmap signal or ETA.

## MCP server (`keboola/mcp-server`)

Gaps that force the skill to recommend kbagent or filesystem paths for things MCP should cover.

- **`modify_data_app` is Streamlit-only.** No Python/JS app creation or modification via MCP. Blocks Path A for dashboarding apps. See `references/python-js-apps.md` §"Deployment via MCP — PLACEHOLDER".
- **No Git deployment mode via MCP.** `modify_data_app` only supports Code mode. Git-mode apps (the recommended choice for multi-file projects) require the Configuration API or kbagent.
- **No log-reading tool beyond the 20-line tail.** `get_data_apps(...).deployment_info.logs` returns only the most recent lines. For real debugging the agent has to direct the user to the Keboola UI Terminal Log tab.
- **No workspace management.** Cannot create / grant / list / delete workspaces via MCP. Local-dev workspace setup falls back to UI or kbagent.
- **No direct secret management.** Adding / removing / listing `dataApp.secrets` has to go through `modify_data_app` (which couples it to source-code edits) or the Configuration API directly.
- **No Storage Access toggle.** Enabling Storage Access on an app config requires UI navigation; no MCP affordance.
- **No project-feature discovery.** Agents can't programmatically detect whether the direct-grant feature is enabled on the project — currently has to ask the user or read error responses.

## kbagent CLI

Smaller gaps; kbagent already covers most of the data-app lifecycle.

- **`kbagent data-app logs`** — referenced as a follow-up in `references/troubleshooting.md`. Without it, log reading falls through to the UI link surfaced by `data-app deploy --wait`.
- **Direct-grant workspace creation.** Once the platform answer on AI-3219 #1 is in, kbagent likely needs an affordance for the local-dev branched-workspace flow.

## Skill content — deferred or placeholder

Sections we know are incomplete because the underlying pattern isn't firm yet. Mostly tracked by Linear above, but listed here as the writing tasks.

- **`storage-access.md` §Data access management — PLACEHOLDER.** Per-user / row-level data access control. No documented pattern; internal apps diverge. Cross-referenced from `authentication.md`.
- **`python-js-apps.md` §Deployment via MCP — PLACEHOLDER.** Fill in once `modify_data_app` covers Python/JS.
- **SQL helpers in Query Service SDKs.** Once `SQL.literal()` / `SQL.ident()` / `sql.format()` ship in `keboola-query-service` (Py) and `@keboola/query-service` (JS), replace the manual sanitization patterns in `storage-access.md` §SQL injection with SDK-driven examples.
- **BigQuery RW path.** Add once BigQuery Storage Access lands (see Platform section above).
- **Two Max Ottomansky suggestions from AI-3147 not yet picked up:**
  - Prebuilt JS apps — committing `dist/` to skip `npm install` / build on cold start. Worth a short subsection in `python-js-apps.md` once the deployment story is settled.
  - `KAI_TOKEN` secret workaround for embedding Kai chat without manual user token entry. Belongs in `kai-integration.md` once the contract with `kai-client` is firm.

## Live test coverage

The skill has been validated end-to-end in three sessions, but not against every documented path.

- **Python-only app (Flask + `uv`)** template path has never been live-tested.
- **kbagent end-to-end** path — partial coverage (used in one debug session for `data-app deploy --wait`). Hasn't been driven from scratch (`data-app create` → secrets → first deploy → iteration → deploy).
- **Kai integration** path — no live test against a real `kai-client` deployment.
- **BigQuery project** — the BigQuery code paths in `storage-access.md` are documented but unverified against a real BQ project.

## Asset / link hygiene

- **`data-app-python-js` README link** in `storage-access.md` and `glossary.md` — the public repo URL 404s currently. Either the repo isn't public yet or the path has moved; verify and update or de-link.
- **Sources file** (`docs/superpowers/specs/2026-05-13-dataapp-development-sources.md`) lists repos that may not all be public; periodically re-verify accessibility for external readers.
