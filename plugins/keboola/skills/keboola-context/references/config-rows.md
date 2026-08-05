# Config Rows — Platform Behaviour

## How configRows work at runtime

When a component has configRows enabled, the platform merges each row's `parameters`
with the root configuration's `parameters` before passing the combined config to the
job runner. Each row produces one merged config object.

If **parallelism** is enabled, the platform spins up multiple identical container
instances simultaneously — one per row — each receiving its own merged config. The
containers are the same image; only the config differs.

**State is per-row.** The platform injects the state file scoped to each row into
its container. There is no shared state across rows.

## How to recognise a row-based component

The presence of a non-empty `configurationRowSchema.json` in the `component_config/`
directory means the component uses configRows.

## Implications for tests (VCR / datadir)

Because the platform handles the merge, the component code itself always receives
a single, already-merged config. Test fixtures should reflect this:

- `config.json` in test data directories contains only `parameters` at the root level —
  the same shape the component receives after the platform merge.
- There is no need to replicate row vs. root splitting in test fixtures; that split
  is a platform concern, not a component concern.
- State files in test fixtures are row-scoped (one state file per test case),
  consistent with how the platform injects per-row state.
