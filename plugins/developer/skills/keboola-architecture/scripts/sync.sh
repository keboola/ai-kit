#!/usr/bin/env bash
# Refreshes the bundled C4 snapshot from keboola/platform-architecture-and-concepts.
#
# Requires:
#   - gh CLI authenticated with access to the private repo
#   - rsync, tar
#
# Run from anywhere; the script resolves its own location.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
REFERENCES_DIR="$SKILL_DIR/references"

REPO="keboola/platform-architecture-and-concepts"
REF="${1:-main}"

if ! command -v gh >/dev/null 2>&1; then
    echo "error: gh CLI is required" >&2
    exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
    echo "error: gh is not authenticated (run 'gh auth login')" >&2
    exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "Fetching ${REPO}@${REF} ..."
gh api "repos/${REPO}/tarball/${REF}" > "$tmp_dir/repo.tar.gz"

echo "Extracting ..."
tar -xzf "$tmp_dir/repo.tar.gz" -C "$tmp_dir"
extracted_root="$(/usr/bin/find "$tmp_dir" -mindepth 1 -maxdepth 1 -type d ! -name 'repo*')"

if [[ ! -d "$extracted_root/c4" ]]; then
    echo "error: extracted archive does not contain c4/ at top level" >&2
    exit 1
fi

echo "Updating references/ ..."
rm -rf "$REFERENCES_DIR/c4" "$REFERENCES_DIR/c4-docs"
mkdir -p "$REFERENCES_DIR/c4-docs"

rsync -a \
    --exclude='skills/' \
    --exclude='*.tmp' \
    --exclude='*.tmp.*' \
    --exclude='*.deleted' \
    --exclude='*.html' \
    --exclude='*.png' \
    --exclude='workspace.json' \
    "$extracted_root/c4/" "$REFERENCES_DIR/c4/"

cp "$extracted_root/c4-docs/c4-approach.md" "$REFERENCES_DIR/c4-docs/c4-approach.md"

file_count="$(/usr/bin/find "$REFERENCES_DIR" -type f | wc -l | tr -d ' ')"
size="$(du -sh "$REFERENCES_DIR" | cut -f1)"

echo "Done. ${file_count} files, ${size}."
echo "Review with: git diff -- $REFERENCES_DIR"
