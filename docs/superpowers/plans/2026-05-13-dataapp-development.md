# dataapp-development Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the existing `dataapp-dev` (Streamlit) and `dataapp-deployment` (Python/JS) skills into a single `dataapp-development` skill covering the full Keboola App lifecycle, with a lean router SKILL.md, 12 topical references, and 5 runnable templates.

**Architecture:** Single skill under `plugins/dataapp-developer/skills/dataapp-development/`. The `SKILL.md` is a decision-tree router that routes to references on demand; references are organized by concept (app types, deployment paths, storage, auth, styling, caching, dashboarding, Kai, dev workflow, troubleshooting). Templates are runnable scaffolds for the four common app shapes plus a DuckDB cache module.

**Tech Stack:** Markdown content, Python (Streamlit + Flask + FastAPI templates), Node.js (Express templates), DuckDB (cache pattern), Keboola MCP / kbagent CLI / Playwright MCP (referenced from the skill).

**Spec:** `docs/superpowers/specs/2026-05-13-dataapp-development-design.md`. The spec is the source of truth for content. This plan sequences the implementation and specifies validation criteria.

---

## File structure overview

**Created (new skill):**
```
plugins/dataapp-developer/skills/dataapp-development/
├── SKILL.md
├── references/
│   ├── choosing-app-type.md
│   ├── streamlit-apps.md
│   ├── python-js-apps.md
│   ├── deployment-paths.md
│   ├── storage-access.md
│   ├── authentication.md
│   ├── duckdb-caching.md
│   ├── styling-guide.md
│   ├── dashboard-patterns.md
│   ├── kai-integration.md
│   ├── dev-workflow.md
│   └── troubleshooting.md
└── templates/
    ├── streamlit/
    ├── python-app/
    ├── nodejs-app/
    ├── python-node-app/
    └── duckdb-cache/
```

**Modified:**
- `plugins/dataapp-developer/.claude-plugin/plugin.json` — bump 1.1.0 → 1.2.0.
- `.claude-plugin/marketplace.json` — bump `dataapp-developer` entry 1.1.0 → 1.2.0; update description.
- `plugins/dataapp-developer/README.md` — rewrite "Available Skills" section, update structure tree.
- `README.md` (root) — update Data App Developer Plugin feature list.

**Deleted:**
- `plugins/dataapp-developer/skills/dataapp-dev/` (entire directory).
- `plugins/dataapp-developer/skills/dataapp-deployment/` (entire directory).

---

## Conventions for content tasks

1. **Every reference file MUST start with** a one-sentence "Use this when…" line under the H1 title. This is the agent's load-decision signal.
2. **Each reference is a standalone markdown file** with a single H1 title, then the "Use this when…" opener, then H2 sections following the bullet groups in the spec.
3. **No emoji in skill content** (per FI/profitline convention) unless the spec explicitly includes them (e.g. Keboola theme color examples are fine).
4. **Code blocks in references** must specify the language (` ```python `, ` ```nginx `, ` ```bash `).
5. **Cross-references** between files use relative paths: `[storage-access.md](storage-access.md)`, not absolute paths.
6. **Source of truth.** When this plan says "implement per spec section X", the spec section's bullet list is the authoritative content scope. Expand each bullet into a properly-formatted markdown section with the cited examples/code blocks inline. Do not invent new content; do not skip bullets.

---

## Task 1: Create skill directory and SKILL.md (router)

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/SKILL.md`

**Spec source:** "SKILL.md contract" section.

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p plugins/dataapp-developer/skills/dataapp-development/references
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates
```

- [ ] **Step 2: Write SKILL.md**

Create `plugins/dataapp-developer/skills/dataapp-development/SKILL.md` with this exact content:

````markdown
---
name: dataapp-development
description: Use when building, modifying, deploying, or debugging Keboola Apps (Streamlit or Python/JS). Covers the full lifecycle — choosing app type, configuring keboola-config/, storage access (RO workspace, RW Query Service, input mapping), authentication, DuckDB caching for performance, default Keboola styling, dashboard patterns, optional Kai chat integration, and the three client paths (MCP-only, Claude Code with filesystem, kbagent CLI).
---

# Keboola App Development

This skill covers the full lifecycle of Keboola Apps (formerly "Data Apps"): choosing the right app type, building locally, deploying, and debugging. It supports both **Streamlit** apps and **Python/JS** apps, and three client paths (MCP-only, Claude Code with filesystem access, and `kbagent` CLI).

The skill is a router — it does not contain all the guidance itself. The `references/` files load on demand based on the task at hand. Read the decision tree below, then load only the references you need.

## Decision tree

Answer these questions in order. Each answer routes to the right reference.

### 1. What is the task?

| Task | Where to look first |
|---|---|
| Build a new app from scratch | `choosing-app-type.md` → type-specific reference → `deployment-paths.md` |
| Modify an existing app (add feature, fix bug) | `dev-workflow.md` for the change loop |
| Deploy or redeploy | `deployment-paths.md` |
| Debug a deployment or runtime issue | `troubleshooting.md` |
| Migrate an existing app between types | `choosing-app-type.md` + both type references |

### 2. Which app type?

If unsure → `choosing-app-type.md`. Short version:

- **Streamlit** — fastest when the team is Python-only and the UI is mostly sidebar + main pane. Read `streamlit-apps.md`.
- **Single Node.js + static frontend** — the dashboarding default. One process, no bundler, Chart.js/Tailwind via CDN. Read `python-js-apps.md`.
- **Combined Python + Node** — only when you genuinely need a Python backend (ML model, existing Python codebase). Read `python-js-apps.md` (multi-server section).

### 3. Which client path?

`deployment-paths.md` covers all three:

- **Path A — Claude Desktop / web (MCP-only, no filesystem):** Use `modify_data_app` / `deploy_data_app` MCP tools (Streamlit only today).
- **Path B — Claude Code / local agent with filesystem + MCP:** Edit files locally, push to customer git, deploy via MCP or kbagent.
- **Path C — CLI agent (`kbagent`):** Full lifecycle via `kbagent data-app` command group.

### 4. Any cross-cutting concerns?

| Concern | Reference |
|---|---|
| Reading from / writing to Keboola Storage | `storage-access.md` |
| Securing the app (login, SSO, OAuth) | `authentication.md` |
| Making the app fast / avoiding repeated Snowflake hits | `duckdb-caching.md` |
| Styling — default look or brand override | `styling-guide.md` |
| Building a dashboarding-style app | `dashboard-patterns.md` |
| Adding a natural-language assistant to the app | `kai-integration.md` |

## Reference index

| File | Use when |
|---|---|
| `references/choosing-app-type.md` | You don't yet know which app type to build. |
| `references/streamlit-apps.md` | You're building a Streamlit app (Code or Git deployment). |
| `references/python-js-apps.md` | You're building a Python/JS app (single Node, single Python, or combined). |
| `references/deployment-paths.md` | You need to know which tool to use (MCP / Claude Code / kbagent). |
| `references/storage-access.md` | The app reads from or writes to Keboola Storage. |
| `references/authentication.md` | You need to pick or configure an auth method. |
| `references/duckdb-caching.md` | The app is read-only and would benefit from query caching. |
| `references/styling-guide.md` | You need brand-default styling or a customer override. |
| `references/dashboard-patterns.md` | You're building a dashboarding app (sidebar filters, charts, metrics). |
| `references/kai-integration.md` | You want to embed Kai chat in the app. |
| `references/dev-workflow.md` | You're modifying an existing app and want the validate→build→verify loop. |
| `references/troubleshooting.md` | The app is failing, returning errors, or behaving unexpectedly. |

## Templates index

| Template | Use when |
|---|---|
| `templates/streamlit/` | New Streamlit app, code or git deployment. |
| `templates/python-app/` | New Python-only Python/JS app (Flask or similar). |
| `templates/nodejs-app/` | New dashboarding app (Node.js + static frontend — the preferred default). |
| `templates/python-node-app/` | New combined Python backend + JS frontend app. |
| `templates/duckdb-cache/` | Adding the DuckDB caching pattern to an existing Python or Node app. |

## Hard rules (apply to every task)

1. **Never commit `.streamlit/secrets.toml`** or any file with real credentials. Add to `.gitignore` before committing.
2. **RO workspace before input mapping.** New apps default to the RO workspace pattern. Input mapping is discouraged — see `storage-access.md`.
3. **Apps must handle `POST /`** on the root path. Keboola POSTs to `/` on startup. Streamlit handles this natively; Flask needs `methods=["GET", "POST"]`; Express needs `app.all('/')`.
4. **No `pip install` in Python apps.** The base image blocks PEP 668. Use `uv sync` driven by `pyproject.toml`. All Python supervisord commands must use `uv run`.
5. **Never declare `[program:nginx]`** in `keboola-config/supervisord/`. Nginx is managed by the base image.
6. **Validate data first, code second.** When using Keboola MCP, call `get_table` and `query_data` to confirm schema before writing SQL. See `dev-workflow.md`.
````

- [ ] **Step 3: Verify the file**

Check:
- File starts with `---` frontmatter.
- `name` and `description` fields are present.
- File has the H1 title, decision tree, reference index, templates index, and hard rules.
- Length is under 150 lines.

Run:
```bash
wc -l plugins/dataapp-developer/skills/dataapp-development/SKILL.md
```
Expected: under 150.

- [ ] **Step 4: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/
git commit -m "feat(dataapp-development): add skill router (SKILL.md)"
```

---

## Task 2: Write `references/choosing-app-type.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/references/choosing-app-type.md`

**Spec source:** `### references/choosing-app-type.md` section.

- [ ] **Step 1: Write the file**

Create the file with this exact content:

````markdown
# Choosing an App Type

**Use this when:** you don't yet know whether to build a Streamlit app or a Python/JS app, or when migrating from one to the other.

## Decision hierarchy

There are three viable shapes for a Keboola App. Pick the lowest one in this list that meets your needs — simpler is better.

### 1. Streamlit (Python)

**Pick when:**
- The team is Python-only.
- The UI is mostly sidebar filters + main pane with charts/tables.
- The app is internal or a quick prototype.
- You want the paste-in-UI **Code** deployment mode for the very simplest apps.

**Reference apps:** `agent-usage-data-app` (multi-page dashboard with global filters).

**Read next:** [streamlit-apps.md](streamlit-apps.md).

### 2. Single Node.js + static frontend (Python/JS type)

**The preferred default for dashboarding apps.** Pick when:
- The app primarily renders data — charts, tables, KPIs.
- You don't need a heavy Python backend.
- You want one process, no bundler, fast cold start.

Stack: Express (or similar) on a single port, serving both `/api/*` JSON endpoints and a static frontend (`public/index.html` + `public/app.js`) with Tailwind and Chart.js loaded via CDN. Pairs naturally with DuckDB caching.

**Reference app:** [`keboola-rnd/kai-pricing-calculator-app` on the `nodejs-pricing-simulator` branch](https://github.com/keboola-rnd/kai-pricing-calculator-app/tree/nodejs-pricing-simulator).

**Read next:** [python-js-apps.md](python-js-apps.md). Template at `templates/nodejs-app/`.

### 3. Combined Python + Node (Python/JS type)

**Pick when you need a Python backend.** This is heavier — two processes, two language toolchains. Use it when:
- The team has an existing Python codebase you're wrapping a UI around.
- An ML model needs to live in Python.
- You need FastAPI/Flask services alongside the frontend.
- The frontend justifies a bundler (Next.js, Vite + React + shadcn/ui).

**Reference app:** `keboola/profitline-js-app` (FastAPI :8050 + Next.js :3000 in one Keboola container).

**Read next:** [python-js-apps.md](python-js-apps.md) (multi-server section). Template at `templates/python-node-app/`.

## Decision criteria

| Criterion | Streamlit | Single Node + static | Python + Node |
|---|---|---|---|
| Team language | Python only | JS comfortable | Both |
| UI complexity | Low (sidebar + main) | Medium (custom layout) | High (custom framework) |
| Frontend bundler | No | No | Yes |
| Backend language | Python | Node | Python + Node |
| Deploy mode | Code or Git | Git only | Git only |
| MCP support today | Yes (`modify_data_app`) | No (use kbagent or git) | No (use kbagent or git) |
| Cold-start time | Fast | Fastest | Slowest |

## Migration notes

- **Streamlit → Python/JS** is a common path once a Streamlit app outgrows its sidebar-and-main shape. The kai-pricing-calculator-app moved from Streamlit to single Node + static to gain layout control and reduce cold-start time.
- **Streamlit is on a deprecation path.** New apps that exceed the simple-UI threshold should default to Python/JS. Existing Streamlit apps don't need to be migrated until you hit a Streamlit limitation.
- The Python/JS app type does not currently support paste-in-UI "Code" deployment; only Git deployment. Streamlit retains "Code" mode.
````

- [ ] **Step 2: Verify**

Check:
- File starts with `# Choosing an App Type` then `**Use this when:**` line.
- All three shapes are covered.
- Decision-criteria table is present.
- Migration notes section is present.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/references/choosing-app-type.md
git commit -m "feat(dataapp-development): add choosing-app-type reference"
```

---

## Task 3: Write `references/streamlit-apps.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/references/streamlit-apps.md`

**Spec source:** `### references/streamlit-apps.md` section (including the Local development subsection).

- [ ] **Step 1: Write the file**

Sections required (H2 each):
1. **Deployment modes** — Code (paste-in-UI) vs Git Repository (public, private with PAT, private with SSH key); examples of secrets-on-public-repo gotchas.
2. **Base image and packages** — preinstalled list (`streamlit`, `pandas`, `numpy`, `matplotlib`, `plotly`, `scikit-learn`, `seaborn`, `graphviz`, `deepmerge`, `python-dotenv`, `toml`, `keboola.component`, `streamlit-aggrid`, `streamlit-keboola-api`, `streamlit_authenticator`); how to add more via the Packages field; backend versions and Python 3.10/3.11/3.13.
3. **Secrets** — direct UI upload (flat keys only) vs repo-based `.streamlit/secrets.toml` (supports nested groups); reserved name `KBC_TOKEN`; the `#`-prefix convention from `dataApp.secrets`.
4. **Theming** — Keboola Theming UI (predefined themes + custom) vs the `parameters.dataApp.streamlit.config.toml` raw override. Predefined Keboola theme values (primary `#1F8FFF`, bg `#FFFFFF`, secondary `#E6F2FF`, text `#222529`, font sans serif). Note the Theming UI overwrites `[theme]` on save but preserves other sections.
5. **AgGrid Enterprise** — license preconfigured; access via `KeboolaStreamlit(URL, TOKEN).aggrid_license_key`.
6. **Storage access from Streamlit** — point to [storage-access.md](storage-access.md); summary of RO workspace pattern.
7. **Local development** — install with `uv sync` (or `pip install -e .`); run `streamlit run streamlit_app.py` on `:8501`; local secrets in `.streamlit/secrets.toml` (gitignored); env-parity pattern `os.environ.get('KBC_TOKEN') or st.secrets.get('KBC_TOKEN')`; hot reload by saving the file; cross-link to [dev-workflow.md](dev-workflow.md) for the change loop.

Use `templates/streamlit/` as the canonical example throughout.

Each section opens with a one-sentence summary. Code blocks must specify the language.

The file MUST start with:
```markdown
# Streamlit Apps

**Use this when:** you're building, modifying, or debugging a Streamlit app on Keboola.
```

- [ ] **Step 2: Verify**

Check:
- Starts with `# Streamlit Apps` and `**Use this when:**` opener.
- All seven sections present.
- Local development section includes the env-parity one-liner.
- No mention of `pip install` as the local-dev recommendation (use `uv sync` first, `pip install -e .` as fallback).

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/references/streamlit-apps.md
git commit -m "feat(dataapp-development): add streamlit-apps reference"
```

---

## Task 4: Write `references/python-js-apps.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/references/python-js-apps.md`

**Spec source:** `### references/python-js-apps.md` section in full, including the Multi-server Python+Node subsection and the Deployment via MCP (Keboola-managed git) placeholder.

This is the longest reference. Plan for ~300 lines.

- [ ] **Step 1: Write the file**

Required H2 sections:

1. **The `/app` contract** — `keboola-config/nginx/sites/*.conf` (required), `keboola-config/supervisord/services/*.conf` (required), `setup.sh` (optional), `run.sh` (optional). The contract is fixed; only the bootstrap hook is replaceable.
2. **Nginx** — listens on `:8888` (hardcoded); only ports ≥1024 supported; reverse-proxies to app's internal port. Include minimal `default.conf`. Include WebSocket upgrade snippet. Include SSE/streaming `proxy_buffering off` snippet.
3. **Supervisord** — absolute `/app/...` paths; `uv run` prefix for Python; never `[program:nginx]`. Include sample `app.conf` for Python (uv run), Node, and Gunicorn.
4. **POST handling on `/`** — Keboola POSTs to `/` on startup. Flask: `methods=["GET", "POST"]`. Express: `app.all('/', ...)`. Streamlit handles natively. Include code samples for both.
5. **Python dependencies** — `pyproject.toml` is required; `pip install` is blocked by PEP 668; `setup.sh` uses `cd /app && uv sync`. Include sample `pyproject.toml`.
6. **Preferred shape for dashboarding: single Node + static frontend** — pattern from `kai-pricing-calculator-app/nodejs-pricing-simulator`: Express on one port serving both `/api/*` and `public/`; CDN-loaded Tailwind + Chart.js; pairs with DuckDB caching. Point at `templates/nodejs-app/`.
7. **Multi-server pattern (Python backend + JS frontend) — use when you need it** — full content from the spec's "Multi-server pattern" bullet group: backend on `:8050`, frontend on `:3000`, two nginx location blocks, two supervisord programs, parallel `setup.sh`, pre-built frontend convention from profitline. Point at `templates/python-node-app/`.
8. **Local development** — full content from the spec's "Local development section" bullet group: skip nginx/supervisord locally; run app directly (`uv run python app.py`, `uv run uvicorn ... --reload`, `node --watch server.js`, `npm run dev`); local secrets via `.env` / `.streamlit/secrets.toml`; env-parity; multi-server local dev with frontend-proxy-to-backend.
9. **Keboola-hosted dev mode** — `KBC_APP_MODE=dev`, `supervisord-dev/`, `setup-dev.sh`, `dev-deps`. Brief — point to base image README for full contract.
10. **Git commit locking** — always enabled. Exit code 153 means the locked commit no longer exists in remote.
11. **Bootstrap hook (advanced)** — note that customers usually don't need to touch this; point to base image `docs/bootstrap.md`.
12. **Deployment via MCP (Keboola-managed git) — PLACEHOLDER** — exact placeholder text from the spec: future flow, planned developer flow (feature branch → preview → merge), status today (not finished), fallback to customer-provided git. Note that this section will be split into its own reference once the platform support lands and the section grows past ~50 lines.

The file MUST start with:
```markdown
# Python/JS Apps

**Use this when:** you're building, modifying, or debugging a Python/JS app on Keboola — single Node, single Python, or combined Python+Node.
```

- [ ] **Step 2: Verify**

Check:
- All 12 H2 sections present.
- The single-Node section is positioned BEFORE the multi-server section (dashboarding default leads).
- The placeholder for MCP-managed-git is explicitly labeled "PLACEHOLDER".
- Code blocks for nginx, supervisord, and pyproject.toml are present.
- Cross-references to `templates/nodejs-app/` and `templates/python-node-app/` are present.
- Length is 200–400 lines.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/references/python-js-apps.md
git commit -m "feat(dataapp-development): add python-js-apps reference"
```

---

## Task 5: Write `references/deployment-paths.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/references/deployment-paths.md`

**Spec source:** `### references/deployment-paths.md` section.

- [ ] **Step 1: Write the file**

Three H2 sections, one per path. The file MUST start with:
```markdown
# Deployment Paths

**Use this when:** you need to pick the right tool for creating, deploying, or managing a Keboola App — depends on which client environment you're running in.
```

**Section content:**

1. **Path A — Claude Desktop / web (MCP-only, no filesystem)**:
   - Tools available: `modify_data_app`, `deploy_data_app`, `get_data_apps`, `query_data`, `get_table`, `get_project_info`.
   - Use `modify_data_app` to create or update the source code; pass `configuration_id=""` for new apps, existing ID for updates.
   - After `modify_data_app`, call `deploy_data_app(action="deploy", configuration_id=...)` — without this, changes do not take effect.
   - `get_data_apps([cfg_id])` returns the latest 20 log lines for debugging.
   - **Limitations:** Streamlit type only. No git mode. No Python/JS type via MCP today.
   - **Code examples:** minimal `modify_data_app` call.

2. **Path B — Claude Code / local agent with filesystem + MCP**:
   - Edit files locally with Read/Edit/Write tools.
   - For Streamlit: push to customer git repo, then `deploy_data_app` via MCP (Git deployment mode), or use `modify_data_app` for paste-in-Code mode.
   - For Python/JS: must use git (no Code mode for that type). Push to customer git, then deploy via MCP (Streamlit only — TODO) or kbagent.
   - Run app locally for testing; use Playwright MCP for visual verification.
   - **Best fit for:** iterating on existing apps, complex changes, multi-file refactors.

3. **Path C — CLI agent (`kbagent`)**:
   - Full lifecycle: `kbagent data-app create`, `deploy`, `start`, `stop`, `delete`, `secrets-set`, `secrets-list`, `secrets-get`, `secrets-remove`, `password`, `validate-repo`, `list`, `detail`.
   - `validate-repo` BEFORE `create` to catch golden-rule violations without burning a deploy cycle.
   - `--git-pat-env GITHUB_PAT_DATAAPP` is the preferred private-repo auth — token never appears in argv.
   - For Storage config fields (size, auto-suspend, git block), use `kbagent config update --component-id keboola.data-apps --config-id ID --set ... --merge` then `kbagent data-app deploy`.
   - Detailed gotchas in the kbagent skill's `references/data-app-workflow.md` — link to it; do not duplicate here.

End with a one-paragraph **"How to choose"** table summarizing which path matches which client.

- [ ] **Step 2: Verify**

Check:
- All three paths present as H2.
- Path A explicitly notes Streamlit-only limitation.
- Path B notes the git-push-then-deploy flow for Python/JS.
- Path C lists the full kbagent command set and points to the kbagent skill for deep gotchas.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/references/deployment-paths.md
git commit -m "feat(dataapp-development): add deployment-paths reference"
```

---

## Task 6: Write `references/storage-access.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/references/storage-access.md`

**Spec source:** `### references/storage-access.md` section, including the "Data access management — PLACEHOLDER" bullet.

- [ ] **Step 1: Write the file**

The file MUST start with:
```markdown
# Storage Access

**Use this when:** the app reads from or writes to Keboola Storage tables.
```

Required H2 sections:

1. **Default: RO workspace** — when using MCP `modify_data_app`, a `query_data(sql) -> DataFrame` function is injected automatically. Don't roll your own. The function uses the Query Service for Snowflake projects and Storage API for BigQuery.
2. **Direct workspace queries (Python/JS without MCP injection)** — POST to `/v2/storage/branch/{branch}/workspaces/{workspace}/query`. Show the JS pattern from `kai-pricing-calculator-app/api/keboola-client.js` (env-var resolution with multiple fallbacks, workspace-ID normalizer stripping `WORKSPACE_<id>` prefix, retry on 5xx).
3. **RW direct access (Storage Access)** — Snowflake only. Configure `storage.output.tables[].unload_strategy = "direct-grant"`. Use `keboola-query-service` (Python) or `@keboola/query-service` (JS). Ephemeral workspace recreated on each app start. Env vars: `KBC_WORKSPACE_MANIFEST_PATH`, `BRANCH_ID`, `QUERY_SERVICE_URL`, `KBC_TOKEN`. **SQL injection caveat** — validate all user input with allowlists and type coercion. Cite the future `SQL.literal()` helpers that will replace manual sanitization.
4. **Input mapping — discouraged for new apps** — snapshot at deploy time, no fresh data, no write-back. Use only for static reference data loaded once. Files appear at `/data/in/tables/<name>.csv`.
5. **Data access management — PLACEHOLDER** — exact text from the spec: per-user/row-level access control not currently supported at the platform level; column-level perms also missing; internal patterns differ between JS/Python and legacy Streamlit; will be documented here once verified. Do not invent a pattern.

- [ ] **Step 2: Verify**

Check:
- The "Data access management — PLACEHOLDER" section is explicit and tells the agent NOT to invent a pattern.
- RO workspace is clearly positioned as the default.
- Input mapping is clearly labeled as "discouraged" with the reason.
- The SQL injection caveat is present for the RW section.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/references/storage-access.md
git commit -m "feat(dataapp-development): add storage-access reference"
```

---

## Task 7: Write `references/authentication.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/references/authentication.md`

**Spec source:** `### references/authentication.md` section.

- [ ] **Step 1: Write the file**

The file MUST start with:
```markdown
# Authentication

**Use this when:** you need to pick or configure an auth method for the app.
```

Required H2 sections:

1. **Options overview** — six methods: None, Basic (Keboola-generated password), OIDC (Auth0/Google/Entra ID/Okta), GitHub OAuth, GitLab OAuth, JumpCloud OIDC.
2. **When to pick which** — decision table: None for public demos; Basic for internal; OIDC for enterprise SSO; GitHub for developer-org-restricted; GitLab for GitLab-org-restricted; JumpCloud for JumpCloud-managed orgs.
3. **Callback URL format** — `https://<dataAppId>.hub.<keboolaConnectionHost>/_proxy/callback` for all OAuth/OIDC methods. Set this in the IdP's redirect URI configuration.
4. **Basic auth gotcha** — password is set on app creation and CANNOT be rotated. To change, delete and recreate the app.
5. **MCP defaults** — `modify_data_app` defaults to basic-auth for new apps. Pass `authentication_type="default"` on UPDATE to keep the existing setup (critical for OIDC apps — `basic-auth` would silently downgrade them).
6. **Row-level filtering pointer** — Per-user / row-level data access control is a storage-access concern, not an auth concern. See the "Data access management" placeholder in [storage-access.md](storage-access.md) — no documented pattern exists yet for either JS/Python or legacy Streamlit apps.

- [ ] **Step 2: Verify**

Check:
- All six auth options listed.
- Callback URL format is explicit.
- The MCP `authentication_type="default"` caveat is present with the OIDC-downgrade warning.
- Row-level pointer correctly directs to storage-access.md placeholder.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/references/authentication.md
git commit -m "feat(dataapp-development): add authentication reference"
```

---

## Task 8: Write `references/duckdb-caching.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/references/duckdb-caching.md`

**Spec source:** `### references/duckdb-caching.md` section.

- [ ] **Step 1: Write the file**

The file MUST start with:
```markdown
# DuckDB Caching

**Use this when:** the app reads from Keboola Storage and the same queries would otherwise hit Snowflake on every page render.
```

Required H2 sections:

1. **Why** — querying Snowflake on every render is slow and costs credits. Cache once per N minutes in in-memory DuckDB, query DuckDB locally.
2. **When to use** — read-only apps where data refresh interval ≥ minutes. Skip for RW apps (Storage Access).
3. **Node.js pattern** — describe the kai-pricing-calculator-app `api/duck.js` shape:
   - `init()` — `new duckdb.Database(":memory:")` + `CREATE TABLE` per data source.
   - `refresh()` — pull from Snowflake via the workspace query endpoint; write NDJSON to `/tmp/<name>-<ts>.ndjson`; `BEGIN` / `DELETE FROM <table>` / `INSERT INTO <table> SELECT ... FROM read_json_auto('/tmp/...', ignore_errors=true)` / `COMMIT`; clean up tmp files in `finally`.
   - `query(sql)` — `conn.all(sql, callback)`; convert `bigint` to `Number`, `Date` to ISO string.
   - `status()` — `lastRefresh`, `rowCount`, `lastError`, `refreshing`.
   - Auto-refresh interval (`setInterval`) and admin `POST /api/refresh` endpoint.
   - Code sample lifted from `templates/duckdb-cache/nodejs/duck.js`.
4. **Python pattern** — analogous shape using `duckdb` Python package:
   - `con = duckdb.connect(":memory:")` at module load.
   - `refresh()` — pull from Snowflake via `requests` to the workspace query endpoint; `con.register("conversations", df)` after pulling into a pandas DataFrame; or write to tmp parquet and `INSERT INTO ... FROM read_parquet(...)`.
   - `query(sql)` — `con.execute(sql).df()`.
   - Wrap `refresh()` in a TTL helper or threading lock for concurrent requests.
5. **Streamlit caching alternative** — for Streamlit apps that don't need cross-session caching, `@st.cache_data(ttl=300)` is simpler than DuckDB. Use DuckDB only when you need a shared cache across all sessions/users.
6. **Template** — point to `templates/duckdb-cache/`.

- [ ] **Step 2: Verify**

Check:
- Both Node.js and Python patterns documented.
- The "when to skip" criteria explicit (RW apps).
- Streamlit alternative noted to avoid recommending DuckDB where `@st.cache_data` is enough.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/references/duckdb-caching.md
git commit -m "feat(dataapp-development): add duckdb-caching reference"
```

---

## Task 9: Write `references/styling-guide.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/references/styling-guide.md`

**Spec source:** `### references/styling-guide.md` section.

- [ ] **Step 1: Write the file**

The file MUST start with:
```markdown
# Styling Guide

**Use this when:** you need default Keboola styling, brand customization, or to pick a frontend stack for visual presentation.
```

Required H2 sections:

1. **Lightweight default (dashboarding default)** — Tailwind via CDN, Chart.js via CDN, vanilla HTML + minimal JS modules. Keboola palette: primary `#1F8FFF`, bg `#FFFFFF`, secondary `#E6F2FF`, text `#222529`, font sans serif. Reference: kai-pricing-calculator-app `nodejs-pricing-simulator` branch. Include a minimal `<head>` snippet showing the CDN includes.
2. **Heavier framework option** — Vite/Next.js + React + shadcn/ui. When the UI complexity justifies a bundler and component library. Conventions: Plus Jakarta Sans + JetBrains Mono; single `COLORS` constant in `lib/constants.ts`; formatters in the same module; no emoji in UI elements. References: FI app and profitline-js-app.
3. **Streamlit** — default Keboola theme via the Theming UI (preferred for simple cases) or `[theme]` in `.streamlit/config.toml` (when Git-deployed). Include the `general-design-guide` extras: logo placement (`static/` folder, `st.image`), anchor-link hiding CSS, footer pattern.
4. **Brand customization** — override via `tailwind.config.ts` (or inline `<script>` Tailwind config for CDN), Tailwind theme block (bundled), or `[theme]` in `config.toml` (Streamlit). Provide one code sample per path.
5. **Hook for company-styling skill** — note that if a separate "company-styling" or `theme-factory` skill exists in the user's setup, that's where customer-brand defaults should live. This reference covers the platform-default look only.

- [ ] **Step 2: Verify**

Check:
- The CDN-Tailwind/Chart.js stack leads (dashboarding default).
- The shadcn/Vite stack is positioned as the heavier alternative.
- The Streamlit theme palette values are present (primary `#1F8FFF`, etc.).
- No emoji directive present.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/references/styling-guide.md
git commit -m "feat(dataapp-development): add styling-guide reference"
```

---

## Task 10: Write `references/dashboard-patterns.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/references/dashboard-patterns.md`

**Spec source:** `### references/dashboard-patterns.md` section.

- [ ] **Step 1: Write the file**

The file MUST start with:
```markdown
# Dashboard Patterns

**Use this when:** you're building a dashboarding-style app with sidebar filters, charts, metrics, and tables.
```

Required H2 sections:

1. **SQL-first aggregation** — aggregate in the database, never in the app. Sample good vs bad query side-by-side.
2. **Sidebar global filters** — store filter selections in `st.session_state` (Streamlit) or URL search params (Next.js/Vite) or a frontend store. Initialize with defaults. Update + rerun on change. Code sample from the agent-usage-data-app pattern.
3. **Per-page module layout (Streamlit)** — `streamlit_app.py` for entry/navigation, `page_modules/` for individual pages, `utils/data_loader.py` for centralized data access. Include the global WHERE-clause-builder pattern.
4. **Charts** — Plotly Express for Streamlit (`px.line`, `px.bar`, `px.pie`); ECharts via `echarts-for-react` for React; Chart.js for vanilla JS frontends.
5. **Empty/loading states** — every data-fetching component handles `isLoading`, `isError`, and empty-data explicitly. No layout shift — reserve space with skeletons or fixed-height containers.
6. **Number/currency/percent formatting** — single helper in `lib/constants.ts` (JS) or `utils/common.py` (Python). Never use `.toFixed()` or template literals scattered across components.
7. **Sortable tables** — keep numeric columns numeric; use `st.column_config.NumberColumn("Column", format="$%.2f")` for currency display in Streamlit so sorting stays numeric.

- [ ] **Step 2: Verify**

Check:
- All seven sections present.
- SQL-first example shows both anti-pattern and correct pattern.
- Sortable-tables gotcha is explicit.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/references/dashboard-patterns.md
git commit -m "feat(dataapp-development): add dashboard-patterns reference"
```

---

## Task 11: Write `references/kai-integration.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/references/kai-integration.md`

**Spec source:** `### references/kai-integration.md` section (full content, including both patterns).

- [ ] **Step 1: Write the file**

The file MUST start with:
```markdown
# Kai Integration

**Use this when:** you want to embed a natural-language assistant inside the app, grounded in the project's data.
```

Required H2 sections:

1. **When to add Kai** — optional; use when natural-language Q&A over project data helps; skip for pure dashboarding.
2. **Library** — [`keboola/kai-client`](https://github.com/keboola/kai-client) (Python async client + CLI). JS apps proxy to the same `/api/chat` endpoint.
3. **Service discovery** — Python: `KaiClient.from_storage_api(...)`. JS: `GET {KBC_URL}/v2/storage` → find `services[].id === "kai-assistant"`.
4. **Authentication** — Storage API token in `x-storageapi-token` (and `x-storageapi-url`). Same token the app already uses.
5. **Pattern A — Streamlit embed** — full code outline from `kai-client/examples/streamlit_app.py`: `KaiClient.new_chat_id()` in session state; `async for event in client.send_message(chat_id, prompt)`; event types (`text`, `tool-call`, `finish`, `tool-approval-required`); async-to-sync bridge with `run_async()`.
6. **Pattern B — JS data-app embed** — full code outline from `kai-client/examples/js-dataapp/server.js`: Express backend proxying `POST /api/chat` and `POST /api/chat/:chatId/:action/:approvalId` to Kai, streaming SSE back. Cache the discovered Kai URL after first lookup. Frontend reads SSE and renders chunks progressively.
7. **Pre-built skills** — note that the kai-client repo ships `plugins/kai-dataapp/skills/{kai-js, kai-streamlit}` — point users there for deeper integration work.
8. **DIY alternative — Anthropic SDK directly** — when full control is needed (custom tool catalog, no Kai dependency). Reference: FI app's `api/chat` Vercel serverless function with tools scoped to JSON files. Trade-off: you own model/prompt/tools; Kai gives those plus Keboola-grounded context.

- [ ] **Step 2: Verify**

Check:
- Both Streamlit and JS patterns documented with code outlines.
- Service-discovery flow is explicit (Storage API services list).
- DIY alternative is positioned as a separate option with clear trade-offs.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/references/kai-integration.md
git commit -m "feat(dataapp-development): add kai-integration reference"
```

---

## Task 12: Write `references/dev-workflow.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/references/dev-workflow.md`

**Spec source:** `### references/dev-workflow.md` section.

- [ ] **Step 1: Write the file**

The file MUST start with:
```markdown
# Development Workflow (Validate → Build → Verify)

**Use this when:** you're modifying an existing app and need a disciplined change loop.
```

Required H2 sections:

1. **Prerequisite** — first-time local-dev setup (install, run, secrets) lives in [streamlit-apps.md](streamlit-apps.md) or [python-js-apps.md](python-js-apps.md). This reference assumes the local server is already running.
2. **Validate** — `mcp__keboola__get_project_info` (SQL dialect), `mcp__keboola__get_table` (column names/types), `mcp__keboola__query_data` (test filter SQL with actual data). Code sample sequence.
3. **Build** — SQL-first; centralized `data_loader`; session state initialization with defaults; no variable-name conflicts between SQL filters and UI widgets.
4. **Verify** — when Playwright MCP is available: navigate to local server (`http://localhost:8501` for Streamlit, app's internal port otherwise); wait for load; take baseline screenshot; click filters; verify expected metric changes; navigate through all pages; take screenshots. Skip if no Playwright access; call out explicitly that verification was skipped.
5. **Checklist** — single condensed list (12–15 items) covering validate / build / verify / commit prep.

- [ ] **Step 2: Verify**

Check:
- The prerequisite pointer to type-specific references is at the top.
- All three phases (validate, build, verify) are present.
- The "skip verify if no Playwright" note is explicit.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/references/dev-workflow.md
git commit -m "feat(dataapp-development): add dev-workflow reference"
```

---

## Task 13: Write `references/troubleshooting.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/references/troubleshooting.md`

**Spec source:** `### references/troubleshooting.md` section.

- [ ] **Step 1: Write the file**

The file MUST start with:
```markdown
# Troubleshooting

**Use this when:** the app is failing to start, returning errors, or behaving unexpectedly.
```

Symptom-based H2 sections — one per problem. For each: **Symptom**, **Cause**, **Fix** (with code if applicable).

Problems to cover (one H2 each):

1. **"Cannot POST /" / "Method Not Allowed" on startup** — Cause: root route only accepts GET. Fix: `methods=["GET", "POST"]` (Flask), `app.all('/', ...)` (Express).
2. **"externally-managed-environment" / PEP 668** — Cause: `pip install` in code or setup.sh. Fix: replace with `uv sync`; ensure `pyproject.toml` exists.
3. **WebSocket fails / Streamlit blank page** — Cause: nginx not upgrading. Fix: add `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`.
4. **Streaming responses arrive all at once** — Cause: nginx buffering. Fix: `proxy_buffering off; proxy_cache off;` on the SSE/streaming location block.
5. **App won't start / restart loop** — Cause: relative paths, missing `uv run`, non-executable `setup.sh`, `[program:nginx]` declared. Fix: absolute `/app/...` paths, `uv run` prefix, `chmod +x` setup.sh, remove `[program:nginx]`.
6. **Port mismatch local vs Keboola** — Cause: nginx proxies to a different port than the app listens on. Fix: align the port in `default.conf` `proxy_pass` with the app's `listen`.
7. **Exit code 153** — Cause: git commit locking — the locked commit no longer exists in the remote (force-push, history rewrite). Fix: either restore the commit, or trigger a fresh deploy that re-locks to current HEAD.
8. **Workspace ID has `WORKSPACE_<id>` prefix** — Cause: Keboola exposes the Snowflake schema name; the Storage API needs numeric ID. Fix: regex-strip the prefix in code (sample from `kai-pricing-calculator-app/api/keboola-client.js`).
9. **500 from missing env var** — Cause: secret not configured in `dataApp.secrets`. Fix: add via UI / `kbagent data-app secrets-set` / MCP `modify_data_app`; redeploy.

End with **"Reading logs"** section: how to find logs (Keboola Terminal Log tab; MCP `get_data_apps([cfg_id])` for tail; kbagent — note logs CLI is a follow-up).

- [ ] **Step 2: Verify**

Check:
- All nine problems present as separate H2 sections.
- Each has Symptom / Cause / Fix structure.
- "Reading logs" section at the bottom.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/references/troubleshooting.md
git commit -m "feat(dataapp-development): add troubleshooting reference"
```

---

## Task 14: Create `templates/streamlit/`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/streamlit/streamlit_app.py`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/streamlit/pyproject.toml`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/streamlit/.streamlit/secrets.toml.example`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/streamlit/utils/__init__.py` (empty)
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/streamlit/utils/data_loader.py`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/streamlit/README.md`

**Spec source:** `### templates/streamlit/` section.

- [ ] **Step 1: Create streamlit_app.py**

Content:
```python
"""Streamlit data app — minimal template for Keboola deployment."""
import streamlit as st
import plotly.express as px
from utils.data_loader import execute_aggregation_query, get_table_name

st.set_page_config(page_title="Keboola App", layout="wide")
st.title("Keboola Data App")

with st.sidebar:
    st.header("Filters")
    if "category" not in st.session_state:
        st.session_state.category = "All"
    category = st.radio(
        "Category:",
        options=["All", "Option A", "Option B"],
        index=["All", "Option A", "Option B"].index(st.session_state.category),
    )
    if category != st.session_state.category:
        st.session_state.category = category
        st.rerun()

where_parts = []
if st.session_state.category != "All":
    where_parts.append(f"\"category\" = '{st.session_state.category}'")
where_clause = " AND ".join(where_parts) if where_parts else "1=1"

query = f"""
    SELECT "category", COUNT(*) AS count
    FROM {get_table_name("out.c-bucket.table")}
    WHERE {where_clause}
    GROUP BY "category"
    ORDER BY count DESC
"""

df = execute_aggregation_query(query)

if df.empty:
    st.warning("No data available.")
else:
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Total Rows", f"{int(df['count'].sum()):,}")
    with col2:
        st.metric("Categories", f"{len(df)}")

    fig = px.bar(df, x="category", y="count", title="Distribution by Category")
    st.plotly_chart(fig, use_container_width=True)
```

- [ ] **Step 2: Create pyproject.toml**

Content:
```toml
[project]
name = "keboola-streamlit-app"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "streamlit~=1.45.0",
    "pandas~=2.2.0",
    "plotly~=6.0.0",
    "requests~=2.31.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

- [ ] **Step 3: Create .streamlit/secrets.toml.example**

```bash
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/streamlit/.streamlit
```

Content:
```toml
# Copy this file to .streamlit/secrets.toml and fill in real values.
# NEVER commit secrets.toml. .gitignore should exclude it.
KBC_URL = "https://connection.us-east4.gcp.keboola.com"
KBC_TOKEN = "your-storage-api-token"
KBC_WORKSPACE_ID = "12345"
```

- [ ] **Step 4: Create utils/__init__.py**

Empty file:
```bash
touch plugins/dataapp-developer/skills/dataapp-development/templates/streamlit/utils/__init__.py
```

- [ ] **Step 5: Create utils/data_loader.py**

Content:
```python
"""Centralized data access for the Streamlit app."""
import os
import pandas as pd
import requests
import streamlit as st


def _get(name: str, default: str | None = None) -> str | None:
    """Read config from env (Keboola production) or st.secrets (local dev)."""
    value = os.environ.get(name)
    if value:
        return value
    try:
        return st.secrets.get(name, default)
    except FileNotFoundError:
        return default


def get_table_name(table_id: str) -> str:
    """Return the fully quoted SQL identifier for a Keboola Storage table ID."""
    last_dot = table_id.rfind(".")
    if last_dot < 0:
        return f'"{table_id}"'
    bucket, table = table_id[:last_dot], table_id[last_dot + 1:]
    return f'"{bucket}"."{table.replace("-", "_")}"'


@st.cache_data(ttl=300)
def execute_aggregation_query(sql: str) -> pd.DataFrame:
    """Execute SQL against the Keboola workspace and return a DataFrame."""
    kbc_url = _get("KBC_URL")
    kbc_token = _get("KBC_TOKEN")
    workspace_id = _get("KBC_WORKSPACE_ID") or _get("WORKSPACE_ID")
    branch = _get("BRANCH_ID", "default")

    if not (kbc_url and kbc_token and workspace_id):
        st.error("Missing KBC_URL / KBC_TOKEN / KBC_WORKSPACE_ID.")
        return pd.DataFrame()

    endpoint = f"{kbc_url}/v2/storage/branch/{branch}/workspaces/{workspace_id}/query"
    headers = {"X-StorageApi-Token": kbc_token, "Content-Type": "application/json"}
    response = requests.post(endpoint, headers=headers, json={"query": sql}, timeout=30)

    if response.status_code != 200:
        st.error(f"Query failed: {response.status_code} {response.text[:300]}")
        return pd.DataFrame()

    rows = response.json().get("data", {}).get("rows", [])
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df.columns = [c.lower() for c in df.columns]
    return df
```

- [ ] **Step 6: Create README.md**

Content:
```markdown
# Streamlit App Template

Minimal Keboola-deployable Streamlit data app.

## Local development

```bash
uv sync
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# Fill in KBC_URL, KBC_TOKEN, KBC_WORKSPACE_ID
streamlit run streamlit_app.py
```

Open http://localhost:8501.

## Deployment

Push this directory to a Git repo, then create a Streamlit App in Keboola pointing at the repo. Add the same env vars as `dataApp.secrets` (prefix each key with `#`).

See `references/streamlit-apps.md` and `references/deployment-paths.md` in the dataapp-development skill for details.
```

- [ ] **Step 7: Verify**

Check:
- Six files exist under `templates/streamlit/`.
- `pyproject.toml` lists all deps used by `streamlit_app.py` and `data_loader.py`.
- `data_loader.py` has the env-parity pattern (env → `st.secrets`).
- `.streamlit/secrets.toml.example` clearly says "never commit".

- [ ] **Step 8: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/templates/streamlit/
git commit -m "feat(dataapp-development): add streamlit starter template"
```

---

## Task 15: Create `templates/python-app/`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-app/app.py`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-app/pyproject.toml`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-app/keboola-config/nginx/sites/default.conf`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-app/keboola-config/supervisord/services/app.conf`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-app/keboola-config/setup.sh`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-app/README.md`

**Spec source:** `### templates/python-app/` section.

- [ ] **Step 1: Create the directory tree**

```bash
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/python-app/keboola-config/nginx/sites
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/python-app/keboola-config/supervisord/services
```

- [ ] **Step 2: Create app.py**

Content:
```python
"""Minimal Python data app — Flask on internal port 5000."""
import os
from flask import Flask, jsonify

app = Flask(__name__)
PORT = int(os.environ.get("PORT", 5000))


@app.route("/", methods=["GET", "POST"])
def index():
    # Keboola POSTs to / on startup — handle both methods.
    return """
    <!doctype html>
    <html><body style="font-family:sans-serif;padding:2rem;">
      <h1>Hello from Keboola</h1>
      <p>Python/JS Flask app running.</p>
    </body></html>
    """


@app.route("/api/health")
def health():
    return jsonify(ok=True, kbc_url=bool(os.environ.get("KBC_URL")))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
```

- [ ] **Step 3: Create pyproject.toml**

Content:
```toml
[project]
name = "keboola-python-app"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "flask>=3.0.0",
    "requests>=2.31.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

- [ ] **Step 4: Create keboola-config/nginx/sites/default.conf**

Content:
```nginx
server {
    listen 8888;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- [ ] **Step 5: Create keboola-config/supervisord/services/app.conf**

Content:
```ini
[program:app]
command=uv run python /app/app.py
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

- [ ] **Step 6: Create keboola-config/setup.sh**

Content:
```bash
#!/bin/bash
set -Eeuo pipefail
cd /app && uv sync
```

Make executable:
```bash
chmod +x plugins/dataapp-developer/skills/dataapp-development/templates/python-app/keboola-config/setup.sh
```

- [ ] **Step 7: Create README.md**

Content:
```markdown
# Python App Template

Minimal Keboola-deployable Python (Flask) data app.

## Local development

```bash
uv sync
uv run python app.py
```

Open http://localhost:5000.

## Deployment

Push this directory to a Git repo, then create a Python/JS App in Keboola pointing at the repo. Add any required env vars (`KBC_URL`, `KBC_TOKEN`, etc.) as `dataApp.secrets` (prefix each key with `#`).

See `references/python-js-apps.md` and `references/deployment-paths.md` in the dataapp-development skill for details.
```

- [ ] **Step 8: Verify**

Check:
- Directory tree matches the spec.
- `app.py` has `methods=["GET", "POST"]` on the root route.
- `app.conf` uses `uv run python`, absolute path, no `[program:nginx]`.
- `setup.sh` is executable.
- `nginx/sites/default.conf` proxies to port 5000.

```bash
ls -la plugins/dataapp-developer/skills/dataapp-development/templates/python-app/keboola-config/setup.sh
```
Expected: `-rwxr-xr-x` (executable).

- [ ] **Step 9: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/templates/python-app/
git commit -m "feat(dataapp-development): add python-app (Flask) starter template"
```

---

## Task 16: Create `templates/nodejs-app/` (dashboarding default)

**Files (full kai-pricing-style starter):**
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/server.js`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/package.json`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/api/keboola-client.js`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/api/queries.js`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/public/index.html`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/public/app.js`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/keboola-config/nginx/sites/default.conf`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/keboola-config/supervisord/services/app.conf`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/keboola-config/setup.sh`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/README.md`

**Spec source:** `### templates/nodejs-app/` section.

- [ ] **Step 1: Create directory tree**

```bash
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/api
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/public
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/keboola-config/nginx/sites
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/keboola-config/supervisord/services
```

- [ ] **Step 2: Create server.js**

Content (based on `kai-pricing-calculator-app/server.js`, simplified):
```javascript
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { runQuery, resolveKeboolaEnv } from './api/keboola-client.js';
import { getSummary } from './api/queries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mirror Keboola "#"-prefixed env vars into un-prefixed names for downstream code.
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('#') && value && !process.env[key.slice(1)]) {
    process.env[key.slice(1)] = value;
  }
}

// Local dev fallback: load .streamlit/secrets.toml if present.
const localSecrets = join(__dirname, '.streamlit', 'secrets.toml');
if (fs.existsSync(localSecrets)) {
  const raw = fs.readFileSync(localSecrets, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_#][A-Z0-9_]*)\s*=\s*"([^"]+)"\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.all('/', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));
app.use(express.static(join(__dirname, 'public'), { index: false }));

app.get('/api/health', (_req, res) => {
  const env = resolveKeboolaEnv();
  res.json({
    ok: Boolean(env.url && env.token && env.workspace),
    url: env.url,
    branch: env.branch,
    workspace: env.workspace,
    hasToken: Boolean(env.token),
  });
});

app.get('/api/summary', async (_req, res) => {
  try {
    const data = await getSummary();
    res.json({ ok: true, data, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`App listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Create package.json**

Content:
```json
{
  "name": "keboola-nodejs-app",
  "version": "0.1.0",
  "description": "Keboola single-Node dashboarding app starter",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node --env-file-if-exists=.env server.js",
    "dev": "node --env-file-if-exists=.env --watch server.js"
  },
  "dependencies": {
    "express": "^4.21.2"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 4: Create api/keboola-client.js**

Content (adapted from kai-pricing-calculator-app):
```javascript
import { readFileSync } from 'node:fs';

let queryQueue = Promise.resolve();

function normalizeWorkspaceId(raw) {
  if (!raw) return null;
  // Keboola exposes the Snowflake schema name (WORKSPACE_<id>) in some cases;
  // strip the prefix so the Storage API workspace endpoint accepts it.
  const m = raw.match(/^WORKSPACE_(\d+)$/i);
  return m ? m[1] : raw;
}

function readTokenFromPath() {
  const path = process.env.STORAGE_API_TOKEN_PATH || process.env.KBC_STORAGE_API_TOKEN_PATH;
  if (!path) return null;
  try {
    return readFileSync(path, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

export function resolveKeboolaEnv() {
  const pick = (...names) => {
    for (const n of names) {
      if (process.env[n]) return { value: process.env[n], source: n };
    }
    return { value: null, source: null };
  };
  const url = pick('KBC_URL', 'KBC_STACK_API_URL', 'STORAGE_API_URL');
  let token = pick('KBC_TOKEN', 'KBC_STORAGEAPI_TOKEN', 'STORAGE_API_TOKEN');
  if (!token.value) {
    const fileToken = readTokenFromPath();
    if (fileToken) token = { value: fileToken, source: 'STORAGE_API_TOKEN_PATH (file)' };
  }
  const workspaceRaw = pick('KBC_WORKSPACE_ID', 'WORKSPACE_ID');
  const branch = pick('KBC_BRANCH_ID', 'BRANCH_ID');
  return {
    url: url.value,
    token: token.value,
    workspace: normalizeWorkspaceId(workspaceRaw.value),
    workspaceRaw: workspaceRaw.value,
    branch: branch.value || 'default',
  };
}

async function runQueryNow(sql, retriesLeft = 2) {
  const { url, token, workspace, branch } = resolveKeboolaEnv();
  const missing = [];
  if (!url) missing.push('KBC_URL');
  if (!token) missing.push('KBC_TOKEN');
  if (!workspace) missing.push('KBC_WORKSPACE_ID');
  if (missing.length > 0) throw new Error(`Missing env vars: ${missing.join(', ')}`);

  const endpoint = `${url}/v2/storage/branch/${branch}/workspaces/${workspace}/query`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'X-StorageApi-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });

  if (res.status >= 500 && retriesLeft > 0) {
    await new Promise((r) => setTimeout(r, 800));
    return runQueryNow(sql, retriesLeft - 1);
  }
  if (!res.ok) {
    throw new Error(`Keboola query failed (HTTP ${res.status}): ${(await res.text()).slice(0, 500)}`);
  }
  const result = await res.json();
  if (result.status === 'error') throw new Error(`SQL error: ${result.message || 'unknown'}`);

  return (result.data?.rows || []).map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      const key = k.toLowerCase();
      if (v === null || v === undefined) out[key] = null;
      else if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) out[key] = Number(v);
      else out[key] = v;
    }
    return out;
  });
}

export function runQuery(sql) {
  const next = queryQueue.catch(() => null).then(() => runQueryNow(sql));
  queryQueue = next.catch(() => null);
  return next;
}
```

- [ ] **Step 5: Create api/queries.js**

Content:
```javascript
import { runQuery } from './keboola-client.js';

/**
 * Example summary query. Replace with app-specific SQL.
 * The placeholder query expects a table 'in.c-bucket.table' in your workspace.
 */
export async function getSummary() {
  const rows = await runQuery(`
    SELECT COUNT(*) AS row_count
    FROM "in.c-bucket"."table"
  `);
  return rows[0] || { row_count: 0 };
}
```

- [ ] **Step 6: Create public/index.html**

Content (Tailwind + Chart.js via CDN):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Keboola App</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  </head>
  <body class="bg-white text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto p-8">
      <h1 class="text-3xl font-semibold mb-4">Keboola App</h1>
      <section id="summary" class="grid grid-cols-3 gap-4 mb-8">
        <div class="p-4 rounded border border-slate-200">
          <div class="text-sm text-slate-500">Total rows</div>
          <div class="text-2xl font-semibold" id="row-count">—</div>
        </div>
      </section>
      <canvas id="chart" height="120"></canvas>
    </main>
    <script type="module" src="/app.js"></script>
  </body>
</html>
```

- [ ] **Step 7: Create public/app.js**

Content:
```javascript
async function loadSummary() {
  const res = await fetch('/api/summary');
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

(async () => {
  const summary = await loadSummary();
  if (!summary) return;
  document.getElementById('row-count').textContent =
    Number(summary.row_count).toLocaleString();

  const ctx = document.getElementById('chart');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Rows'],
      datasets: [{ label: 'Total', data: [summary.row_count], backgroundColor: '#1F8FFF' }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
})();
```

- [ ] **Step 8: Create keboola-config/nginx/sites/default.conf**

Content:
```nginx
server {
    listen 8888;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Uncomment for WebSocket / SSE support
        # proxy_http_version 1.1;
        # proxy_set_header Upgrade $http_upgrade;
        # proxy_set_header Connection "upgrade";
        # proxy_read_timeout 86400;
        # proxy_buffering off;
    }
}
```

- [ ] **Step 9: Create keboola-config/supervisord/services/app.conf**

Content:
```ini
[program:app]
command=node /app/server.js
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

- [ ] **Step 10: Create keboola-config/setup.sh**

Content:
```bash
#!/bin/bash
set -Eeuo pipefail
cd /app && npm install --omit=dev
```

Make executable:
```bash
chmod +x plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/keboola-config/setup.sh
```

- [ ] **Step 11: Create README.md**

Content:
```markdown
# Node.js App Template (dashboarding default)

The preferred shape for dashboarding apps: single Express server serving both `/api/*` JSON endpoints and a static frontend with Tailwind + Chart.js loaded via CDN. No bundler, no build step.

Modeled on [`keboola-rnd/kai-pricing-calculator-app` on the `nodejs-pricing-simulator` branch](https://github.com/keboola-rnd/kai-pricing-calculator-app/tree/nodejs-pricing-simulator).

## Local development

```bash
npm install
# Create .env (or .streamlit/secrets.toml) with KBC_URL, KBC_TOKEN, KBC_WORKSPACE_ID
node --watch server.js
```

Open http://localhost:3000.

## Deployment

Push this directory to a Git repo, then create a Python/JS App in Keboola pointing at the repo. Add `KBC_URL`, `KBC_TOKEN`, `KBC_WORKSPACE_ID` as `dataApp.secrets` (prefix each key with `#`).

See `references/python-js-apps.md`, `references/storage-access.md`, and `references/duckdb-caching.md` (when you're ready to add caching) in the dataapp-development skill.
```

- [ ] **Step 12: Verify**

Check:
- 10 files exist under `templates/nodejs-app/`.
- `server.js` has `app.all('/')` for POST handling.
- `package.json` has `"type": "module"` and `engines.node >=20`.
- `default.conf` proxies to port 3000.
- `app.conf` uses `node /app/server.js` (absolute path).
- `setup.sh` is executable.
- `public/index.html` includes Tailwind and Chart.js CDN scripts.

- [ ] **Step 13: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/templates/nodejs-app/
git commit -m "feat(dataapp-development): add nodejs-app dashboarding starter template"
```

---

## Task 17: Create `templates/python-node-app/`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/backend/main.py`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/backend/pyproject.toml`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/frontend/package.json`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/frontend/server.js`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/frontend/public/index.html`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/keboola-config/nginx/sites/default.conf`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/keboola-config/supervisord/services/backend.conf`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/keboola-config/supervisord/services/frontend.conf`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/keboola-config/setup.sh`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/README.md`

**Spec source:** `### templates/python-node-app/` section.

For simplicity, the template uses Express to serve the frontend's static files (`frontend/public/`) rather than a Vite/Next.js bundle. This keeps the template runnable out of the box without requiring a build step. Users can swap in Vite + React + a `dist/` build later if they want.

- [ ] **Step 1: Create directory tree**

```bash
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/backend
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/frontend/public
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/keboola-config/nginx/sites
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/keboola-config/supervisord/services
```

- [ ] **Step 2: Create backend/main.py**

Content:
```python
"""FastAPI backend for combined Python + Node app — serves /api/* endpoints."""
import os
from fastapi import FastAPI

app = FastAPI(title="Keboola Data App Backend")


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "kbc_url": bool(os.environ.get("KBC_URL")),
        "kbc_token": bool(os.environ.get("KBC_TOKEN")),
    }


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI backend"}
```

- [ ] **Step 3: Create backend/pyproject.toml**

Content:
```toml
[project]
name = "keboola-python-node-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

- [ ] **Step 4: Create frontend/package.json**

Content:
```json
{
  "name": "keboola-python-node-frontend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.21.2"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 5: Create frontend/server.js**

Content (serves static frontend; proxies /api/* to backend for local dev):
```javascript
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8050';

app.use(express.json());

// In Keboola, nginx routes /api/* to the backend on :8050 and / to this server.
// In local dev, this proxy makes /api/* work too without running nginx.
app.use('/api', async (req, res) => {
  try {
    const upstream = await fetch(`${BACKEND_URL}/api${req.url}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    const text = await upstream.text();
    res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(text);
  } catch (err) {
    res.status(502).json({ error: `backend unreachable: ${err.message}` });
  }
});

app.all('/', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));
app.use(express.static(join(__dirname, 'public'), { index: false }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 6: Create frontend/public/index.html**

Content:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Keboola App</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-white text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto p-8">
      <h1 class="text-3xl font-semibold mb-4">Keboola App</h1>
      <p class="text-slate-600 mb-6">Combined Python (FastAPI) backend + Node.js frontend.</p>
      <pre id="health" class="bg-slate-100 p-4 rounded text-sm"></pre>
    </main>
    <script>
      fetch('/api/health')
        .then((r) => r.json())
        .then((d) => (document.getElementById('health').textContent = JSON.stringify(d, null, 2)));
    </script>
  </body>
</html>
```

- [ ] **Step 7: Create keboola-config/nginx/sites/default.conf**

Content (two location blocks):
```nginx
server {
    listen 8888;
    server_name _;

    # API requests go to the Python backend.
    location /api/ {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Everything else goes to the Node frontend.
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Uncomment for WebSocket support on the frontend
        # proxy_http_version 1.1;
        # proxy_set_header Upgrade $http_upgrade;
        # proxy_set_header Connection "upgrade";
    }
}
```

- [ ] **Step 8: Create keboola-config/supervisord/services/backend.conf**

Content:
```ini
[program:backend]
command=uv run uvicorn main:app --host 127.0.0.1 --port 8050
directory=/app/backend
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

- [ ] **Step 9: Create keboola-config/supervisord/services/frontend.conf**

Content:
```ini
[program:frontend]
command=node /app/frontend/server.js
directory=/app/frontend
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

- [ ] **Step 10: Create keboola-config/setup.sh**

Content (parallel install):
```bash
#!/bin/bash
set -Eeuo pipefail

cd /app/backend && uv sync &
cd /app/frontend && npm install --omit=dev &
wait
```

Make executable:
```bash
chmod +x plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/keboola-config/setup.sh
```

- [ ] **Step 11: Create README.md**

Content:
```markdown
# Python + Node App Template

Combined Python (FastAPI) backend + Node.js (Express) frontend in one Keboola container. Use this when you genuinely need a Python backend alongside a JS frontend; for pure dashboarding, the simpler `nodejs-app/` template is preferred.

Modeled on the [`keboola/profitline-js-app`](https://github.com/keboola/profitline-js-app) shape (FastAPI :8050 + Express :3000).

## Local development

Two terminals:

```bash
# Terminal 1 — backend
cd backend
uv sync
uv run uvicorn main:app --reload --port 8050
```

```bash
# Terminal 2 — frontend
cd frontend
npm install
node --watch server.js
```

Open http://localhost:3000. The frontend's Express server proxies `/api/*` to the backend so you don't need a local nginx.

## Deployment

Push this directory to a Git repo. The `keboola-config/setup.sh` runs `uv sync` and `npm install` in parallel. Add Keboola secrets for `KBC_URL`, `KBC_TOKEN`, etc.

See `references/python-js-apps.md` (multi-server section) and `references/deployment-paths.md` in the dataapp-development skill.
```

- [ ] **Step 12: Verify**

Check:
- 10 files exist.
- `backend/main.py` is a FastAPI app on `:8050`.
- `frontend/server.js` has `/api/*` proxy for local dev.
- nginx config has two location blocks (`/api/` before `/`).
- Two supervisord configs: `backend.conf` and `frontend.conf`.
- `setup.sh` runs install in parallel with `&` + `wait`.
- `setup.sh` is executable.

- [ ] **Step 13: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/templates/python-node-app/
git commit -m "feat(dataapp-development): add python-node-app dual-server template"
```

---

## Task 18: Create `templates/duckdb-cache/`

**Files:**
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/duckdb-cache/nodejs/duck.js`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/duckdb-cache/python/cache.py`
- Create: `plugins/dataapp-developer/skills/dataapp-development/templates/duckdb-cache/README.md`

**Spec source:** `### templates/duckdb-cache/` section.

- [ ] **Step 1: Create directory tree**

```bash
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/duckdb-cache/nodejs
mkdir -p plugins/dataapp-developer/skills/dataapp-development/templates/duckdb-cache/python
```

- [ ] **Step 2: Create nodejs/duck.js**

Content (generic harness adapted from `kai-pricing-calculator-app/api/duck.js`):
```javascript
/**
 * Generic DuckDB caching harness — pulls data from Keboola Snowflake workspace
 * into an in-memory DuckDB on a refresh interval, then serves queries against
 * the local cache.
 *
 * Customize: SNOWFLAKE_PULL_SQL, CREATE TABLE schemas, INSERT projection.
 */
import duckdb from 'duckdb';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const db = new duckdb.Database(':memory:');
const conn = db.connect();

const run = (sql) =>
  new Promise((resolve, reject) => conn.run(sql, (err) => (err ? reject(err) : resolve())));

const all = (sql) =>
  new Promise((resolve, reject) =>
    conn.all(sql, (err, rows) => (err ? reject(err) : resolve(rows))),
  );

let lastRefresh = null;
let rowCount = 0;
let lastError = null;
let refreshPromise = null;

// EDIT THIS: pull SQL against your Keboola workspace.
const SNOWFLAKE_PULL_SQL = `
  SELECT
    "id" AS id,
    "name" AS name,
    "value" AS value
  FROM "in.c-bucket"."table"
`;

export async function init() {
  // EDIT THIS: define the cached schema.
  await run(`CREATE TABLE IF NOT EXISTS items (
    id VARCHAR,
    name VARCHAR,
    value DOUBLE
  )`);
}

export async function refresh(runSnowflake, { force = false } = {}) {
  if (refreshPromise && !force) return refreshPromise;
  refreshPromise = (async () => {
    const t0 = Date.now();
    let rows;
    try {
      rows = await runSnowflake(SNOWFLAKE_PULL_SQL);
    } catch (err) {
      lastError = err.message;
      throw err;
    }
    const tmpPath = join(tmpdir(), `cache-${Date.now()}.ndjson`);
    await writeFile(tmpPath, rows.map((r) => JSON.stringify(r)).join('\n'));
    try {
      await run('BEGIN');
      await run('DELETE FROM items');
      await run(`
        INSERT INTO items
        SELECT id, name, TRY_CAST(value AS DOUBLE) AS value
        FROM read_json_auto('${tmpPath}', ignore_errors=true)
      `);
      await run('COMMIT');
    } catch (err) {
      await run('ROLLBACK').catch(() => {});
      lastError = err.message;
      throw err;
    } finally {
      unlink(tmpPath).catch(() => {});
    }
    const countRow = await all('SELECT COUNT(*) AS n FROM items');
    rowCount = Number(countRow[0]?.n ?? 0);
    lastRefresh = new Date();
    lastError = null;
    console.log(`[duck] refreshed ${rowCount} rows in ${Math.round((Date.now() - t0) / 1000)}s`);
  })();

  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function query(sql) {
  const rows = await all(sql);
  return rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'bigint') out[k] = Number(v);
      else if (v instanceof Date) out[k] = v.toISOString();
      else out[k] = v;
    }
    return out;
  });
}

export function status() {
  return {
    lastRefresh: lastRefresh ? lastRefresh.toISOString() : null,
    rowCount,
    lastError,
    refreshing: Boolean(refreshPromise),
  };
}
```

- [ ] **Step 3: Create python/cache.py**

Content:
```python
"""DuckDB cache harness for Python Keboola apps.

Customize: SNOWFLAKE_PULL_SQL, CREATE TABLE schemas, INSERT projection.

Usage:
    from cache import init, refresh, query, status

    init()
    refresh(run_snowflake)  # pass your workspace-query callable
    rows = query("SELECT name, value FROM items WHERE value > 100")
"""
from __future__ import annotations

import os
import threading
import time
from typing import Callable, Iterable

import duckdb
import pandas as pd

_con = duckdb.connect(":memory:")
_lock = threading.Lock()
_last_refresh: float | None = None
_row_count = 0
_last_error: str | None = None
_refreshing = False

# EDIT THIS: pull SQL against your Keboola workspace.
SNOWFLAKE_PULL_SQL = """
    SELECT "id" AS id, "name" AS name, "value" AS value
    FROM "in.c-bucket"."table"
"""


def init() -> None:
    """Create the cached tables. Idempotent."""
    # EDIT THIS: define the cached schema.
    _con.execute(
        """
        CREATE TABLE IF NOT EXISTS items (
            id VARCHAR,
            name VARCHAR,
            value DOUBLE
        )
        """
    )


def refresh(run_snowflake: Callable[[str], Iterable[dict]], *, force: bool = False) -> None:
    """Pull from Snowflake and replace the cache contents.

    `run_snowflake(sql)` must return an iterable of dicts.
    """
    global _last_refresh, _row_count, _last_error, _refreshing

    with _lock:
        if _refreshing and not force:
            return
        _refreshing = True

    try:
        t0 = time.time()
        rows = list(run_snowflake(SNOWFLAKE_PULL_SQL))
        df = pd.DataFrame(rows)

        _con.execute("BEGIN")
        _con.execute("DELETE FROM items")
        if not df.empty:
            _con.register("incoming", df)
            _con.execute(
                "INSERT INTO items SELECT id, name, TRY_CAST(value AS DOUBLE) FROM incoming"
            )
            _con.unregister("incoming")
        _con.execute("COMMIT")

        _row_count = int(_con.execute("SELECT COUNT(*) FROM items").fetchone()[0])
        _last_refresh = time.time()
        _last_error = None
        print(f"[duck] refreshed {_row_count} rows in {time.time() - t0:.1f}s")
    except Exception as e:
        _con.execute("ROLLBACK")
        _last_error = str(e)
        raise
    finally:
        with _lock:
            _refreshing = False


def query(sql: str) -> pd.DataFrame:
    """Run a SQL query against the cached DuckDB and return a DataFrame."""
    return _con.execute(sql).df()


def status() -> dict:
    return {
        "last_refresh": _last_refresh,
        "row_count": _row_count,
        "last_error": _last_error,
        "refreshing": _refreshing,
    }
```

- [ ] **Step 4: Create README.md**

Content:
```markdown
# DuckDB Cache Template

Generic harness for caching Keboola Snowflake data in an in-memory DuckDB so the app doesn't hit Snowflake on every page render.

## When to use this

- Read-only apps where data refresh interval is minutes, not seconds.
- Skip for RW apps (Storage Access via Query Service) — every read should be current.

## Files

- `nodejs/duck.js` — Node.js harness (init / refresh / query / status). Adapted from `kai-pricing-calculator-app/api/duck.js`.
- `python/cache.py` — Python harness, same API shape.

## Integration

Copy the relevant file into your app's `api/` (Node) or alongside your data-loader module (Python). Edit `SNOWFLAKE_PULL_SQL`, the `CREATE TABLE`, and the `INSERT` projection to match your data. Wire `refresh()` into a background interval (`setInterval` / `threading.Timer`) and an admin endpoint (`POST /api/refresh`).

See `references/duckdb-caching.md` in the dataapp-development skill for the full pattern.
```

- [ ] **Step 5: Verify**

Check:
- 3 files exist under `templates/duckdb-cache/`.
- `nodejs/duck.js` has init/refresh/query/status exports.
- `python/cache.py` has equivalent function signatures.
- README explains when to use and when to skip.

- [ ] **Step 6: Commit**

```bash
git add plugins/dataapp-developer/skills/dataapp-development/templates/duckdb-cache/
git commit -m "feat(dataapp-development): add duckdb-cache template"
```

---

## Task 19: Delete old skill directories

**Files:**
- Delete: `plugins/dataapp-developer/skills/dataapp-dev/` (entire directory).
- Delete: `plugins/dataapp-developer/skills/dataapp-deployment/` (entire directory).

- [ ] **Step 1: Confirm new skill is in place**

```bash
ls plugins/dataapp-developer/skills/dataapp-development/SKILL.md
ls plugins/dataapp-developer/skills/dataapp-development/references/ | wc -l
ls plugins/dataapp-developer/skills/dataapp-development/templates/ | wc -l
```

Expected:
- `SKILL.md` exists.
- `references/` has 12 files.
- `templates/` has 5 directories.

If any check fails, do not proceed — fix the missing piece first.

- [ ] **Step 2: Delete the two old skill directories**

```bash
git rm -r plugins/dataapp-developer/skills/dataapp-dev
git rm -r plugins/dataapp-developer/skills/dataapp-deployment
```

- [ ] **Step 3: Verify deletion**

```bash
ls plugins/dataapp-developer/skills/
```

Expected: only `dataapp-development/` listed.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore(dataapp-developer): remove legacy dataapp-dev and dataapp-deployment skills

Their content has been consolidated into the new dataapp-development skill
(SKILL.md + 12 references + 5 templates).
EOF
)"
```

---

## Task 20: Update plugin metadata and READMEs

**Files:**
- Modify: `plugins/dataapp-developer/.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `plugins/dataapp-developer/README.md`
- Modify: `README.md` (root)

- [ ] **Step 1: Bump plugin.json version**

Edit `plugins/dataapp-developer/.claude-plugin/plugin.json`:

Change `"version": "1.1.0"` to `"version": "1.2.0"`.

Update `"description"` to: `"Toolkit for building and deploying Keboola Apps (Streamlit and Python/JS) — full lifecycle: choosing app type, deployment paths, storage access, authentication, DuckDB caching, styling, dashboard patterns, optional Kai chat, and the validate-build-verify dev workflow."`.

- [ ] **Step 2: Bump marketplace.json entry**

Edit `.claude-plugin/marketplace.json`. In the `plugins` array, find the entry with `"name": "dataapp-developer"`:

- Change `"version": "1.1.0"` to `"version": "1.2.0"`.
- Update `"description"` to match the plugin.json description above.

- [ ] **Step 3: Rewrite plugins/dataapp-developer/README.md**

Replace the entire file. The new README must:

1. Open with one paragraph describing the plugin: "Toolkit for building and deploying Keboola Apps. Provides a single skill, `dataapp-development`, that covers the full lifecycle (Streamlit and Python/JS app types, three client paths, storage access, authentication, styling, caching, dashboarding, Kai integration, dev workflow, troubleshooting) with 12 topical references and 5 runnable templates."

2. **Available Skills** section listing only `dataapp-development` with:
   - Skill name and activation note ("Activates automatically when working on Keboola Apps").
   - "What it covers" bulleted list (the 12 reference areas).
   - "Templates included" list (the 5 template directories).
   - "Use cases" list (build new app, modify existing, deploy, debug, migrate).

3. **MCP Servers** section listing Keboola MCP (remote SSE) and Playwright MCP (npx), same as before.

4. **Plugin Structure** section showing the new directory tree:
   ```
   plugins/dataapp-developer/
   ├── .claude-plugin/
   │   └── plugin.json
   ├── skills/
   │   └── dataapp-development/
   │       ├── SKILL.md
   │       ├── references/      # 12 files
   │       └── templates/       # 5 directories
   └── README.md
   ```

5. **Version**: 1.2.0. **Maintainer**: same as before. **License**: MIT.

- [ ] **Step 4: Update root README.md feature list**

Open `README.md` at the repository root. Find the "Data App Developer Plugin" section. Replace the **Features** list with:

```markdown
**Features:**
- 🎯 **Skill**: Single `dataapp-development` skill covering both Streamlit and Python/JS apps with 12 topical references
- 🚀 **App Types**: Streamlit (Code or Git), single Node.js + static (dashboarding default), combined Python + Node
- 💾 **Storage**: RO workspace (default), RW direct access via Query Service, input mapping (legacy)
- 🔒 **Authentication**: None / Basic / OIDC / GitHub / GitLab / JumpCloud
- ⚡ **Performance**: Opinionated DuckDB caching pattern (Python + Node templates included)
- 🎨 **Styling**: Default Keboola theme + brand customization paths
- 🤖 **Kai Integration**: Optional natural-language assistant via `kai-client`
- 📦 **Templates**: 5 runnable starters (Streamlit, Python-only, Node-only, Python+Node, DuckDB cache)
- 🔌 **MCP Servers**: Keboola (remote HTTP) and Playwright (browser automation)
```

- [ ] **Step 5: Validate plugin**

```bash
claude plugin validate .
```

Expected: passes with no errors. If it fails, fix any reported issues before committing.

- [ ] **Step 6: Commit**

```bash
git add plugins/dataapp-developer/.claude-plugin/plugin.json \
        .claude-plugin/marketplace.json \
        plugins/dataapp-developer/README.md \
        README.md
git commit -m "$(cat <<'EOF'
chore(dataapp-developer): bump to 1.2.0 and update READMEs for dataapp-development

- plugin.json + marketplace.json: 1.1.0 -> 1.2.0, updated descriptions.
- Plugin README: rewritten to describe the single dataapp-development skill,
  12 references, and 5 templates.
- Root README: refreshed Data App Developer Plugin feature list.
EOF
)"
```

---

## Task 21: Final validation

- [ ] **Step 1: Run `claude plugin validate .`**

```bash
claude plugin validate .
```

Expected: passes.

- [ ] **Step 2: Confirm all 12 references have the "Use this when..." opener**

```bash
for f in plugins/dataapp-developer/skills/dataapp-development/references/*.md; do
  echo "=== $f ==="
  head -3 "$f"
done
```

Each file should have an H1 title on line 1 (or 2 with frontmatter) and a `**Use this when:**` line within the first three lines.

- [ ] **Step 3: Confirm template scripts are executable**

```bash
ls -la plugins/dataapp-developer/skills/dataapp-development/templates/*/keboola-config/setup.sh 2>/dev/null
```

All `setup.sh` files should be `-rwxr-xr-x`.

- [ ] **Step 4: Confirm directory structure**

```bash
tree plugins/dataapp-developer/skills/dataapp-development/ -L 3 2>/dev/null \
  || find plugins/dataapp-developer/skills/dataapp-development -maxdepth 3 -type f | sort
```

Expected:
- One `SKILL.md`.
- 12 files under `references/`.
- 5 subdirectories under `templates/`, each with its own files.

- [ ] **Step 5: Confirm old skills are gone**

```bash
ls plugins/dataapp-developer/skills/
```

Expected: only `dataapp-development/` listed.

- [ ] **Step 6: Confirm version bumps**

```bash
grep '"version"' plugins/dataapp-developer/.claude-plugin/plugin.json
grep -A1 '"name": "dataapp-developer"' .claude-plugin/marketplace.json | grep version
```

Expected: both show `"version": "1.2.0"`.

- [ ] **Step 7: Acceptance criteria checklist**

Walk through the spec's "Acceptance criteria" section:

1. [ ] `plugins/dataapp-developer/skills/dataapp-development/` exists with `SKILL.md`, 12 references, 5 template directories.
2. [ ] `plugins/dataapp-developer/skills/dataapp-dev/` and `dataapp-deployment/` are deleted.
3. [ ] Plugin version bumped in both `plugin.json` and `marketplace.json`.
4. [ ] Plugin `README.md` and root `README.md` reflect the new single-skill structure.
5. [ ] `claude plugin validate .` passes.
6. [ ] Each reference file opens with a "Use this when…" line.
7. [ ] Each template directory contains a minimum-viable runnable scaffold.
8. [ ] The `SKILL.md` decision tree routes correctly for every combination of {app type} × {client path} × {task}.

Stop and report any items not yet satisfied — the plan is not complete until all 8 boxes can be checked.

- [ ] **Step 8: No commit at this step** — validation only.
