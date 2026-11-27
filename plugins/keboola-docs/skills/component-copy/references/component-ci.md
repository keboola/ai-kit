# Component copy rules in a component's own CI

The cheapest way to keep component copy right is to check it where it is written: in the
component repo, on every pull request. `scripts/lint-copy.mjs` is one file with no
dependencies beyond Node, so the CI can carry a copy of it.

This is a proposal for the Component Factory owner. Nothing here changes `keboola/component-ci`
or any component repo by itself.

## The step

Vendor `lint-copy.mjs` into the shared CI (for example `keboola/component-ci` at
`scripts/lint-copy.mjs`) and add one step to the PR workflow:

```yaml
- name: Component copy rules
  # Report only at first: 370 of 398 public components fail at least one house rule today.
  continue-on-error: true
  run: node scripts/lint-copy.mjs component_config --full --connector --readme README.md
```

- `--full`: the directory is a complete `component_config/`, so an absent required file is a
  finding.
- `--connector`: extractors and writers get the connector rules (a load-behaviour line in the
  long description, the `## Prerequisites` section in the README). Drop it for applications,
  processors and transformations. The repo does not know its catalog bucket; the component type
  is enough for CI.
- `--readme README.md`: the repo's README, for the Prerequisites rule.
- Without `--schemas`, schema problems are warnings, so a copy rule never blocks a code change
  through an old schema quirk.

Node 20 or newer. Exit 1 on an error, 0 otherwise; every finding names the rule it came from.

## Rollout

1. **Report only** (`continue-on-error: true`) on all repos. Findings show in the PR checks;
   nothing blocks.
2. **Enforce for new components**: a repo created after the cut-off date runs without
   `continue-on-error`. New components start right, which is the long-term goal of PRDCT-586.
3. **Enforce everywhere** once the fleet audit (`scripts/audit.mjs`) shows the backlog is
   fixed.

## Keeping the two copies in step

The plugin's `lint-copy.mjs` is the source. When its rules change, the CI copy is updated in
the same release, and the plugin CHANGELOG says so.
