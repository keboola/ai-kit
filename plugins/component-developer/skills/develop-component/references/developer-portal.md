# Developer Portal Registration

Complete guide for registering Keboola components in the Developer Portal via API.

## Overview

All Keboola components must be registered in the Developer Portal before they can be deployed and used. This guide covers the programmatic registration process using curl commands.

**IMPORTANT**: Always use curl commands for registration. Never use a web browser for this process.

## Prerequisites

Before registering a component:

1. **Repository Setup**: Create a GitHub repository with branch `main` (not prefixed with `devin/` or similar)
2. **Initial Commit**: Commit at least a simple README.md to the repository
3. **Credentials**: Have Developer Portal credentials ready:
   - Username (e.g., `CF_DEVELOPER_PORTAL_DEVIN_USERNAME`)
   - Password (e.g., `CF_DEVELOPER_PORTAL_DEVIN_PASSWORD`)

## API Endpoints

The Developer Portal API is available at: `https://apps-api.keboola.com`

### Authentication

First, obtain an authentication token:

```bash
# Login to get authentication token
curl -X POST "https://apps-api.keboola.com/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$CF_DEVELOPER_PORTAL_DEVIN_USERNAME'",
    "password": "'$CF_DEVELOPER_PORTAL_DEVIN_PASSWORD'"
  }'
```

The response contains a `token` field valid for 1 hour. Use this token in subsequent requests.

### Register New Component

```bash
# Create new app/component
curl -X POST "https://apps-api.keboola.com/vendors/{vendor}/apps" \
  -H "Content-Type: application/json" \
  -H "Authorization: {token}" \
  -d '{
    "id": "component-name",
    "name": "Component Display Name",
    "type": "extractor",
    "shortDescription": "Brief description of the component",
    "longDescription": "Detailed markdown description",
    "repository": {
      "type": "github",
      "uri": "https://github.com/keboola/component-name"
    }
  }'
```

## Component ID Format

- Component ID is prefixed with vendor name automatically
- Input: `my-component` → Output: `keboola.my-component`
- **Never include** words like 'extractor', 'writer', or 'application' in the component name itself
- Use lowercase letters, numbers, and hyphens only
- Length should be between 3 and 30 characters

## Component Types

Valid component types:
- `extractor` - Pulls data from external sources into Keboola
- `writer` - Pushes data from Keboola to external destinations
- `application` - Processes data within Keboola
- `processor` - Transforms data in pipelines

## Registration Workflow

### Step 1: Prepare Repository

```bash
# Create and checkout main branch
git checkout -b main

# Create initial README
echo "# component-name" > README.md
git add README.md
git commit -m "Initial commit"
git push -u origin main
```

### Step 2: Get Authentication Token

```bash
# Store credentials (use environment variables)
export PORTAL_USER="$CF_DEVELOPER_PORTAL_DEVIN_USERNAME"
export PORTAL_PASS="$CF_DEVELOPER_PORTAL_DEVIN_PASSWORD"

# Get token
TOKEN=$(curl -s -X POST "https://apps-api.keboola.com/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$PORTAL_USER\", \"password\": \"$PORTAL_PASS\"}" \
  | jq -r '.token')

echo "Token obtained: ${TOKEN:0:20}..."
```

### Step 3: Register Component

```bash
# Register the component
curl -X POST "https://apps-api.keboola.com/vendors/keboola/apps" \
  -H "Content-Type: application/json" \
  -H "Authorization: $TOKEN" \
  -d '{
    "id": "ex-my-api",
    "name": "My API Extractor",
    "type": "extractor",
    "shortDescription": "Extracts data from My API",
    "longDescription": "# My API Extractor\n\nThis component extracts data from My API service.",
    "repository": {
      "type": "github",
      "uri": "https://github.com/keboola/ex-my-api"
    }
  }'
```

### Step 4: Verify Registration

```bash
# Get component details
curl -X GET "https://apps-api.keboola.com/vendors/keboola/apps/ex-my-api" \
  -H "Authorization: $TOKEN"
```

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Component identifier (3-30 chars, lowercase, hyphens allowed) |
| `name` | string | Display name (no 'extractor', 'writer', 'application' suffix) |
| `type` | object | Component type with `id` field |
| `shortDescription` | string | One sentence description |
| `longDescription` | string | Markdown formatted detailed description |
| `repository` | object | GitHub repository information |

## After Registration

Once registered, proceed with:

1. **Generate Component Structure**: Use cookiecutter template
   ```bash
   cookiecutter gh:keboola/cookiecutter-python-component
   ```

2. **Configure CI/CD Secrets** (as the LAST step):
   - `KBC_DEVELOPERPORTAL_USERNAME`
   - `KBC_DEVELOPERPORTAL_PASSWORD`
   - `KBC_DEVELOPERPORTAL_APP` - full component ID with vendor prefix
   - `KBC_STORAGE_TOKEN` - for testing

3. **Deploy**: Tag releases with semantic versioning (`v1.0.0`)

## Common Issues

### Token Expired
Tokens are valid for 1 hour. If you get authentication errors, obtain a new token.

### Component Already Exists
If the component ID is taken, choose a different ID or check if you're updating an existing component.

### Invalid Component Name
Ensure the name doesn't contain restricted words ('extractor', 'writer', 'application') and follows the character restrictions.

## Related Guides

- [Initialization Guide](initialization-guide.md) - Setting up component structure
- [Architecture Guide](architecture.md) - Component patterns and best practices
- [Debugging Guide](debugging.md) - Troubleshooting component issues
