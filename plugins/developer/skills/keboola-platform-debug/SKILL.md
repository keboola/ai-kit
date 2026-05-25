---
name: keboola-platform-debug
description: Debug failed Keboola platform incidents — component/storage jobs that ended with "Internal Error", stuck workers, 5xx from services, race conditions, K8s pod issues, and any other production failure on Keboola stacks. Drives investigation through Datadog (logs + APM), correlates trace IDs across services, applies known failure patterns, and falls back to the C4 architecture model for impact analysis. Triggers when the user pastes a Keboola job URL (`connection.*/admin/projects/N/queue/M`), mentions a Keboola jobId / projectId, asks "why did job X fail?", "Internal Error", "investigate incident on stack X", inc-* Slack channel context, or asks to debug any Keboola service — job-queue, connection, storage, sandboxes, apps, vault, encryption, scheduler, notification, billing, ai/kai, stream, editor.
---

# Keboola platform debug

## Overview

Drive Keboola incident investigations through a fixed 5-phase flow. Each phase has concrete Datadog query templates and decision points. References hold the lookup tables (env tags, service catalog, Internal Error decision tree).

**Why a fixed flow?** Keboola logs are retained for 7 days, APM for 1-2 months, and the platform spans dozens of services with different log/tag conventions. Random exploration burns time and the conversation context. The flow front-loads scoping (env, service, IDs) so subsequent queries are surgical.

## Prerequisites

This skill is **Keboola-internal SRE tooling**. It assumes access to Keboola's production observability stack and is not intended for external use.

### Hard required

These MUST be configured before any phase can run.

| Prerequisite | Why | How to set up |
|---|---|---|
| **Datadog MCP server** (`mcp__datadog-mcp__*`) | Every phase pulls logs / APM via these tools | Add the Datadog MCP server to `.mcp.json` (or user-level MCP config). Requires Datadog **EU site** credentials: `DD-API-KEY` and `DD-APPLICATION-KEY`. The current canonical config lives in the Keboola SRE setup notes. |
| **Keboola SSO / Datadog account** with read access to monitoring | Underlies all MCP queries | Internal — managed via Okta / Datadog role assignments. |

At session start, call `mcp__datadog-mcp__list_datadog_skills` once, then `load_datadog_skill('datadog/logs')` (and `datadog/traces` if you'll touch APM).

### Bundled (ships with this plugin — nothing to install)

| Skill | Used in | Notes |
|---|---|---|
| `developer:keboola-architecture` | Phase 4.2 explicitly reads `references/c4/l3/<service>.md` | Same plugin (`developer@1.9.0+`). If you have this skill, you have it. |

### Recommended (different marketplace, public)

| Skill | Marketplace | Used for |
|---|---|---|
| `superpowers:systematic-debugging` | `obra/claude-plugins-official` (or fork) | Provides the broader root-cause-investigation mental model that Phase 4 builds on. Install with `/plugin marketplace add obra/superpowers` + `/plugin install superpowers`. |

### Optional (only relevant for specific incident types — Keboola SRE tools)

These are NOT on any public marketplace. They are part of the Keboola SRE local setup. Skip them if you don't have them; the skill degrades gracefully.

| Tool / skill | Triggers when |
|---|---|
| `kbc-stacks` CLI + repo access | You need `kubectl` against a Keboola stack: `./cli/kbc-stacks k8s <stack>` to set the kubeconfig context. Used for K8s events, pod inspection, manual pod cleanup. |
| Telemetry project 133 access via Keboola MCP | Cross-stack analytical questions that Datadog can't answer (Snowflake costs, MCP analytics, customer aggregates). |

### Sanity check before starting

```bash
# Datadog MCP reachable?
mcp__datadog-mcp__list_datadog_skills  # should return a list, not auth error

# keboola-architecture available?
# (Skill should appear in the available-skills list as `developer:keboola-architecture`.)
```

If the Datadog MCP fails with auth errors, stop and fix configuration before continuing — every subsequent step depends on it.

## Reference files

Read on demand — do NOT pre-load both. They are large.

- **`references/datadog.md`** — Region, env tag map, full Keboola Datadog service catalog, tag/attribute conventions, query templates, DDSQL gotchas. **Read in Phase 1** to map stack → `env` and identify the Datadog service handle.
- **`references/internal-error.md`** — Decision tree for the "Internal Error" status: 4 known causes (FAILED_TO_START, daemon race, component error, pod disappeared) with detection queries each. **Read in Phase 4** when symptom is `error` on a component job.

For per-service architecture (deployed components, inter-service edges, cloud resources, persistence, common failure surface), defer to the bundled **`developer:keboola-architecture` skill** — every service has its own `c4/l3/<service>.md` finding report there. Do not duplicate that content here.

## Phase 1 — Identify

**Goal**: Resolve user input to a concrete (stack `env`, service, primary ID).

### 1.1 Parse user input

Common input forms:

| Form | Extract |
|---|---|
| Job URL `https://connection.<host>/admin/projects/<P>/queue/<J>` | `host` → stack; `P` → projectId; `J` → jobId |
| Job ID alone | jobId only — ask user which stack |
| `inc-<NNN>` Slack channel | Open monitor link in channel; first message has Datadog monitor URL with `env` and `service` |
| Free text "X is broken on `<stack>`" | stack name → env via lookup |
| Pod name `job-<N>` | jobId = `N`, scope is job-queue |

### 1.2 Map stack → Datadog `env` tag

The Datadog `env` is NOT the same as the kbc-stacks directory name. See `references/datadog.md` table.

If the stack is unknown, run a one-time broad search to discover the `env`:
```
"<jobId>"            (no env, no service)
```
Inspect the `env` field on returned logs.

### 1.3 Identify primary service

For a job: usually `job-queue-runner` + `job-queue-service-container` + (possibly) `job-queue-daemon-*`.
For other services: look up the Datadog `service` handle in `references/datadog.md` (full per-domain catalog), and read `c4/l3/<service>.md` in the `developer:keboola-architecture` skill for the architectural context (deployed components, inter-service edges).

### 1.4 State a one-sentence hypothesis

Before running any further query, write down what you expect to find (component error vs daemon issue vs infra). This anchors the investigation and prevents drift.

## Phase 2 — Pull logs

**Goal**: Get a chronological window of all relevant logs for the incident with minimal noise.

### 2.1 Choose time window

| Information available | Window |
|---|---|
| Exact incident time | ±10 min around it |
| "Earlier today" | last 24h, narrow by status |
| Older than 5 days | **Switch to APM (`search_datadog_spans`)** — logs may be expired |
| Unknown / suspicious only | last 7d with pattern clustering |

### 2.2 Pull the focused log set

For a job (most common case):
```
env:<env> "<jobId>"           # broad, ~10-30 results: daemon + pod + API
env:<env> kube_app_instance:<jobId>   # only the K8s pod
env:<env> pod_name:job-<jobId>        # alt — note the job-id is IN the pod_name
```

For a service-wide problem:
```
env:<env> service:<svc> status:error
search_datadog_logs(..., use_log_patterns=true, clustering_pattern_field="@error.message")
```

Always include `extra_fields=["*"]` once to discover what attributes are available. Then use those in subsequent `analyze_datadog_logs` calls via `extra_columns`.

### 2.3 If output exceeds token budget

Datadog MCP saves the full result to a file when truncated. Read it in chunks with `Read offset/limit`. **Don't re-query at a finer scope blindly** — first scan the saved file for what's there, then narrow.

## Phase 3 — Reconstruct timeline

**Goal**: A chronological per-second timeline of what happened, across all services involved.

### 3.1 Collect trace IDs

For each suspicious log row, extract:
- `timestamp`, `service`, `host`
- `trace_id`, `span_id` (when present)
- Key tags: `componentid`, `configid`, `projectid`, `pod_name`, `kube_namespace`

### 3.2 Fan out by trace_id

For each unique `trace_id`, run:
```
trace_id:<id>
```
(No env/service scope needed — trace IDs are unique.)

Order all hits across all traces by `timestamp` to get a stitched timeline.

### 3.3 Detect anomalies

Look for these tell-tale shapes:

| Shape | Hypothesis |
|---|---|
| Same event logged twice within 1s from different `service` values | Duplicate consumer / SQS redelivery / race |
| Long silence between "X started" and "X finished" + "missing" log later | Pod disappeared mid-run |
| State transition rejected (400 from internal-api) | Daemon prematurely marked terminal |
| Multiple `version` tags in same time window | Mid-deploy |
| Errors clustered around a single `host` | Node-level issue (network, disk) |
| Errors clustered around a `nodepool` | Capacity / spot interruption |

### 3.4 Write the timeline

Capture it concretely:
```
14:38:04  daemon-run    "Dispatching waiting job 993111302"  [trace A]
14:38:04  daemon-stop   "Dispatching waiting job 993111302"  [trace B]  ← duplicate
14:38:05  daemon-start  Job is starting / associated to pod  [trace A]
14:38:05  daemon-start  Job is starting / associated to pod  [trace B]  ← duplicate
14:38:06  daemon-stop   "Job is missing its task with physical ID"      ← smoking gun
14:38:11  internal-api  400 Invalid status transition (error → processing)
14:38:11  service-container  Marking job as error
14:38:13  logs-handler  Received signal terminated
```

## Phase 4 — Form a hypothesis

**Goal**: A concrete root-cause claim grounded in the timeline + architecture model.

### 4.1 Match against known patterns

If status is `error` / "Internal Error" on a component job → **read `references/internal-error.md`** and walk its decision tree (the 4 causes A/B/C/D).

For other symptoms, read the affected service's `c4/l3/<service>.md` in the `developer:keboola-architecture` skill to understand deployed components and inter-service edges, then formulate a hypothesis grounded in what could fail at each boundary.

### 4.2 Pull in architecture context

Invoke the **`developer:keboola-architecture` skill** when:
- The failure spans 2+ services and the relationship isn't obvious
- A log line implies a queue/pubsub hop ("Dispatching", "Consumer received", "Published")
- You want to assess blast radius ("if service X is failing, what else breaks?")

Concretely:
1. Read `references/c4/l3/<service>.md` for the affected service — gives deployed components and inter-service edges
2. Read `references/c4/l3/<service>-external.dsl` — gives cloud-vendor resources (KMS keys, MySQL, queues, K8s)
3. Read `references/c4/service-knowledge.md` for domain rules not visible in code

### 4.3 Quantify systemic vs one-off

For each suspected pattern, ask: **"Is this a single-job problem, or is it recurring?"** Aggregate via DDSQL:

```sql
-- extra_columns: as needed
SELECT DATE_TRUNC('hour', timestamp) AS bucket, COUNT(*) AS cnt
FROM logs
WHERE service = '<svc>' AND message LIKE '%<signature>%'
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY DATE_TRUNC('hour', timestamp) DESC
```

| Frequency | Interpretation |
|---|---|
| <10/week | One-off; advise rerun, file low-priority ticket |
| 10-100/week | Systemic but tolerable; raise with owning team |
| >100/week | Active incident or regression — page the team |

### 4.4 State the root cause

Write a single paragraph:
- What happened (mechanism, not symptom)
- Where (which service, which line in code if known)
- Why (architectural property that allowed it)
- Scope (one-off / systemic, who's affected)

## Phase 5 — Verify and report

**Goal**: Deliver actionable findings with reproducible evidence.

### 5.1 Verify

Before reporting:
- The hypothesis explains every anomaly in the timeline (no orphan log lines).
- The timeline has at least two independent evidence points (log + APM, or log + K8s event).
- Frequency claim is from `analyze_datadog_logs`, not assumed.

If anything fails verification, **return to Phase 3 or 4 with new data** — don't ship the report.

### 5.2 Reporting structure

Use this template (also in `references/internal-error.md`):

```
**Job/incident**: <id> (componentid=<c>, configid=<c>, projectid=<p>)
**Stack**: <env>
**Status**: <user-visible status>

**Root cause**: <1 sentence>

**Timeline** (UTC):
  HH:MM:SS  <service>  <event>
  ...

**Evidence**:
  - <Datadog logs explorer URL>
  - <trace_ids>
  - <K8s events / Sentry / LangSmith links if applicable>

**Impact**:
  - Data processed? <yes/no/partial>
  - State side effects? <yes/no — be specific about what>
  - Rerun safe? <yes/no with reasoning>
  - Frequency in last 7d: <count + trend>

**Recommendation**:
  - For the user: <rerun / contact support / wait>
  - For engineering: <team to escalate / specific code reference / linked Linear issue>
```

### 5.3 When the answer is "no root cause"

This is rare (~5%). It applies only if:
- The timeline has clear gaps that no log search fills (consider the 7-day retention boundary)
- The pattern is non-deterministic across many similar jobs that succeeded
- External dependencies (Snowflake / BigQuery / customer DB) are implicated but their telemetry isn't accessible

In that case, write what was investigated, what wasn't conclusive, and recommend monitoring + retry.

## Anti-patterns

Avoid these — they appear in real debug transcripts and waste tokens / time:

| Anti-pattern | Why it's bad |
|---|---|
| Pulling `status:error` for last 7d without service scope | Returns 10k+ rows, hits token limit, useless |
| Trusting `env` to match the kbc-stacks dir name | They differ (`connection.eu-central-1.keboola.com` → `kbc-eu-central-1`); always verify |
| Re-running broad searches at finer scope without reading the previous output | The truncated file already has the answer |
| Skipping the architecture skill when log shows "X published to Y" | The C4 model tells you which other service consumes — direct path to the next layer |
| Reporting "race condition in daemon" without naming the queue + service edge | Vague; engineering can't act on it |
| Marking "Internal Error" as user error without walking the decision tree | 3 of 4 root causes are platform issues, not user issues |
| Reading `sops -d <secrets.yaml>` to "check config" without piping to `\| yq 'keys'` | Leaks decrypted secrets into the transcript (see ~/.claude/CLAUDE.md) |

## Related skills

See **Prerequisites** above for a categorized list with marketplace sources. In short: `developer:keboola-architecture` is bundled and used in Phase 4.2; `superpowers:systematic-debugging` is the broader debugging framework; everything else is incident-type-specific Keboola SRE tooling that this skill defers to when the scope warrants it.
