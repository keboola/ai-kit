---
name: job-error-triage
description: >
  A disciplined triage loop for a SINGLE Keboola job, deploy, or config-write failure that
  replaces firing multiple speculative config writes. Use when a job failed, a config write
  was rejected or errored, a deploy failed, or the user says "resolve this job error",
  "fix this failed job", "job ID … failed", "the config update didn't work", or
  "this flow won't run". Enforces read the error log first, one root-cause diagnosis, one
  proposed config diff, one gated write, then verify the change actually applied before
  reporting success. Use when tempted to retry different writes hoping one sticks, or when a
  write timed out, was declined, or returned silently. NOT for authoring new configs from
  scratch or bulk multi-item edits.
version: 1.0.0
---

# Job / Config Error Triage

A disciplined loop for resolving a **single** job, deploy, or config-write failure on the
Keboola platform. It replaces the failure mode of firing several speculative config writes in
a row and hoping one sticks. You read the actual error, diagnose one root cause, propose one
concrete diff, make one gated write, and verify it applied before you ever say "Done".

## The core rule (unmissable)

**ONE failure → ONE diagnosis → ONE proposed diff → ONE gated write → verify it applied.**

- Never fan out multiple speculative writes.
- Never retry a failed write with a *different* write hoping one lands.
- Never report "Done", "Fixed", or "Applied" until verification (step 5) confirms the change is live.

## When to use

- A job failed (`get_job` shows an error) and the user wants it resolved.
- A config write was rejected, errored, or silently did nothing.
- A deploy failed.
- A "Resolve this job error / Job ID: …" request.

## When NOT to use

- Authoring a brand-new config from scratch — that is a build task, not triage.
- Bulk / multi-item changes (e.g. "standardize all titles and descriptions"). Those need their
  own **halt-on-repeated-failure** discipline: process items one at a time, and if writes start
  erroring, STOP and summarize what failed instead of plowing through the batch.
- Debugging component *source code* — use the `component-developer:debug-component` skill. This
  skill is about live config/job write discipline, not component internals.

## The loop

### 1. Read the job / error log first

Fetch the actual failure detail before theorizing. Use the real read tool — `get_job` for the
job detail and error message, `list_jobs` to locate the failed job if you only have a
component/config, `get_config` to inspect the current configuration. Do **not** guess the cause
from the symptom. **Quote the actual error text** in your reasoning and your report.

### 2. Diagnose the root cause

From the log, name the **specific** parameter, field, or storage mapping at fault — not a vague
category. "The `bucket` in `storage.input.tables[0].source` points at a deleted table" is a
diagnosis; "storage problem" is not.

### 3. Propose exactly ONE config diff

Show the concrete **before → after** — the specific keys that change and their old and new
values. If you cannot identify a *single confident* fix, **STOP**: report the diagnosis and
exactly what is ambiguous, and ask how to proceed. Do not write speculatively to "see if it
works".

### 4. Make a SINGLE gated write

Show the diff and get **explicit user confirmation before writing** (consistent with how the
other Keboola skills gate writes — always show the diff and confirm first). Then make **one**
write call with the appropriate write tool for the target (examples: `update_config`,
`update_sql_transformation`, `modify_flow`). One call — do not batch, do not fan out.

### 5. Verify the write actually applied

Re-read the config with `get_config` (or re-run and check the resulting job with `run_job` /
`get_job`) and confirm the changed keys are present with their new values. **Only then** report
"Done". Verification — not the absence of an error — is what confirms success.

## Failure handling / stop conditions

This is the heart of the skill.

- **The write errors or is rejected** → STOP. Do not immediately try a different write. Report
  exactly what failed and the raw error text.
- **The write's approval times out or is declined** → the change did **NOT** apply. Report that
  explicitly. Never claim "Done" on an unconfirmed write.
- **A silent or empty success response** → treat as *unverified*. Run step 5 before concluding
  anything. The lack of an error is not proof the write landed.
- **Never** report "Done" / "Fixed" / "Applied" until step 5 has confirmed the change is live.

## Anti-patterns

- Firing multiple config writes after the first one fails, hoping one sticks.
- Reporting success on a write whose approval timed out or was declined.
- Ignoring a silent `modify_flow` (or other write) failure and continuing as if it worked.
- Bulk-writing many items without halting when writes start erroring — e.g. sending 32 writes,
  7 error, and never stopping or summarizing the failures.
- Guessing the cause from the symptom instead of reading the actual job log.

## Output format

Report every triage using this template:

```
Job / write that failed: <job ID or write target>
Root cause:               <specific parameter / field / mapping, with the quoted error>
Proposed diff:            <before → after, the exact keys changing>
Write result:             <applied via one write call | rejected | timed out | declined | error: "<raw error>">
Verification:             <re-read confirms new value present | NOT applied — change is not live>
```

If you stopped before writing (ambiguous fix, repeated failures), say so plainly and list what
is blocking a confident single fix.

## Related

- `component-developer:debug-component` — deep debugging of component source code, logs, and
  local reproduction. Use it when the root cause is in the component's code rather than in a
  config value or mapping you can fix with a single gated write.
