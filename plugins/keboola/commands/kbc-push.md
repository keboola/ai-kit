---
name: kbc-push
description: Push local Keboola configuration changes to remote project
allowed-tools:
  - Bash
  - Read
  - Glob
  - AskUserQuestion
argument-hint: "[--force] [--dry-run]"
---

# Push Keboola Configurations

Sync local configuration changes to the remote Keboola project.

## Before Running

1. Verify project is initialized (`.keboola/manifest.json` exists)
2. Run `kbc diff` first to show what will be pushed
3. Get user confirmation before pushing (unless --force)

## Show Diff First

Always show the diff before pushing:

```bash
kbc diff
```

This shows:
- New configurations to be created
- Modified configurations
- Deleted configurations

## Execute Push

After user confirms, run:

```bash
kbc push
```

Common flags:
- `--force` - Push without confirmation prompts
- `--dry-run` - Show what would be pushed without making changes

## What Gets Pushed

The command syncs:
- New and modified component configurations
- Configuration row changes
- Variable updates
- Shared code changes
- Schedule modifications
- Orchestration updates

## Post-Push

After successful push:
1. Confirm changes were applied
2. Show summary of created/updated/deleted items
3. Suggest running `/kbc-pull` to sync any server-side changes

## Error Handling

- If validation fails: Show validation errors and suggest fixes
- If conflict detected: Explain the conflict and options to resolve
- If permissions error: Check token has write permissions
- If not initialized: Direct to `/kbc-init`

## Safety

Always show diff and get confirmation before pushing destructive changes (deletions).
