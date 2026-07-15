---
name: kbc-diff
description: Show differences between local Keboola configurations and remote project
allowed-tools:
  - Bash
  - Read
argument-hint: ""
---

# Show Keboola Configuration Differences

Compare local configuration files with the remote Keboola project state.

## Before Running

1. Verify project is initialized (`.keboola/manifest.json` exists)
2. Ensure `.env.local` has valid API token

## Execute Diff

Run the diff command:

```bash
kbc diff
```

## Understanding Output

The diff shows:
- **+ (green)**: New local configurations not in remote
- **- (red)**: Remote configurations deleted locally
- **~ (yellow)**: Modified configurations

Categories shown:
- Branches
- Component configurations
- Configuration rows
- Variables
- Shared code
- Schedules
- Orchestrations

## After Showing Diff

Explain what the differences mean:
1. Summarize the changes in plain language
2. If there are changes, ask if user wants to:
   - Push changes to remote (`/kbc-push`)
   - Pull to overwrite local (`/kbc-pull --force`)
   - Review specific changed files

## Error Handling

- If not initialized: Direct to `/kbc-init`
- If token expired: Explain how to update token
- If no differences: Confirm local and remote are in sync
