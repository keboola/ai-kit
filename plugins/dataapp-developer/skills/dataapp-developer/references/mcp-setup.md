# Keboola MCP Setup — MANDATORY

The Keboola MCP connection is required for data app development. It enables data exploration, query validation, and post-deployment verification. **This step is NEVER skipped.**

> **`AskUserQuestion` constraint:** options must have **2–4 items** — never fewer, never more. Design all questions to fit within this range.
> **MCP tool params (exact, all arrays must be real arrays not strings):**
> - `get_tables(bucket_ids: [...])` — filter by bucket · `get_tables(table_ids: [...])` — filter by table ID
> - `query_data(query_name: "…", sql_query: "…")` — both required, param is `sql_query` not `sql`
> - `deploy_data_app(action: "deploy"|"stop", configuration_id: "…")` · `get_data_apps()` — deployment

---

## Step 1: Always Create Project-Level `.mcp.json`

**CRITICAL: NEVER use `mcp__claude_ai_Keboola*` tools.** These are org-level connections that may point to a different Keboola project. Always use `mcp__keboola__*` from a project-level `.mcp.json`.

Check if `.mcp.json` exists in the current project root with a `keboola` server:
- If yes AND `mcp__keboola__*` tools are available → proceed to Step 3
- Otherwise → create `.mcp.json` (Step 2)

## Step 2: Write `.mcp.json`

Gather the two required values (stack + project name) then write `.mcp.json`. **Do NOT skip. Do NOT use org-level MCP as a shortcut.**

### 2a — Detect stack

First, **auto-detect** from the existing codebase:
- Check `backend/.env` or `.env` for `KBC_URL` or `STORAGE_API_URL`
- Check `next.config.ts` or environment config files for Keboola connection URLs

**If stack is detected from code**, confirm with the user:
> "I found `KBC_URL=https://connection.europe-west3.gcp.keboola.com` in your config. I'll set up MCP for **GCP EU Frankfurt**. Sound right?"

**If NOT detected**, ask in two steps (AskUserQuestion max is 4 options):

**Step 2a-i — Cloud provider:**
```
Which cloud does your Keboola project run on?

A) AWS
B) Azure
C) GCP
```
(3 options — valid)

**Step 2a-ii — Region (only if AWS or GCP):**
- **AWS** → ask: "Which AWS region?" → `US East (connection.keboola.com)` / `EU Central (eu-central-1)`
- **GCP** → ask: "Which GCP region?" → `EU Frankfurt (europe-west3)` / `US Virginia (us-east4)`
- **Azure** → only one option (EU North) → no follow-up needed, set directly

**Store the answer as `KEBOOLA_STACK`.** Reuse this later — do NOT re-ask in Phase 0 Question 1.

### 2b — Detect project name

Auto-detect from the working directory basename (e.g., `/projects/myapp` → `myapp`).

Then confirm using `AskUserQuestion` (2 options — valid):
```
I'll use "{dirname}" as your project name (for the MCP server: {dirname}-keboola). OK?

A) Yes, use "{dirname}"
B) No, use a different name (enter in Other)
```

Store as `PROJECT_NAME`. All subsequent MCP references use `{PROJECT_NAME}-keboola` as the server name.

## Step 3: Quick Project Summary

Once MCP is connected, immediately run a quick check to confirm the connection and give the user context:

1. `{MCP_TOOL_PREFIX}get_project_info` → project name, SQL dialect, region
2. `{MCP_TOOL_PREFIX}get_buckets` → list available data buckets

Present a brief summary:
> "Connected to your Keboola project **[name]** on **[stack]**. Found **[N] buckets** with data. Ready to proceed."

This confirms MCP works and gives the user confidence before starting the workflow.

## Step 4: Write `.mcp.json`

Create (or merge into) `.mcp.json` in the **user's project root** (working directory):

Use `{PROJECT_NAME}-keboola` as the MCP server name:

```json
{
  "mcpServers": {
    "{PROJECT_NAME}-keboola": {
      "type": "http",
      "url": "MCP_URL_FROM_TABLE_BELOW"
    }
  }
}
```

Example for project "profitline" on GCP EU:
```json
{
  "mcpServers": {
    "profitline-keboola": {
      "type": "http",
      "url": "https://mcp.europe-west3.gcp.keboola.com/mcp"
    }
  }
}
```

**Stack → MCP URL mapping:**

| Stack | Connection URL | MCP URL |
|-------|---------------|---------|
| AWS US | `https://connection.keboola.com` | `https://mcp.keboola.com/mcp` |
| AWS EU | `https://connection.eu-central-1.keboola.com` | `https://mcp.eu-central-1.keboola.com/mcp` |
| Azure EU | `https://connection.north-europe.azure.keboola.com` | `https://mcp.north-europe.azure.keboola.com/mcp` |
| GCP EU | `https://connection.europe-west3.gcp.keboola.com` | `https://mcp.europe-west3.gcp.keboola.com/mcp` |
| GCP US | `https://connection.us-east4.gcp.keboola.com` | `https://mcp.us-east4.gcp.keboola.com/mcp` |

If a `.mcp.json` already exists, merge the new server into the existing `mcpServers` object — do not overwrite other servers.

After writing, tell the user exactly:
> "I've created `.mcp.json` with the **{PROJECT_NAME}-keboola** MCP server. To activate it:
> 1. Restart Claude Code
> 2. Run `claude --resume` to continue this conversation
> 3. Run `/mcp` and authenticate the **{PROJECT_NAME}-keboola** connection
> 4. Then tell me you're ready and I'll continue."

**STOP and wait.** Do NOT proceed until the user confirms they have restarted, resumed, and authenticated.

After confirmation, the MCP tool prefix will be `mcp__{PROJECT_NAME}_keboola__` (e.g., `mcp__profitline_keboola__get_project_info`).

## Playwright MCP — Lazy Setup at Phase 5 Only

Do **NOT** set up Playwright MCP during initial setup. It is only needed for visual validation screenshots in Phase 5.

When you reach Phase 5, if visual validation is desired, ask:
> "I can take screenshots to verify your app renders correctly. This needs Playwright MCP. Want me to add it?"

If yes, update the existing `.mcp.json` to add the `playwright` server:
```json
{
  "mcpServers": {
    "keboola": { "type": "http", "url": "..." },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server@latest"]
    }
  }
}
```

## MCP Status Tracking

Track these throughout the session:
- **`MCP_AVAILABLE`** — Must be `true` before proceeding (mandatory connection)
- **`MCP_TOOL_PREFIX`** — Which prefix to call (e.g., `mcp__keboola__`, `mcp__claude_ai_Keboola_GCP_EU__`)
- **`KEBOOLA_STACK`** — User's stack (skip Phase 0 Q1 if already known)
- **`PROJECT_NAME`** — User's project name (auto-detected from working directory)
