---
marp: true
theme: default
paginate: true
style: |
  section {
    font-family: 'Segoe UI', sans-serif;
    font-size: 1.1em;
  }
  h1 { color: #1a5276; border-bottom: 2px solid #1a5276; padding-bottom: 0.2em; }
  h2 { color: #2e86c1; }
  code { background: #eaf2ff; padding: 0.1em 0.4em; border-radius: 3px; }
  table { font-size: 0.85em; }
  th { background: #2e86c1; color: white; }
  tr:nth-child(even) { background: #f0f7ff; }
---

# Keboola Platform
## C4 Architecture Model

Approach and decisions

---

## Why?

The platform is **26+ independently deployed services**. Without documentation,
answering questions requires digging through code or relying on tribal knowledge.

**Primary goal: impact analysis — of two kinds:**

- **Operational impact** — if the Storage API is down, what breaks? Who can't log in?
- **Development impact** — if I change the Queue API contract, which services need to be updated? Which teams do I need to talk to?

Both kinds of questions should be answerable from the diagram, not from memory.

---

## What is C4?

C4 is a set of **hierarchical abstractions** for describing software architecture.
Each level zooms in on the previous one.

| Element | Definition |
|---|---|
| **Person** | A human role or actor that interacts with the system (one person can play multiple roles). **An AI agent is not a Person** — it's a tool a Person uses. |
| **Software System** | The highest level of abstraction — something that delivers value to a person |
| **Container** | An independently deployable unit within a system (process, service, database, etc.) |
| **Component** | A grouping of related functionality within a container (e.g. a Deployment, a CronJob) |

The notation is intentionally **technology-agnostic** — a Container can be a PHP service,
a Go binary, a Kubernetes CronJob, or a managed cloud database.

---

## C4 Levels

| Level | View | Question answered |
|---|---|---|
| **L1** | System Context | Who uses the system and what external systems does it interact with? |
| **L2** | Container | What independently deployable units make up the system? |
| **L3** | Component | What runs inside a single container and how does it connect to other things? |

Each level is a separate diagram. Readers navigate from the big picture down to the
detail they need — no single diagram tries to show everything.

---

## Domain Services, Not Microservices

Keboola services are **domain services** — larger than microservices, each owning
its own database and cloud resources, but smaller than a monolith.

This shapes how C4 levels are applied:

- **One L2 box per functional domain** — even if the domain spans multiple repos
  (e.g. `queue` = job-queue + job-queue-daemon + runner)
- **L3 exposes internal structure** — async workers, REST APIs, and cron jobs
  are separate components because they have different dependencies and failure modes
- **Connection (SAPI) is decomposed** into three API surfaces — Storage API, Manage API, and PAYG API — even though they deploy as one container

---

## The Core Decision: Levels of Detail

The temptation is to show **every relationship at every level** — but that adds
enormous noise:

- **Human readers** of cluttered diagrams will simply stop looking
- **AI readers** (LLMs consuming the DSL) waste context on irrelevant edges — and produce worse impact analysis as a result

The hardest question in C4 for a platform like Keboola:
**where do cloud dependencies belong?**

| Level | Contains | Excludes |
|---|---|---|
| **L1** | Platform systems, satellite systems, cloud vendors (aggregated) | Internal service detail |
| **L2** | Platform containers and their inter-service relationships | Cloud vendor services |
| **L3** | Internal components (API, workers, cron jobs), granular cloud services | — |

Every service depends on cloud infrastructure — showing it at L2 would clutter
every diagram with the same boxes and hide the actual service relationships.
At L3, cloud dependencies are scoped to the specific component that uses them.

---

## Idealized Model

The model is intentionally **idealized**: each service shows relationships to all cloud
variants it supports, even though each deployed stack uses only one cloud at a time.

This makes the diagrams independent of which specific stack is being examined and shows
the full dependency surface of the service — useful for architectural analysis and
onboarding.

**Consequence: impact analysis is also idealized.** The diagram shows which services
*could* be affected by a change; the real impact on any given stack may be smaller.
For example, "Billing is down" has no effect on a stack that doesn't deploy Billing
at all. Narrowing idealized impact down to per-stack reality is future work.

---

## Why C4? Why Structurizr DSL?

Alternatives considered:

| Option | Why not chosen |
|---|---|
| Informal box-and-arrow (Mermaid/PlantUML) | No enforced structure — every diagram ends up different |
| UML component diagrams | Precise but doesn't prescribe *what* to draw or *for whom* |
| Arc42 | Good documentation framework, but doesn't define diagram structure |
| Service graph (Backstage) | Better for runtime data; requires tooling adoption across teams |

**C4 + Structurizr DSL was chosen because:**

- Enforces a consistent four-level hierarchy — structure separate from notation
- **Plain text** → stored in Git, reviewed in PRs, diffable like code
- **`!include`** → model split into per-service files; adding a service doesn't touch existing ones
- **Single model, multiple views** → relationships defined once, rendered in L1/L2/L3 views
- **Model validation** → the DSL compiler finds *dangling relations* (references to undefined elements), so inconsistencies surface at build time rather than going undetected in freeform diagrams

Mermaid sequence diagrams complement the C4 model for **specific flow documentation**
(job execution, workspace creation) where communication order matters.

---

## L1: Software Systems

L1 shows **everything the platform interacts with as a peer**: the platform itself,
satellite systems we own, and vendors we depend on.

| System | Role |
|---|---|
| **Keboola Platform** | The main system — all core services |
| **Developer Portal** | Satellite — component developer tooling |
| **Telemetry** | Satellite — built on platform, drives billing |

**Cloud vendors appear at L1 as any other external vendor we depend on** — `aws`,
`azure`, `gcp`, `snowflake`, alongside Stripe, SendGrid, etc. They are peer systems
at the context level, and only excluded from L2 (see next slide).

---

## Why Cloud Vendors Are Excluded from L2

Every service depends on whichever cloud the stack runs on. Showing all cloud vendor
nodes at L2 would clutter every diagram with the same three boxes and obscure the
actual inter-service relationships.

**Decision:**
- Cloud vendors appear at **L1** (as any other vendor we depend on — see previous slide)
- Cloud vendors are **excluded from L2** — "depends on cloud" is true for everything
- At **L3**, granular vendor services appear (`aws-kms`, `azure-service-bus`, etc.) — but only in the component view of the service that uses them

The same reasoning excludes the **"runs on AKS/EKS/GKE"** relationship:
every container runs on a managed Kubernetes service — it's true for everything
and therefore informative for nothing. **Kubernetes is implicit only for the "runs on"
relationship.** Where Kubernetes is used *differently* — e.g. `queue` using the
Kubernetes API to spawn job runners — it is modelled explicitly.

---

## Satellite Systems

Not every system we own belongs inside `keboolaPlatform`. A **satellite system** is
one that is so loosely coupled it doesn't belong to the main system — but it's ours.

How to identify a satellite:

- **Different personas and auth boundaries** — it's used by a distinct audience (component developers, internal ops) rather than by project users
- **Independent lifecycle** — it can be deployed, versioned, or taken down without affecting the platform
- **Only integration is at the edges** — it calls the platform like any external client would, or the platform calls it at well-defined touchpoints

Current satellites: **Developer Portal** (component developer tooling, separate auth)
and **Telemetry** (built on top of the platform, feeds billing).

If a candidate system fails these tests, it probably belongs *inside* `keboolaPlatform`
as a container, not as a peer system.

---

## L2: Container Decisions

Containers map to independently deployed services or closely related service groups.

Notable grouping decisions:

- **`queue`** — four deployment groups from `job-queue` monorepo + `job-queue-daemon` repo, all in one container because they implement one logical service
- **`sandboxes`** — covers sandboxes-api, sandboxes-service, apps-proxy, keboola-operator — one product surface
- **`oauth`** — covers three parallel implementations (JS, PHP, serverless) — same function
- **`elasticsearch`** — modelled as a container *inside* `keboolaPlatform` because it is self-hosted infrastructure, not an external vendor

---

## L3: Component Rules

- **Every container has components** — even single-Deployment services. Relationships on a container ID only appear at L2; they are invisible on L3.
- **Every deployed unit is a separate component** — Deployments, CronJobs, Logstash CRDs each get their own component if they serve a distinct role.
- **Helm hook Jobs are skipped** — `helm.sh/hook: pre-install,pre-upgrade` Jobs (e.g. database migrations) run only during deployment. The core reasoning: this is an **idealized model capturing the settled state** of the platform. Deployment-time mechanisms that get us *to* that state — migrations, schema updates, config seeding — are intentionally omitted. This may prove risky later (future work).
- **Data-driven templates**: when a Helm template loops over a values list to generate many instances of the same resource, all instances collapse into **one C4 component**, named from the `tags.datadoghq.com/service` label.

---

## Tagging Scheme

Tags drive colours and filtering — not just documentation.

**Language** (one per element):
`PHP` · `Go` · `Python` · `TypeScript` · `JavaScript` · `Other`

**Status** (when relevant):

| Tag | Meaning | Style |
|---|---|---|
| `Legacy` | Predecessor being phased out | Grey, dashed border |
| `Uncommissioned` | Not yet in production | Amber, dashed border |
| `SelfHosted` | Self-hosted infrastructure | Dark grey |

**Cloud vendors:** shades of green — dark for aggregated, lighter for granular services.

---

# Tooling

---

## Structurizr DSL

The model is written in [Structurizr DSL](https://structurizr.com/) — plain text that compiles to diagrams.

```
docker run -it --rm -p 8080:8080 \
  -v "D:\Work\c4:/usr/local/structurizr" \
  structurizr/structurizr local
```

**Why Structurizr?**
- Plain text → version-controllable, diffable
- Enforces the C4 metamodel — not freeform boxes
- Multiple views derived from a single model → relationships stay consistent
- `!include` lets the model be split into per-service files

---

## File Structure

```
c4/
├── workspace.dsl               # Root entry point
├── model/model.dsl             # Personas, L1 systems, relationships
├── l2/containers.dsl           # All containers and components
├── l3/
│   ├── external-systems.dsl   # Cloud vendor systems
│   ├── <service>.dsl          # Inter-service relationships
│   ├── <service>-external.dsl # Cloud vendor relationships
│   └── <service>.md           # Findings report
├── views/views.dsl             # All views + styles
├── skills/                     # Scanning methodology
└── service-knowledge.md        # Non-detectable service rules
```

Three files per service keeps things modular — scanning a new service doesn't touch existing files.

---

# Usage

---

## How the Service List Was Constructed

The container inventory was assembled by cross-referencing four sources:

1. **GitHub repositories** — `keboola` org, filtered for actively maintained services
2. **kbc-stacks** — Helm chart directories under `apps/` reveal what is actually deployed on production stacks
3. **Infrastructure Terraform modules** — `app-<service>` modules confirm what has production cloud infrastructure
4. **API documentation** — public Swagger/Apiary docs confirm which repos expose a real service boundary

A service gets a container if it is **independently deployed** and **provides a distinct capability** to the rest of the platform. Repos that are libraries, CLI tools, or build helpers are excluded.

Multi-repo services (e.g. `oauth` has three parallel implementations) are collapsed into
one container because they serve the same function.

---

## Scanning Approach

Each service is scanned from three sources:

1. **Terraform infra_secrets** — cloud vendor dependencies
   Scan *all* `.tf` files per cloud variant, not just `main.tf`

2. **kbc-stacks Helm templates** — deployed components
   Read `values.yaml` too when templates are data-driven

3. **Service source code** — inter-service dependencies
   PHP: `config/services.yaml` (ServiceClient + class instantiation)
   Python: source scan required — URLs are sometimes derived programmatically

The methodology is encoded in skills under `c4/skills/`. **Scanning is not
self-contained** — it is a conversation with the owner of the service. The scanner
produces a first draft from source; the owner corrects domain-specific nuances the
scanner cannot infer. A key by-product of every scan is an **update to
`service-knowledge.md`**, capturing rules that cannot be detected automatically so
that the next scan of the same service starts from a better baseline.

---

## Scanning Is One-Directional

**Scanning identifies what a service *uses*, not what *calls* the service.**

This is an important consequence of how scanning works — it reads each service's own
configuration and source code to find outbound dependencies. Inbound callers are
invisible from within a single service.

This is why the model only becomes consistent **once all services are scanned**:
- Service A's scan reveals that A calls B
- That same edge is the answer to "who calls B?" — but it only exists after A has been scanned

Until the full set is covered, the "callers of X" view for any given service is
necessarily incomplete. This is a deliberate trade-off — per-service scanning keeps
each scan self-contained and reproducible, at the cost of needing full coverage
before inbound-dependency questions can be answered reliably.

---

## Shared Infrastructure ≠ Shared Dependency

![Structurizr editor L3 view showing Azure Service Bus appearing as a dependency of both Connection and editor components](editor-sqs-transitive.png)

In this L3-Editor view, **Azure Service Bus** appears connected to both `Session Worker` and `Connection`.
This is correct at the infrastructure level — but it does not mean they share the same queues.

- `Session Worker` consumes its own **session queue** (`editor_sessions`)
- `Connection` publishes and consumes entirely different queues (`main`, `commands`, `auditLog`…)

The node is correct. The relationship label is what matters — click the arrow to see which
queues are actually used. C4 intentionally abstracts away queue-level detail; if queue
ownership becomes architecturally significant, it belongs in a sequence diagram or ADR.

---

## Sample Conversation with the Scanning Agent

A realistic exchange showing how the model is iteratively refined — the agent does
a first pass from the source code, the human corrects domain-specific nuances the
scanner cannot infer:

> **Human:** In `D:\Work\c4\` there is a skill to generate C4 docs for the service `D:\Work\connection\`.
>
> **[Agent scans and produces a first-draft DSL]**
>
> **Human:** There are more backends than Snowflake. Developer Portal (apps-api) actually refers to the top-level keboola satellite system. There are certainly dependencies to other services — e.g. the queue service. The queue URL originates from `config.template.json` under `keboolaServices.queue`; at runtime it is overridden by `KEBOOLA_SERVICES__QUEUE` and injected into `Storage_Service_StackInfo`. Stripe and SendGrid also have to appear in the System Context.
>
> **[Agent updates the DSL]**
>
> **Human:** `keboolaServices` is used to populate the index response, but there is *also* an internal `JobQueueClient` dependency to the Queue service API — please triple-check there are no other internal uses of `getService`. Also, only Snowflake and BigQuery are active backends; Supabase is uncommissioned; all others are legacy. `Storage_Service_Jobs` represents "storage jobs", which are a different concept from the "component jobs" provided by the Queue service — please record that distinction in the service knowledge.
>
> **Human:** The API container actually serves three distinct APIs:
> - `connection-storage-api` — callable with a Storage token (project-scoped)
> - `connection-manage-api` — callable with a Manage token (org-scoped)
> - `connection-payg-api` — callable by Billing and UI (session/super-scoped)
>
> This should be split into three components even though it deploys as one.
>
> **[Agent splits the API container and updates service knowledge]**
>
> **Human:** Re-read the skill and service knowledge, they were updated too. Now re-iterate the connection DSL — several relationships are missing: `CronJobStorageJobPartitioning` has no edges but at least accesses the databases; token-expiration and CronJob-sync are also unconnected; Stripe is unconnected.
>
> **Human:** Worker monitoring is still unconnected — does it really have no dependencies?
>
> **Human:** Update the service knowledge to record how these dependencies are extracted.

**Takeaway:** scanning produces a first-draft model; domain expertise refines it.
Corrections are captured in `service-knowledge.md` so the next scan of the same
service starts from a better baseline.

---

## Current Status

| Container | Status |
|---|---|
| `queue` (job-queue + job-queue-daemon + job-runner) | ✅ Complete |
| `ai`, `editor`, `sync-actions`, `scheduler` | ✅ Complete |
| `encryption`, `omnisearch`, `vault` | ✅ Complete |
| `connection` (storage / manage / payg APIs) | ✅ Complete |
| `notification`, `billing`, `sandboxes` | 🟡 In progress |
| `import`, `stream`, `oauth`, `query`, `templates` | 🔲 Not yet scanned |
| `mcp-server`, `kai-assistant` | 🔲 Not yet scanned |
| `cli`, `ui`, `api` | 🔲 Not yet scanned |
| `metastore`, `skill-registry` | ⚠️ Uncommissioned |
| `elasticsearch` | — Not applicable |

---

## Future Work

- **Finish scanning** — complete coverage across all remaining containers so inbound-dependency views become reliable
- **Tackle shared resources** — KMS keys, queues, databases: decide how to model ownership vs. access vs. transitive sharing
- **Decide open questions** — e.g. DB grouping: one component per DB, or grouped by service? Component granularity for multi-tenant stores?
- **Check, check, check** — cross-validate the model against reality; hunt for dangling relations, missed dependencies, outdated edges
- **Core feature views** — sequence diagrams for key end-to-end flows (job execution, table import with triggers, workspace creation)
- **Update pipeline** — automate model drift detection: re-scan services on schedule or on PR, flag diffs for review
- **ADRs** — start capturing architectural decisions alongside the model so the *why* is preserved, not just the *what*
