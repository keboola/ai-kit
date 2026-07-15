---
name: kbc-init
description: Initialize a new Keboola project in the current directory
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
argument-hint: "[directory]"
---

# Initialize Keboola Project

Initialize a new Keboola project locally using the Keboola CLI.

## Before Running

1. Check if kbc CLI is installed: `kbc --version`
2. Check if current directory already has a `.keboola` folder
3. If directory argument provided, use that; otherwise use current directory

## Gather Required Information

Ask the user for:
1. **Keboola Host** - The Keboola connection URL (e.g., connection.keboola.com, connection.eu-central-1.keboola.com)
2. **Storage API Token** - Master token for authentication (will be stored in .env.local)

## Run Initialization

Execute the init command:

```bash
kbc init --storage-api-host <host>
```

The command will:
- Prompt for the API token interactively
- Create `.keboola/manifest.json`
- Create `.env.local` with the token
- Create `.env.dist` as a template
- Create `.gitignore` for sensitive files
- Pull all configurations from the project

## Post-Init

After successful initialization:
1. Confirm the project structure was created
2. List the branches and configurations pulled
3. Remind user that `.env.local` contains sensitive token - never commit it

## Error Handling

- If kbc not found: Suggest installation from https://developers.keboola.com/cli/
- If directory not empty with existing .keboola: Ask if user wants to reinitialize
- If token invalid: Explain how to get a valid Master token from Keboola UI
