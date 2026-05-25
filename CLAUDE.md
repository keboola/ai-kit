# Claude Code Instructions

## Plugin Development

When adding new commands, agents, or skills to a plugin:
1. Update the plugin's README.md with documentation
2. Bump the version in the plugin's `.claude-plugin/plugin.json`
3. Bump the version in `.claude-plugin/marketplace.json` for the corresponding plugin entry
4. Update the root README.md feature list for the affected plugin (add/remove items from the list)

## Skills

### Skills Workflow

- When creating or modifying skills in the AI kit, remember publishing requires a version bump in the skill manifest. Don't rename skills without explicit user approval.

### Script Path Conventions

- Scripts must detect their own location using `SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"` and derive `SKILL_DIR="$(dirname "$SCRIPT_DIR")"`
- Scripts run from the user's **project root**, never from the skill directory
- SKILL.md must include a "Working Directory Context" section stating this clearly
- Scripts that need a git repo should validate with `git rev-parse --is-inside-work-tree`
