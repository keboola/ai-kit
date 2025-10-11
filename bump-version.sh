#!/bin/bash

# Script to bump version in all .json files
# Usage: ./bump-version.sh <version>

set -e

VERSION="$1"

if [ -z "$VERSION" ]; then
    echo "Error: Version parameter is required"
    echo "Usage: $0 <version>"
    echo "Example: $0 1.2.0"
    exit 1
fi

# Validate version format (basic semver check)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
    echo "Warning: Version '$VERSION' does not follow semantic versioning format (e.g., 1.2.3)"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Bumping version to: $VERSION"
echo "---"

# Find all .json files
JSON_FILES=$(find . -name "*.json" -type f -not -path "*/node_modules/*" -not -path "*/.git/*")

if [ -z "$JSON_FILES" ]; then
    echo "No .json files found"
    exit 0
fi

# Check if jq is available
if command -v jq &> /dev/null; then
    echo "Using jq for JSON manipulation"
    USE_JQ=true
else
    echo "jq not found, using sed (less reliable for complex JSON)"
    USE_JQ=false
fi

# Update each file
for file in $JSON_FILES; do
    echo "Processing: $file"

    if [ "$USE_JQ" = true ]; then
        # Use jq to update all version fields
        tmp_file="${file}.tmp"
        jq --arg version "$VERSION" '
            walk(
                if type == "object" and has("version") then
                    .version = $version
                else
                    .
                end
            )
        ' "$file" > "$tmp_file"
        mv "$tmp_file" "$file"
    else
        # Fallback to sed (updates first occurrence of version field)
        sed -i.bak -E "s/(\"version\"[[:space:]]*:[[:space:]]*\")([^\"]+)(\")/\1${VERSION}\3/g" "$file"
        rm -f "${file}.bak"
    fi

    echo "  ✓ Updated"
done

echo "---"
echo "Version bump complete!"
echo ""
echo "Updated files:"
echo "$JSON_FILES"
