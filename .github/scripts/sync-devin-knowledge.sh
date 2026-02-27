#!/bin/bash
# Sync AI Kit SKILL.md files to Devin Knowledge entries.
#
# Requires:
#   DEVIN_API_KEY - Devin API key (Personal or Service)
#
# Each skill becomes a Knowledge entry named "ai-kit: <skill-name>".
# The script creates new entries or updates existing ones.

set -euo pipefail

API_BASE="https://api.devin.ai/v1"
PREFIX="ai-kit:"

if [ -z "${DEVIN_API_KEY:-}" ]; then
  echo "Error: DEVIN_API_KEY is not set"
  exit 1
fi

# Fetch existing knowledge entries
echo "Fetching existing Devin Knowledge entries..."
EXISTING=$(curl -sf -H "Authorization: Bearer $DEVIN_API_KEY" "$API_BASE/knowledge")

# Find all SKILL.md files
SKILL_FILES=$(find plugins -name "SKILL.md" | sort)

if [ -z "$SKILL_FILES" ]; then
  echo "No SKILL.md files found"
  exit 0
fi

SYNCED=0
ERRORS=0

for skill_file in $SKILL_FILES; do
  skill_dir=$(dirname "$skill_file")
  skill_name=$(basename "$skill_dir")
  knowledge_name="$PREFIX $skill_name"

  echo ""
  echo "Processing: $skill_file ($skill_name)"

  # Extract description from YAML frontmatter
  description=$(sed -n '/^---$/,/^---$/p' "$skill_file" \
    | grep "^description:" \
    | sed 's/^description: //' \
    | head -1)

  if [ -z "$description" ]; then
    echo "  Warning: No description found, skipping"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # Build body: SKILL.md content
  body=$(cat "$skill_file")

  # Append references if they exist
  if [ -d "$skill_dir/references" ]; then
    for ref in "$skill_dir/references"/*.md; do
      if [ -f "$ref" ]; then
        ref_name=$(basename "$ref")
        ref_content=$(cat "$ref")
        body=$(printf '%s\n\n---\n\n## Reference: %s\n\n%s' "$body" "$ref_name" "$ref_content")
      fi
    done
  fi

  # Truncate body if too large (Devin Knowledge works best with focused content)
  body_length=${#body}
  if [ "$body_length" -gt 50000 ]; then
    echo "  Warning: Body is ${body_length} chars, truncating to 50000"
    body="${body:0:50000}"
  fi

  # Check if entry already exists
  existing_id=$(echo "$EXISTING" | jq -r --arg name "$knowledge_name" \
    '.knowledge[] | select(.name == $name) | .id' 2>/dev/null || echo "")

  # Build JSON payload
  payload=$(jq -n \
    --arg body "$body" \
    --arg name "$knowledge_name" \
    --arg trigger "$description" \
    '{body: $body, name: $name, trigger_description: $trigger}')

  if [ -n "$existing_id" ]; then
    # Update existing entry
    echo "  Updating existing entry: $existing_id"
    response=$(curl -sf -X PUT "$API_BASE/knowledge/$existing_id" \
      -H "Authorization: Bearer $DEVIN_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$payload" 2>&1) || {
      echo "  Error updating: $response"
      ERRORS=$((ERRORS + 1))
      continue
    }
  else
    # Create new entry
    echo "  Creating new entry"
    response=$(curl -sf -X POST "$API_BASE/knowledge" \
      -H "Authorization: Bearer $DEVIN_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$payload" 2>&1) || {
      echo "  Error creating: $response"
      ERRORS=$((ERRORS + 1))
      continue
    }
  fi

  SYNCED=$((SYNCED + 1))
  echo "  Done"
done

echo ""
echo "=== Sync complete ==="
echo "Synced: $SYNCED"
echo "Errors: $ERRORS"

if [ "$ERRORS" -gt 0 ]; then
  exit 1
fi
