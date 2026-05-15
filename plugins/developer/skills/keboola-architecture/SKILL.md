---
name: keboola-architecture
description: >
  Use when answering impact analysis, service dependency, or platform topology questions
  about Keboola — "if service X is down, what breaks?", "if I change service X's API, who
  needs to update?", "what does Y depend on?", "which cloud services does Z use?". Also use
  when reviewing changes to inter-service contracts, planning a new service, or onboarding
  to an unfamiliar Keboola service. Contains a snapshot of the C4 architecture model for
  the Keboola platform (Structurizr DSL + findings reports).
---

# Keboola Platform Architecture (C4)

A snapshot of the Keboola platform's C4 architecture model. Use it to answer impact analysis,
dependency, and topology questions without scanning the source code of every service.

The model uses three C4 levels:
- **L1** — software systems Keboola interacts with (platforms, satellites, cloud vendors)
- **L2** — independently deployed containers (services) inside the Keboola platform
- **L3** — components inside a container plus its inter-service and cloud-vendor edges

## Source of truth and freshness

The authoritative content lives in `keboola/platform-architecture-and-concepts`, folders
**`c4/` and `c4-docs/` ONLY** — every other folder in that repo (`apis/`, `clients/`,
`concepts/`, `services/`) and the root `README.md` are **obsolete** and must be ignored.

This skill ships a **point-in-time snapshot** under `references/`. For verification of edge
cases or when the answer is uncertain, fetch the current version with
`./scripts/sync.sh` (requires `gh` auth with access to the private repo).

## When to read which file

| Question | File |
|---|---|
| Outbound dependencies of service X | `references/c4/l3/<X>.dsl` (inter-service) + `references/c4/l3/<X>-external.dsl` (cloud) |
| Who calls service X (inbound) | grep `c4/l3/*.dsl` for X's component IDs — inbound edges live in the **caller's** file |
| Human-readable findings for service X | `references/c4/l3/<X>.md` |
| Full container inventory | `references/c4/l2/containers.dsl` and `references/c4/list of services.md` |
| Top-level systems + personas | `references/c4/model/model.dsl` |
| Domain rules that can't be inferred from code | `references/c4/service-knowledge.md` |
| Methodology, level rules, design decisions | `references/c4-docs/c4-approach.md` |
| Granular cloud-vendor services + IDs | `references/c4/l3/cloud-resources.dsl` |
| Views and styles | `references/c4/views/views.dsl` |

Start with `references/c4-docs/c4-approach.md` if the question is *how* the model is
structured rather than *what* it contains.

## Caveats (read before drawing conclusions)

- **Idealized model.** Each service shows relationships to **all** cloud variants it
  supports, even though a given stack uses only one cloud at a time. Impact analysis is
  therefore also idealized — real impact on any single stack may be smaller.
- **One-directional scanning.** The model is built by scanning each service's outbound
  deps. Inbound edges become reliable only after the calling service has been scanned.
  Check the "Current Status" table in `c4-approach.md` for coverage gaps.
- **No deployment-time mechanisms.** Helm hooks, migration Jobs, and schema seeders are
  intentionally omitted.
- **Shared infrastructure ≠ shared resource.** A shared node (Service Bus, KMS, database)
  on the diagram does not imply shared queues/keys/schemas — the edge label is what
  matters.
- **L2 hides cloud vendors.** Cloud dependencies appear at L1 (aggregated) and L3
  (granular), never at L2. "Runs on Kubernetes" is implicit everywhere.

## Working directory context

Scripts in this skill auto-detect their own location. The user is in **their project
root** when invoking the skill — do not `cd` into the skill directory. Use absolute paths
or `$SKILL_DIR`-relative paths when reading `references/`.

## Updating the snapshot

```bash
./scripts/sync.sh         # pulls latest c4/ and c4-docs/c4-approach.md from the upstream
                          # repo via `gh` and overwrites references/. Requires gh auth.
```

The snapshot drifts from upstream over time. If a question hinges on a recently changed
service edge, re-run `sync.sh` before answering.
