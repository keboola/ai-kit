# Claude Code Instructions

## Plugin Development

This repo ships a **single** plugin, `keboola` (at `plugins/keboola`), whose
skills are grouped by area (components, data apps, CLI, git, powerbi, semantic
layer). Skills live flat under `skills/<skill-name>/SKILL.md` — the grouping is
documentation in the READMEs, not directory nesting.

When adding new commands, agents, or skills to the plugin:
1. Add the skill under `plugins/keboola/skills/<skill-name>/` (its `name:` frontmatter must equal the directory name), command under `commands/`, or agent under `agents/`
2. Update `plugins/keboola/README.md`, filing the new item under the right area
3. Bump the version in `plugins/keboola/.claude-plugin/plugin.json`
4. Bump the `keboola` plugin entry's version in `.claude-plugin/marketplace.json` (and the marketplace's own `version` if the change is breaking)
5. Update the root `README.md` area list

## Skill Script Path Conventions

- Scripts must detect their own location using `SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"` and derive `SKILL_DIR="$(dirname "$SCRIPT_DIR")"`
- Scripts run from the user's **project root**, never from the skill directory
- SKILL.md must include a "Working Directory Context" section stating this clearly
- Scripts that need a git repo should validate with `git rev-parse --is-inside-work-tree`
