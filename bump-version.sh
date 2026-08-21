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

# The marketplace manifest needs narrower treatment than the other .json files:
# its plugins[] entries with an object "source" live in another repo and are
# version-pinned by that repo's release job, so they must never be rewritten here.
MARKETPLACE_JSON="./.claude-plugin/marketplace.json"

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
        tmp_file="${file}.tmp"

        if [ "$file" = "$MARKETPLACE_JSON" ]; then
            # Marketplace: bump the marketplace's own version and the entries
            # sourced from this repo (string "source"). Entries with an object
            # "source" are external and keep their pinned version + source.ref.
            jq --arg version "$VERSION" '
                .version = $version
                | (.plugins[]? | select((.source | type) == "string") | .version) = $version
            ' "$file" > "$tmp_file"
        else
            # Use jq to update all version fields
            jq --arg version "$VERSION" '
                walk(
                    if type == "object" and has("version") then
                        .version = $version
                    else
                        .
                    end
                )
            ' "$file" > "$tmp_file"
        fi

        mv "$tmp_file" "$file"
    elif [ "$file" = "$MARKETPLACE_JSON" ]; then
        # Without jq, a global sed would also retag the pinned external entries,
        # so only the marketplace's own version (the first "version" in the file)
        # is touched here.
        sed -i.bak -E "0,/(\"version\"[[:space:]]*:[[:space:]]*\")([^\"]+)(\")/s//\1${VERSION}\3/" "$file"
        rm -f "${file}.bak"
        echo "  ! jq not found — local plugins[] entries in $file need a manual bump"
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
