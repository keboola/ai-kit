#!/usr/bin/env bash
set -euo pipefail

# ensure-git-wt.sh — Clone or pull the git-wt repo, then print its path.
# Usage: eval "$(./ensure-git-wt.sh)"  or  GIT_WT="$(./ensure-git-wt.sh)"

readonly GIT_WT_REPO="https://github.com/vojtabiberle/git-wt.git"
readonly GIT_WT_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/git-wt"

if [[ -d "$GIT_WT_DIR/.git" ]]; then
    git -C "$GIT_WT_DIR" pull --quiet >&2
else
    git clone --quiet "$GIT_WT_REPO" "$GIT_WT_DIR" >&2
fi

# Print the path to the git-wt executable on stdout
echo "$GIT_WT_DIR/git-wt"
