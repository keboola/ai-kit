# "Internal Error" decision tree

The most common opaque failure status in Keboola. It means one of four distinct things — disambiguate before reporting.

## The 4 causes

```
                                        ┌─────────────────────────────────┐
                                        │   Job ended with "Internal      │
                                        │   Error" / "Internal Server     │
                                        │   Error occurred."              │
                                        └────────────────┬────────────────┘
                                                         │
                          ┌──────────────────────────────┼───────────────────────────────┐
                          ▼                              ▼                               ▼
              ┌───────────────────────┐    ┌────────────────────────┐     ┌──────────────────────────┐
              │ A. Pod never started  │    │ B. Pod started, daemon │     │ C. Pod started, ran, then│
              │ (FAILED_TO_START)     │    │ killed it pre-emptively│     │ component code errored   │
              │                       │    │ (race condition)       │     │ inside the container     │
              └───────────────────────┘    └────────────────────────┘     └──────────────────────────┘
                                                                                       │
                                                                                       ▼
                                                                       ┌───────────────────────────┐
                                                                       │ D. Pod disappeared mid-   │
                                                                       │ run (preempt / manual    │
                                                                       │ delete / OOM kill / node │
                                                                       │ failure)                  │
                                                                       └───────────────────────────┘
```

## Detection — run these queries in order

### Step 1: Does a pod exist at all?

```
env:<env> pod_name:job-<jobId>
```

| Result | Likely cause |
|---|---|
| **0 logs** | A. FAILED_TO_START — pod was never created. Skip to A. |
| Logs exist | B / C / D — pod started. Continue to step 2. |

### Step 2: Did service-container reach "Loading job steps" / "Marking step ..."?

```
env:<env> pod_name:job-<jobId> service:job-queue-service-container
```

Look for these markers (chronological):
- `Loading job steps from /data/config.json` — config loaded, about to run
- `Marking step "<id>"` (without "as SKIPPED") — step started
- `Step "<id>" finished` — step succeeded
- `Marking not-started step "<id>" as SKIPPED` — premature shutdown after failure
- `Marking job as error` — service-container caught a terminal error

| Pattern | Likely cause |
|---|---|
| Got `Loading job steps` then immediately `Marking job as error` + `SKIPPED` steps + 400 from `/jobs/<id>` PUT | **B. Daemon race condition** — see below. |
| Step started then errored with component output | **C. Component error** — see below. |
| Step started then silence (no `finished`, no `error`) | **D. Pod disappeared** — see below. |

### Step 3: Look for a Service container error log

```
env:<env> pod_name:job-<jobId> "Service container error"
```

The `@error.message` attribute on this log contains the real exception chain.

## A. FAILED_TO_START (pod never created)

**Signals**:
- 0 logs with `pod_name:job-<jobId>`
- `daemon-start` logs: `Failed to start job` / `K8s manifest creation failed`
- daemon-internal-api: job state is `error` with `STATUS_TERMINAL` shortly after `processing`

**Find the failure reason**:
```
env:<env> service:job-queue-daemon-start "<jobId>"
env:<env> service:job-queue-daemon-start "FAILED_TO_START"
```

**Common sub-causes**:
- K8s API throttling / quota exhaustion → check `nodepool` autoscaler logs
- Image pull failure (ECR auth, image missing) → `Failed to pull image`
- ServiceAccount / RBAC error → `forbidden`
- ResourceQuota exceeded → `exceeded quota`
- daemon restart while pod was being created → `BootStep` log in daemon-run, marks job as FAILED_TO_START

**Verify with `kubectl`** (if cluster access):
```
kubectl --context <ctx> -n job-queue-jobs get events --field-selector involvedObject.name=job-<jobId>
```

## B. Daemon race condition (pod started, but daemon marked job as error before container could update state)

**This is the "missing its task with physical ID" pattern.** A daemon-stop reconciler observed a mismatch between expected and actual K8s pod state and marked the job as `error`. The actual container then tries to `PUT /jobs/<id>` to transition to `processing`, gets HTTP 400 (`StateTerminalException`), catches the exception, marks the job as error itself (already in error), and shuts down.

**Signals** (in order):
```
env:<env> "<jobId>"
```
1. `daemon-run`: "Dispatching waiting job <id>"
2. `daemon-start`: "Job is starting" + "associated to pod" — **may appear twice from different hosts** (duplicate consumer)
3. `daemon-stop`: "Job is missing its task with physical ID" — **smoking gun**
4. `daemon-stop`: "Job has finished with status error"
5. `service-container`: "Loading job steps from /data/config.json"
6. `internal-api`: "Invalid status transition of job ... from 'error (desired: processing)' to 'processing (desired processing)'" — HTTP 400, `StateTerminalException`
7. `service-container`: "Marking job as error" / "Service container error: ... 400 Bad Request"
8. `service-container`: "Marking not-started step ... as SKIPPED" for all remaining steps

**Diagnosing further**:
- Is this systemic? Count missing-task occurrences per hour:
  ```sql
  -- analyze_datadog_logs
  SELECT DATE_TRUNC('hour', timestamp) AS bucket, COUNT(*) AS cnt
  FROM logs
  WHERE service = 'job-queue-daemon-stop'
    AND message LIKE '%is missing its task with physical ID%'
  GROUP BY DATE_TRUNC('hour', timestamp)
  ORDER BY DATE_TRUNC('hour', timestamp) DESC
  ```
- Count duplicate-dispatch shape:
  ```sql
  SELECT DATE_TRUNC('hour', timestamp) AS bucket, COUNT(*) AS dup
  FROM logs
  WHERE service = 'job-queue-daemon-stop'
    AND message LIKE 'Dispatching waiting job%'
  GROUP BY DATE_TRUNC('hour', timestamp)
  ORDER BY DATE_TRUNC('hour', timestamp) DESC
  ```

**Architectural context**: per the C4 model (`developer:keboola-architecture` skill), `daemon-run` is the only publisher to `jobs-to-start` (SQS/ServiceBus/PubSub). `daemon-stop` should only reconcile running job state. If duplicate dispatches are observed, the suspect is either SQS at-least-once redelivery (visibility timeout race) or a bug in daemon-stop publishing to the dispatch queue.

**Impact**: No data is processed. Job needs to be rerun by user. Frequency is typically ~10/week per stack — rare but visible.

## C. Component code error inside the pod

**Signals**:
- service-container logged a real step error before "Marking job as error"
- `@error.message` contains a component-level exception (not a state-transition rejection)
- Common: `Connection refused` (extractor can't reach source DB), `Authentication failed`, `Out of memory`, `Quota exceeded`, `Invalid configuration`

**Triage**:
1. Find component exception:
   ```
   env:<env> pod_name:job-<jobId> componentid:<componentid> status:(error OR critical)
   ```
2. Inspect `@error.message` and `@error.stack` for the root cause.
3. If the component is a known one (e.g. `keboola.ex-db-pgsql`), the error format is documented in component repo (`keboola/db-extractor-common`, etc.).
4. Classify per `!component_datadog_triage` playbook:
   - **A. User error** (bad credentials, invalid config) — user must fix
   - **B. App error blocking** — escalate to component team
   - **C. App error minor** — log to Linear, no escalation
   - **D. Noise** — investigate but don't escalate

## D. Pod disappeared mid-run

**Signals**:
- service-container has step-start but no step-end logs
- `daemon-stop`: "K8s Pod ... is missing" / "Pod ... was deleted"
- No explicit component error — just silence after a step
- Often correlates with: node scale-down, spot interruption, OOMKill, manual `kubectl delete`

**Triage**:
1. Check pod termination reason:
   ```
   env:<env> pod_name:job-<jobId> "terminated"
   env:<env> pod_name:job-<jobId> "OOMKilled"
   ```
2. Check node lifecycle:
   ```
   env:<env> host:<node-name-from-logs> "shutdown" OR "drained" OR "terminated"
   ```
3. Spot interruption: search EC2 ASG events or `nodepool:*-spot-*` logs around the pod death timestamp.
4. K8s events:
   ```
   kubectl --context <ctx> -n job-queue-jobs get events --field-selector involvedObject.name=job-<jobId>
   ```

## Reporting template

When sharing findings with a team, include:

```
**Job**: <jobId>  (component <componentid>, config <configid>, project <projectid>)
**Stack**: <env>
**Status**: error / "Internal Error"
**Root cause**: <A | B | C | D>
**Timeline** (UTC):
  - 14:38:04  daemon-run dispatched
  - ...
**Evidence**: <Datadog logs explorer URL>
**Trace IDs**: <comma-separated>
**Impact**: <data processed? state side effects? rerun safe?>
**Recommendation**: <user action / team escalation / no action needed>
```
