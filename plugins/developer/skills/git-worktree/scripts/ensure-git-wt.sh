#!/usr/bin/env bash
set -euo pipefail

# ensure-git-wt.sh — Clone or update the git-wt repo, then print its path.
# Usage: GIT_WT="$(./ensure-git-wt.sh)"

readonly GIT_WT_REPO="https://github.com/vojtabiberle/git-wt.git"
readonly GIT_WT_PINNED_COMMIT="f44fbfe042b6f454e0016d5e844d773073600074"
readonly GIT_WT_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/git-wt"

if [[ -d "$GIT_WT_DIR/.git" ]]; then
    # Try to update existing clone; on failure, warn and keep using current version.
    if ! git -C "$GIT_WT_DIR" fetch --quiet >&2 || \
       ! git -C "$GIT_WT_DIR" checkout --quiet "$GIT_WT_PINNED_COMMIT" >&2; then
        echo "Warning: Failed to update git-wt in '$GIT_WT_DIR'; using existing version." >&2
    fi
else
    # Clone fresh; on failure, provide a helpful error and exit.
    if ! git clone --quiet "$GIT_WT_REPO" "$GIT_WT_DIR" >&2; then
        echo "Error: Failed to clone git-wt from '$GIT_WT_REPO' into '$GIT_WT_DIR'." >&2
        echo "Please check your network connection and repository access, then try again." >&2
        exit 1
    fi
    git -C "$GIT_WT_DIR" checkout --quiet "$GIT_WT_PINNED_COMMIT" >&2 || true
fi

# Verify the executable exists
if [[ ! -f "$GIT_WT_DIR/git-wt" ]]; then
    echo "ensure-git-wt.sh: expected git-wt executable not found at '$GIT_WT_DIR/git-wt'" >&2
    exit 1
fi

# Print the path to the git-wt executable on stdout
echo "$GIT_WT_DIR/git-wt"
