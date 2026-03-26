# Keboola MCP Setup

How to detect, configure, and manage the Keboola MCP connection for data app development.

---

## Step 1: Detect Available MCP Tools

Check if any Keboola MCP tools are already available by looking for these tool name patterns:
- `mcp__keboola__*` — Direct Keboola MCP (from project `.mcp.json` or user config)
- `mcp__claude_ai_Keboola*` — Keboola MCP connected via claude.ai
- `mcp__plugin_*_keboola__*` — Keboola MCP from another plugin

**If ANY of these are available:** Set `MCP_AVAILABLE = true`, note the tool prefix to use (e.g., `mcp__claude_ai_Keboola_GCP_EU__`), and skip to the main workflow. Do NOT ask about MCP setup.

## Step 2: Determine If MCP Is Needed

If no Keboola MCP tools are detected, assess whether the current task requires them:

**MCP IS needed for:**
- Building a new app (data exploration, table validation, query testing)
- Adding new data sources or pages that query Keboola tables
- Adding filters that need to discover distinct values from Keboola
- Any task where you need to explore or validate Keboola project data

**MCP is NOT needed for:**
- Adding Kai AI chat (uses the Keboola API directly at runtime, not MCP)
- Design improvements (colors, typography, animations, layout)
- Adding a loading screen, dark mode, or responsive fixes
- Fixing bugs or refactoring existing code
- Deployment configuration (Nginx, Supervisord, Docker)

**If MCP is NOT needed:** Tell the user:
> "Your task doesn't require a Keboola data connection — I'll proceed directly."

Set `MCP_AVAILABLE = false` and skip to the main workflow.

## Step 3: Offer MCP Setup (Only If Needed and Not Available)

If MCP IS needed but NOT available, ask the user using `AskUserQuestion`:

```
I can connect to your Keboola project to explore tables, validate data structures, and test queries before building. This makes the app more accurate.

Would you like me to set up the Keboola MCP connection?

1. Yes, set it up — I'll configure it for your stack
2. No, I already know my tables — I'll provide table details manually
3. Skip for now — Build without data validation (can add later)
```

**If user chooses 1 (set it up):** Go to Step 4.
**If user chooses 2 or 3:** Set `MCP_AVAILABLE = false`, proceed to the main workflow. When you reach Phase 1 (Validate) or need data queries, ask the user to provide table schemas and sample data manually.

## Step 4: Configure MCP for the User's Stack

First, try to **auto-detect** the stack from the existing codebase:
- Check `backend/.env` or `.env` for `KBC_URL` or `STORAGE_API_URL`
- Check `.streamlit/secrets.toml` for `kbc_url` or `storage_api_url`
- Check `next.config.ts` or environment config files for Keboola connection URLs

**If stack is detected from code**, confirm with the user:
> "I found `KBC_URL=https://connection.europe-west3.gcp.keboola.com` in your config. I'll set up MCP for **GCP EU Frankfurt**. Sound right?"

**If stack is NOT detected**, ask using `AskUserQuestion`:

```
Which Keboola stack is your project on?

1. AWS US — connection.keboola.com
2. AWS EU — connection.eu-central-1.keboola.com
3. Azure EU — connection.north-europe.azure.keboola.com
4. GCP EU Frankfurt — connection.europe-west3.gcp.keboola.com
5. GCP US Virginia — connection.us-east4.gcp.keboola.com
```

**Store the answer as `KEBOOLA_STACK`.** Reuse this later — do NOT re-ask in Phase 0 Question 1.

## Step 5: Write `.mcp.json`

Create (or merge into) `.mcp.json` in the **user's project root** (working directory):

```json
{
  "mcpServers": {
    "keboola": {
      "type": "http",
      "url": "MCP_URL_FROM_TABLE_BELOW"
    }
  }
}
```

**Stack → MCP URL mapping:**

| Stack | Connection URL | MCP URL |
|-------|---------------|---------|
| AWS US | `https://connection.keboola.com` | `https://mcp.us-east4.gcp.keboola.com/mcp` |
| AWS EU | `https://connection.eu-central-1.keboola.com` | `https://mcp.us-east4.gcp.keboola.com/mcp` |
| Azure EU | `https://connection.north-europe.azure.keboola.com` | `https://mcp.us-east4.gcp.keboola.com/mcp` |
| GCP EU | `https://connection.europe-west3.gcp.keboola.com` | `https://mcp.us-east4.gcp.keboola.com/mcp` |
| GCP US | `https://connection.us-east4.gcp.keboola.com` | `https://mcp.us-east4.gcp.keboola.com/mcp` |

If a `.mcp.json` already exists, merge the `keboola` server into the existing `mcpServers` object — do not overwrite other servers.

After writing, tell the user:
> "I've created `.mcp.json` in your project with the Keboola MCP connection. You'll be prompted to authenticate when I first use the MCP tools. You can also run `/mcp` to check connection status."

Set `MCP_AVAILABLE = true` and proceed to the main workflow.

## Playwright MCP — Lazy Setup at Phase 4 Only

Do **NOT** set up Playwright MCP during initial setup. It is only needed for visual validation screenshots in Phase 4.

When you reach Phase 4, if visual validation is desired, ask:
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
- **`MCP_AVAILABLE`** — Can Keboola MCP tools be used?
- **`MCP_TOOL_PREFIX`** — Which prefix to call (e.g., `mcp__keboola__`, `mcp__claude_ai_Keboola_GCP_EU__`)
- **`KEBOOLA_STACK`** — User's stack (if known, skip Phase 0 Q1)

**When `MCP_AVAILABLE = false`**, adapt later phases:
- Phase 0 Q4 "Help me explore" → Tell user this option requires MCP; ask for table IDs instead
- Phase 1 Validate → Ask user to provide table schemas and sample data manually
- Phase 0E data queries → Ask user to describe their data structure
- Phase 4 data checks → Skip MCP-based validation, rely on manual testing
