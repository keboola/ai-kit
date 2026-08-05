---
name: kbc-pull
description: Pull Keboola project configurations from remote to local directory
allowed-tools:
  - Bash
  - Read
  - Glob
argument-hint: "[--force] [--dry-run]"
---

# Pull Keboola Configurations

Sync configurations from the remote Keboola project to the local directory.

## Before Running

1. Verify `.keboola/manifest.json` exists (project is initialized)
2. Check if `.env.local` exists with the API token
3. If not initialized, suggest running `/kbc-init` first

## Execute Pull

Run the pull command:

```bash
kbc pull
```

Common flags:
- `--force` - Overwrite local changes without confirmation
- `--dry-run` - Show what would be pulled without making changes

## What Gets Pulled

The command syncs:
- Component configurations (extractors, writers, transformations)
- Configuration rows
- Variables and shared code
- Schedules
- Orchestrations
- Branch-specific configurations

## Post-Pull

After successful pull:
1. Show summary of what was pulled/updated
2. List any new configurations
3. If there were local changes that got overwritten, mention them

## Error Handling

- If not initialized: Direct to `/kbc-init`
- If token expired: Explain how to update token in `.env.local`
- If network error: Suggest checking connection and retrying
