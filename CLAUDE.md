# Claude Code Instructions

## Plugin Development

When adding new commands, agents, or skills to a plugin:
1. Update the plugin's README.md with documentation
2. Bump the version in the plugin's `.claude-plugin/plugin.json`
3. Bump the version in `.claude-plugin/marketplace.json` for the corresponding plugin entry
4. Update the root README.md feature list for the affected plugin (add/remove items from the list)

Steps 2-3 apply to plugins under `plugins/` only. External plugins are exempt — see below.

## External plugins

A marketplace entry whose `source` is an object (not a `./plugins/<name>` string)
is published here but lives in another repo:

```json
{
  "name": "kbagent",
  "description": "...",
  "version": "0.86.0",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/keboola/cli.git",
    "path": "plugins/kbagent",
    "ref": "v0.86.0"
  },
  "category": "development"
}
```

- `version` and `source.ref` are owned by the source repo's release job. **Never
  hand-bump them** — the release job opens the PR that moves both together.
- There is no `plugins/<name>/` directory and no local `plugin.json` to keep in
  sync, so the Tier 0 manifest lint skips these entries (except for a check that
  the `source` object itself is well formed).
- `bump-version.sh` skips them: it bumps the marketplace's own `version` and the
  entries with a string `source`, and leaves external entries alone.
- Keep `ref` on a release tag, never a branch — the pin is what makes installs
  reproducible.

## Skill Script Path Conventions

- Scripts must detect their own location using `SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"` and derive `SKILL_DIR="$(dirname "$SCRIPT_DIR")"`
- Scripts run from the user's **project root**, never from the skill directory
- SKILL.md must include a "Working Directory Context" section stating this clearly
- Scripts that need a git repo should validate with `git rev-parse --is-inside-work-tree`
