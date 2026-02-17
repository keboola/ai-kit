#!/bin/bash
# Unified CLI for processing GitHub PR review threads
# Usage: review.sh [--file <path>] <subcommand> [args...]
#
# IMPORTANT: Run from the project root directory, NOT from the skill directory.
# The script detects its own location and operates on the current working directory.
#
# Subcommands:
#   fetch [pr-url-or-number]              Fetch review threads for a PR
#   list  [summary|full|ids]              List unresolved review threads
#   get   <thread-id> [thread-id...]      Get thread details by ID
#   reply <thread-id> [-m msg] [commit-hash] Reply to thread (requires -m and/or commit-hash)
#   mark  <thread-id> [note]              Mark thread as locally resolved
#
# Global flags:
#   --file <path>   Override auto-detected reviews file path
#
# Examples:
#   review.sh fetch                       # Fetch reviews for current branch's PR
#   review.sh fetch 123                   # Fetch reviews for PR #123
#   review.sh list                        # List unresolved threads (summary)
#   review.sh list full                   # List unresolved threads (full JSON)
#   review.sh get PRRT_kwDOAbcd1234       # Get one thread
#   review.sh get PRRT_abc PRRT_def       # Get multiple threads
#   review.sh reply PRRT_kwDOAbcd1234 abc1234                         # Commit hash
#   review.sh reply PRRT_kwDOAbcd1234 -m "Refactored per suggestion"  # Message only
#   review.sh reply PRRT_kwDOAbcd1234 -m "Done" abc1234               # Both
#   review.sh mark PRRT_kwDOAbcd1234      # Mark as resolved
#   review.sh --file my.json list         # Use specific file

set -e

# --- Shared utilities ---

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

validate_git_repo() {
  if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "Error: Not inside a git repository. Run this from your project root." >&2
    exit 1
  fi
}

validate_file_exists() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Error: Reviews file not found: $file" >&2
    echo "Run 'review.sh fetch' first, or use --file to specify the path." >&2
    exit 1
  fi
}

detect_reviews_file() {
  # If --file was given, use that
  if [[ -n "$FILE_OVERRIDE" ]]; then
    echo "$FILE_OVERRIDE"
    return
  fi

  validate_git_repo

  local owner repo pr_number repo_info

  repo_info=$(gh repo view --json owner,name -q '"\(.owner.login)/\(.name)"' 2>/dev/null) || {
    echo "Error: Could not determine repository. Are you in a git repo with a GitHub remote?" >&2
    exit 1
  }
  owner=$(echo "$repo_info" | cut -d'/' -f1)
  repo=$(echo "$repo_info" | cut -d'/' -f2)

  pr_number=$(gh pr view --json number -q .number 2>/dev/null) || {
    echo "Error: No PR found for the current branch. Specify a PR with 'fetch <number>' or use --file." >&2
    exit 1
  }

  echo ".scratch/reviews/${owner}-${repo}-pr-${pr_number}.json"
}

usage() {
  echo "Usage: review.sh [--file <path>] <subcommand> [args...]" >&2
  echo "" >&2
  echo "Subcommands:" >&2
  echo "  fetch [pr-url-or-number]          Fetch review threads for a PR" >&2
  echo "  list  [summary|full|ids]          List unresolved review threads" >&2
  echo "  get   <thread-id> [thread-id...]  Get thread details by ID" >&2
  echo "  reply <thread-id> [-m msg] [commit-hash]  Reply (requires -m and/or commit-hash)" >&2
  echo "  mark  <thread-id> [note]          Mark thread as locally resolved" >&2
  echo "" >&2
  echo "Global flags:" >&2
  echo "  --file <path>   Override auto-detected reviews file path" >&2
  exit 1
}

# --- Subcommand functions ---

cmd_fetch() {
  validate_git_repo

  local pr_ref="$1"
  local owner repo pr_number

  # Determine PR number and owner/repo
  if [[ -n "$pr_ref" ]] && [[ "$pr_ref" =~ github\.com/([^/]+)/([^/]+)/pull/([0-9]+) ]]; then
    owner="${BASH_REMATCH[1]}"
    repo="${BASH_REMATCH[2]}"
    pr_number="${BASH_REMATCH[3]}"
  else
    # Get owner/repo from current directory
    local repo_info
    repo_info=$(gh repo view --json owner,name -q '"\(.owner.login)/\(.name)"' 2>/dev/null) || {
      echo "Error: Could not determine repository." >&2
      exit 1
    }
    owner=$(echo "$repo_info" | cut -d'/' -f1)
    repo=$(echo "$repo_info" | cut -d'/' -f2)

    if [[ -n "$pr_ref" ]]; then
      pr_number="$pr_ref"
    else
      pr_number=$(gh pr view --json number -q .number 2>/dev/null) || {
        echo "Error: No PR found for the current branch. Provide a PR number or URL." >&2
        exit 1
      }
    fi
  fi

  if [[ -z "$owner" || -z "$repo" ]]; then
    echo "Error: Could not determine repository. Provide full PR URL or run from a git repo." >&2
    exit 1
  fi

  local output_dir output_file
  if [[ -n "$FILE_OVERRIDE" ]]; then
    output_file="$FILE_OVERRIDE"
    output_dir="$(dirname "$output_file")"
  else
    output_dir=".scratch/reviews"
    output_file="$output_dir/${owner}-${repo}-pr-${pr_number}.json"
  fi

  mkdir -p "$output_dir"

  echo "Fetching reviews for $owner/$repo PR #$pr_number..." >&2

  local query='
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      number
      title
      url
      headRefName
      baseRefName
      state
      author {
        login
      }
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          diffSide
          comments(first: 50) {
            nodes {
              id
              databaseId
              body
              path
              author {
                login
              }
              createdAt
              outdated
            }
          }
        }
      }
      reviews(first: 50) {
        nodes {
          id
          databaseId
          state
          body
          author {
            login
          }
          submittedAt
        }
      }
    }
  }
}
'

  local response
  response=$(gh api graphql \
    -f query="$query" \
    -F owner="$owner" \
    -F repo="$repo" \
    -F pr="$pr_number")

  echo "$response" | jq --arg fetched_at "$(date -Iseconds)" '
    .data.repository.pullRequest as $pr |
    {
      pr: {
        number: $pr.number,
        title: $pr.title,
        url: $pr.url,
        headRefName: $pr.headRefName,
        baseRefName: $pr.baseRefName,
        state: $pr.state,
        author: $pr.author.login
      },
      fetched_at: $fetched_at,
      reviews: ($pr.reviews.nodes | map({
        id: .databaseId,
        graphql_id: .id,
        state: .state,
        body: .body,
        author: .author.login,
        submittedAt: .submittedAt
      })),
      threads: ($pr.reviewThreads.nodes | map({
        id: .id,
        isResolved: .isResolved,
        isOutdated: .isOutdated,
        path: .path,
        line: .line,
        startLine: .startLine,
        diffSide: .diffSide,
        local_resolved: false,
        local_notes: "",
        comments: (.comments.nodes | map({
          id: .databaseId,
          graphql_id: .id,
          body: .body,
          path: .path,
          author: .author.login,
          createdAt: .createdAt,
          outdated: .outdated
        }))
      }))
    }
  ' > "$output_file"

  local thread_count unresolved
  thread_count=$(jq '.threads | length' "$output_file")
  unresolved=$(jq '[.threads[] | select(.isResolved == false)] | length' "$output_file")
  echo "Saved $thread_count review threads ($unresolved unresolved) to: $output_file" >&2
  echo "$output_file"

  # Auto-list unresolved threads after fetch
  if [[ "$unresolved" -gt 0 ]]; then
    echo "" >&2
    echo "Unresolved threads:" >&2
    _list_threads "$output_file" "summary"
  fi
}

cmd_list() {
  local format="${1:-summary}"
  local reviews_file
  reviews_file=$(detect_reviews_file)
  validate_file_exists "$reviews_file"
  _list_threads "$reviews_file" "$format"
}

_list_threads() {
  local reviews_file="$1"
  local format="$2"

  local filter='select(.isResolved == false and .local_resolved == false and .isOutdated == false)'

  case "$format" in
    summary)
      jq -r "
        .threads
        | map($filter)
        | .[]
        | \"[\(.id)]: \(.path):\(.line // \"?\") - \(.comments[0].body | split(\"\n\")[0] | .[0:80])\"
      " "$reviews_file"
      ;;
    full)
      jq ".threads | map($filter)" "$reviews_file"
      ;;
    ids)
      jq -r ".threads | map($filter) | .[].id" "$reviews_file"
      ;;
    *)
      echo "Error: Unknown format '$format'. Use: summary, full, or ids" >&2
      exit 1
      ;;
  esac
}

cmd_get() {
  if [[ $# -eq 0 ]]; then
    echo "Error: At least one thread ID is required" >&2
    echo "Usage: review.sh get <thread-id> [thread-id...]" >&2
    exit 1
  fi

  local reviews_file
  reviews_file=$(detect_reviews_file)
  validate_file_exists "$reviews_file"

  local ids_json
  ids_json=$(printf '%s\n' "$@" | jq -R . | jq -s .)

  local result
  result=$(jq --argjson ids "$ids_json" '
    [.threads[] | select(.id as $tid | $ids | index($tid))]
  ' "$reviews_file")

  local found_count requested_count
  found_count=$(echo "$result" | jq 'length')
  requested_count=$#

  if [[ "$found_count" -eq 0 ]]; then
    echo "Error: None of the requested thread IDs were found" >&2
    exit 1
  fi

  if [[ "$found_count" -lt "$requested_count" ]]; then
    local found_ids
    found_ids=$(echo "$result" | jq -r '.[].id')
    for id in "$@"; do
      if ! echo "$found_ids" | grep -q "^${id}$"; then
        echo "Warning: Thread ID $id not found" >&2
      fi
    done
  fi

  # Single ID: output the object directly (backwards compatible)
  # Multiple IDs: output as array
  if [[ $requested_count -eq 1 ]]; then
    echo "$result" | jq '.[0]'
  else
    echo "$result"
  fi
}

cmd_reply() {
  local message=""
  local args=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -m)
        message="${2:?-m requires a message}"
        shift 2
        ;;
      *)
        args+=("$1")
        shift
        ;;
    esac
  done

  local thread_id="${args[0]:?Usage: review.sh reply <thread-id> [-m message] [commit-hash]}"
  local commit_hash="${args[1]:-}"

  validate_git_repo

  local reviews_file
  reviews_file=$(detect_reviews_file)
  validate_file_exists "$reviews_file"

  # Verify thread exists
  local found
  found=$(jq --arg id "$thread_id" '[.threads[] | select(.id == $id)] | length' "$reviews_file")
  if [[ "$found" -eq 0 ]]; then
    echo "Error: Thread ID $thread_id not found in $reviews_file" >&2
    exit 1
  fi

  local body=""
  if [[ -n "$commit_hash" ]]; then
    # Explicit commit hash provided
    local short_hash
    short_hash=$(git rev-parse --short "$commit_hash")
    body="Fixed in ${short_hash}"
    if [[ -n "$message" ]]; then
      body="${body}"$'\n\n'"${message}"
    fi
  elif [[ -n "$message" ]]; then
    # Message only, no commit hash
    body="$message"
  else
    echo "Error: Provide a commit hash, a message (-m), or both." >&2
    echo "Usage: review.sh reply <thread-id> [-m message] [commit-hash]" >&2
    exit 1
  fi

  local mutation='
mutation($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $threadId, body: $body}) {
    comment {
      id
      body
    }
  }
}
'

  local response
  response=$(gh api graphql \
    -f query="$mutation" \
    -f threadId="$thread_id" \
    -f body="$body")

  if echo "$response" | jq -e '.errors' > /dev/null 2>&1; then
    echo "Error posting reply:" >&2
    echo "$response" | jq '.errors' >&2
    exit 1
  fi

  echo "Replied to thread $thread_id with: $body" >&2
}

cmd_mark() {
  local thread_id="${1:?Usage: review.sh mark <thread-id> [note]}"
  local note="${2:-}"

  local reviews_file
  reviews_file=$(detect_reviews_file)
  validate_file_exists "$reviews_file"

  # Check if thread exists
  local found
  found=$(jq --arg id "$thread_id" '[.threads[] | select(.id == $id)] | length' "$reviews_file")
  if [[ "$found" -eq 0 ]]; then
    echo "Error: Thread ID $thread_id not found in $reviews_file" >&2
    exit 1
  fi

  # Update the thread's local_resolved field
  jq --arg id "$thread_id" --arg note "$note" '
    .threads |= map(
      if .id == $id then
        .local_resolved = true | .local_notes = $note
      else
        .
      end
    )
  ' "$reviews_file" > "${reviews_file}.tmp" && mv "${reviews_file}.tmp" "$reviews_file"

  echo "Marked thread $thread_id as resolved" >&2
}

# --- Parse global flags and dispatch ---

FILE_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)
      FILE_OVERRIDE="${2:?--file requires a path argument}"
      shift 2
      ;;
    -*)
      echo "Error: Unknown flag '$1'" >&2
      usage
      ;;
    *)
      break
      ;;
  esac
done

SUBCOMMAND="${1:-}"
shift || true

case "$SUBCOMMAND" in
  fetch) cmd_fetch "$@" ;;
  list)  cmd_list "$@" ;;
  get)   cmd_get "$@" ;;
  reply) cmd_reply "$@" ;;
  mark)  cmd_mark "$@" ;;
  *)     usage ;;
esac
