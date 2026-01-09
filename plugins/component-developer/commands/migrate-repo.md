---
description: Migrate Keboola component repository from Bitbucket to GitHub with full history, branches, tags, and GitHub Actions setup
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion
argument-hint: <bitbucket-url> [github-org/repo-name]
---

# Migrate Repository from Bitbucket to GitHub

Complete guide for migrating a Keboola component repository from Bitbucket to GitHub, preserving full history, all branches, tags, and setting up GitHub Actions for CI/CD deployment.

## What This Command Does

1. **Clones Bitbucket repository** - Full clone with all branches and tags
2. **Creates GitHub repository** - Empty repo ready for migration
3. **Pushes everything** - All branches, tags, and full commit history
4. **Migrates CI/CD** - Replaces bitbucket-pipelines.yml with GitHub Actions
5. **Configures GitHub** - Sets up secrets, team access, branch protection
6. **Verifies migration** - Validates all data transferred correctly

## Prerequisites

Before running this command, ensure you have:
- GitHub CLI (`gh`) installed and authenticated
- Git configured (user.name, user.email)
- Access to Bitbucket repository
- Permissions on GitHub organization (create repos, manage teams, set secrets)

## Usage

```bash
# Interactive mode (asks for details)
/migrate-repo

# With Bitbucket URL
/migrate-repo git@bitbucket.org:workspace/repo-name.git

# Specify GitHub destination
/migrate-repo git@bitbucket.org:workspace/repo.git keboola/new-repo-name

# Dry run (show what would happen)
/migrate-repo --dry-run git@bitbucket.org:workspace/repo.git
```

## Instructions

### Step 1: Validate Prerequisites

Check that all required tools are installed and configured:

```bash
# Check GitHub CLI authentication
gh auth status || {
  echo "Error: GitHub CLI not authenticated"
  echo "Run: gh auth login"
  exit 1
}

# Check git configuration
git config --get user.name || {
  echo "Error: Git user.name not configured"
  echo "Run: git config --global user.name 'Your Name'"
  exit 1
}

git config --get user.email || {
  echo "Error: Git user.email not configured"
  echo "Run: git config --global user.email 'your.email@example.com'"
  exit 1
}

echo "✓ Prerequisites validated"
```

### Step 2: Gather Migration Details

Collect information about the migration:

```bash
# Parse arguments or ask user
if [ -z "$BITBUCKET_URL" ]; then
  # Ask user for Bitbucket URL
  echo "Bitbucket repository URL (e.g., git@bitbucket.org:workspace/repo.git):"
  read BITBUCKET_URL
fi

# Extract repo name from Bitbucket URL
REPO_NAME=$(echo "$BITBUCKET_URL" | sed 's/.*\///' | sed 's/\.git$//')

# Ask for GitHub org/repo or use argument
if [ -z "$GITHUB_REPO" ]; then
  echo "GitHub repository (e.g., keboola/component-name) [keboola/$REPO_NAME]:"
  read GITHUB_REPO
  GITHUB_REPO=${GITHUB_REPO:-"keboola/$REPO_NAME"}
fi

# Extract component ID from repo name (for GitHub Actions)
COMPONENT_ID=$(echo "$REPO_NAME" | sed 's/^component-//')

echo ""
echo "Migration Plan:"
echo "  From: $BITBUCKET_URL"
echo "  To: github.com/$GITHUB_REPO"
echo "  Component ID: $COMPONENT_ID"
echo ""
```

### Step 3: Clone Bitbucket Repository

Clone the full Bitbucket repository locally:

```bash
WORK_DIR="/tmp/migration-$(date +%s)"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

echo "📦 Cloning Bitbucket repository..."
git clone "$BITBUCKET_URL" "$REPO_NAME" || {
  echo "Error: Failed to clone Bitbucket repository"
  exit 1
}

cd "$REPO_NAME"

# Fetch all branches
git fetch --all

# Show what we have
echo ""
echo "✓ Cloned repository"
echo "  Branches: $(git branch -a | wc -l | xargs)"
echo "  Tags: $(git tag | wc -l | xargs)"
echo "  Commits: $(git rev-list --all --count)"
echo ""
```

### Step 4: Create GitHub Repository

Create an empty GitHub repository:

```bash
echo "📝 Creating GitHub repository..."

# Create empty private repo
gh repo create "$GITHUB_REPO" --private --clone=false || {
  echo "Error: Failed to create GitHub repository"
  echo "It may already exist. Continue anyway? (y/n)"
  read CONTINUE
  if [ "$CONTINUE" != "y" ]; then
    exit 1
  fi
}

echo "✓ GitHub repository created: github.com/$GITHUB_REPO"
```

### Step 5: Push Everything to GitHub

Push all branches and tags:

```bash
# Add GitHub as remote
git remote add github "git@github.com:$GITHUB_REPO.git"

echo "🚀 Pushing to GitHub..."

# Push all branches
git push github --all || {
  echo "Warning: Some branches failed to push"
}

# Push all tags
git push github --tags || {
  echo "Warning: Some tags failed to push"
}

# Push any remaining remote branches
for branch in $(git branch -r | grep 'origin/' | grep -v 'HEAD' | grep -v 'master' | grep -v 'main'); do
  branch_name=${branch#origin/}
  echo "  Pushing branch: $branch_name"
  git push github "refs/remotes/$branch:refs/heads/$branch_name" 2>/dev/null || true
done

echo "✓ Pushed all branches and tags"
```

### Step 6: Migrate CI/CD to GitHub Actions

Replace Bitbucket Pipelines with GitHub Actions:

```bash
# Check out master/main branch
if git show-ref --verify --quiet refs/heads/master; then
  git checkout master
elif git show-ref --verify --quiet refs/heads/main; then
  git checkout main
else
  echo "Warning: Neither master nor main branch found"
  git checkout $(git branch | head -1 | sed 's/^* //')
fi

echo "🔄 Migrating CI/CD to GitHub Actions..."

# Remove Bitbucket Pipelines
rm -f bitbucket-pipelines.yml

# Download latest GitHub Actions workflow from cookiecutter template
mkdir -p .github/workflows

echo "Downloading latest push.yml from cookiecutter template..."
COOKIECUTTER_WORKFLOW_URL="https://raw.githubusercontent.com/keboola/cookiecutter-python-component/main/%7B%7Bcookiecutter.repository_folder_name%7D%7D/.github/workflows/push.yml"

curl -fsSL "$COOKIECUTTER_WORKFLOW_URL" -o .github/workflows/push.yml || {
  echo "Error: Failed to download workflow from cookiecutter template"
  exit 1
}

# Replace cookiecutter placeholders with actual values
sed -i.bak \
  -e "s/COOKIECUTTER_DEV_PORTAL_VENDOR_NAME/keboola/g" \
  -e "s/COOKIECUTTER_DEV_PORTAL_COMPONENT_ID/$COMPONENT_ID/g" \
  .github/workflows/push.yml

rm -f .github/workflows/push.yml.bak

echo "✓ Downloaded and configured push.yml from cookiecutter template"

# Commit changes
git add -A
git commit -m "ci: migrate from Bitbucket Pipelines to GitHub Actions

- Added GitHub Actions workflow from cookiecutter template
- Workflow: .github/workflows/push.yml
- Removed bitbucket-pipelines.yml
- Component ID: $COMPONENT_ID
- Template: keboola/cookiecutter-python-component

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push to GitHub
git push github HEAD

echo "✓ CI/CD migrated to GitHub Actions"
```

### Step 7: Rename master → main (if needed)

Optionally rename master branch to main:

```bash
echo "🔄 Renaming master → main..."

# Check if we need to rename
if git show-ref --verify --quiet refs/heads/master; then
  # Set master as default temporarily
  gh api -X PATCH "/repos/$GITHUB_REPO" -f default_branch=master

  # Remove branch protection from main if exists
  gh api -X DELETE "/repos/$GITHUB_REPO/branches/main/protection" 2>/dev/null || true

  # Delete old main if exists
  git push github --delete main 2>/dev/null || true

  # Create new main from master
  git push github master:refs/heads/main

  # Set main as default
  gh api -X PATCH "/repos/$GITHUB_REPO" -f default_branch=main

  # Delete master
  git push github --delete master

  echo "✓ Renamed master → main"
fi
```

### Step 8: Configure GitHub Secrets

Set up required secrets for GitHub Actions:

```bash
echo "🔐 Setting up GitHub secrets..."

# Set Developer Portal credentials
echo "Enter KBC Developer Portal password (kds-team+github):"
read -s KBC_PASSWORD

echo "$KBC_PASSWORD" | gh secret set KBC_DEVELOPERPORTAL_PASSWORD -R "$GITHUB_REPO"
echo "kds-team+github" | gh secret set KBC_DEVELOPERPORTAL_USERNAME -R "$GITHUB_REPO"

echo "✓ Secrets configured"
```

### Step 9: Configure Team Access

Grant team permissions:

```bash
echo "👥 Configuring team access..."

# Extract org from GITHUB_REPO
GITHUB_ORG=$(echo "$GITHUB_REPO" | cut -d/ -f1)

# Add component-factory team with admin access
gh api -X PUT "/orgs/$GITHUB_ORG/teams/component-factory/repos/$GITHUB_REPO" \
  -f permission=admin || {
  echo "Warning: Failed to add team access (team may not exist)"
}

echo "✓ Team access configured"
```

### Step 10: Configure Branch Protection

Set up branch protection rules:

```bash
echo "🛡️ Setting up branch protection..."

gh api -X PUT "/repos/$GITHUB_REPO/branches/main/protection" --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["build"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null
}
EOF

echo "✓ Branch protection enabled"
```

### Step 11: Verify Migration

Validate that everything transferred correctly:

```bash
echo ""
echo "✅ Verifying migration..."
echo ""

# Check default branch
DEFAULT_BRANCH=$(gh repo view "$GITHUB_REPO" --json defaultBranchRef --jq '.defaultBranchRef.name')
echo "✓ Default branch: $DEFAULT_BRANCH"

# Check branches
BRANCH_COUNT=$(gh api "/repos/$GITHUB_REPO/branches" --jq '. | length')
echo "✓ Branches: $BRANCH_COUNT"

# Check tags
TAG_COUNT=$(gh api "/repos/$GITHUB_REPO/tags" --paginate --jq '. | length' | awk '{s+=$1} END {print s}')
echo "✓ Tags: $TAG_COUNT"

# Check secrets
SECRET_COUNT=$(gh secret list -R "$GITHUB_REPO" | wc -l | xargs)
echo "✓ Secrets: $SECRET_COUNT"

# Check workflow
if gh api "/repos/$GITHUB_REPO/contents/.github/workflows/push.yml" &>/dev/null; then
  echo "✓ GitHub Actions workflow present"
fi

# Check bitbucket-pipelines removed
if ! gh api "/repos/$GITHUB_REPO/contents/bitbucket-pipelines.yml" &>/dev/null; then
  echo "✓ bitbucket-pipelines.yml removed"
fi

echo ""
```

### Step 12: Cleanup and Summary

Clean up temporary directory and show summary:

```bash
echo "🧹 Cleaning up..."
cd /
rm -rf "$WORK_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Migration Complete!"
echo ""
echo "📦 Repository: https://github.com/$GITHUB_REPO"
echo "🔧 Component ID: $COMPONENT_ID"
echo "🌿 Default branch: main"
echo ""
echo "Next Steps:"
echo "  1. Verify GitHub Actions workflow runs successfully"
echo "  2. Update Developer Portal URLs (on next release):"
echo "     - sourceCodeUrl: https://github.com/$GITHUB_REPO"
echo "     - documentationUrl: https://github.com/$GITHUB_REPO/blob/main/README.md"
echo "  3. Update local working directory:"
echo "     cd /path/to/working/repo"
echo "     git remote set-url origin git@github.com:$GITHUB_REPO.git"
echo "     git fetch origin"
echo "     git reset --hard origin/main"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
```

## Important Notes

### Preserving History
- **All commit timestamps preserved** - Author and committer dates stay intact
- **Full branch history** - All branches transferred with complete history
- **Tags maintained** - All version tags transferred correctly
- Only new migration commit has current timestamp

### Alternative: Git Mirror Method

For simpler migration (without GitHub Actions setup):

```bash
# Clone as mirror
git clone --mirror git@bitbucket.org:workspace/repo.git repo.git
cd repo.git

# Push mirror to GitHub
git push --mirror git@github.com:org/repo.git
```

**Pros:** Simple, one command, complete mirror
**Cons:** Doesn't set up GitHub Actions, requires manual workflow addition

## Safety Checks

1. **Dry run first** - Use `--dry-run` to see what would happen
2. **Verify branches** - Check all branches transferred
3. **Verify tags** - Confirm version tags present
4. **Test workflow** - Ensure GitHub Actions runs successfully
5. **Keep Bitbucket** - Don't delete Bitbucket repo until verified

## Troubleshooting

### Error: Branch protection blocks push
```bash
# Temporarily disable enforce_admins
gh api -X PATCH "/repos/$GITHUB_REPO/branches/main/protection" \
  -f enforce_admins=false

# Make your changes
git push github main

# Re-enable
gh api -X PATCH "/repos/$GITHUB_REPO/branches/main/protection" \
  -f enforce_admins=true
```

### Error: Remote branches not pushing
```bash
# Use explicit refspec
git push github refs/remotes/origin/branch-name:refs/heads/branch-name
```

### Error: Permission denied
Check that you have:
- Admin access to GitHub organization
- Push access to Bitbucket repository
- `gh` CLI authenticated with correct account

## Migration Checklist

After migration, verify:

- [ ] All branches transferred
- [ ] All tags transferred
- [ ] Commit history preserved (including timestamps)
- [ ] GitHub Actions workflow added
- [ ] `KBC_DEVELOPERPORTAL_APP` ID correct in workflow
- [ ] bitbucket-pipelines.yml removed
- [ ] Secrets configured (USERNAME, PASSWORD)
- [ ] Team access granted (component-factory: admin)
- [ ] Branch protection enabled on main
- [ ] Default branch set to main
- [ ] First GitHub Actions build triggered
- [ ] Local repo updated to use GitHub remote

## Example Session

```
User: /migrate-repo git@bitbucket.org:keboola/component-wr-sftp-csas.git
Assistant: Starting Bitbucket → GitHub migration...

✓ Prerequisites validated

Migration Plan:
  From: git@bitbucket.org:keboola/component-wr-sftp-csas.git
  To: github.com/keboola/component-wr-sftp-csas
  Component ID: wr-sftp-csas

📦 Cloning Bitbucket repository...
✓ Cloned repository
  Branches: 5
  Tags: 25
  Commits: 147

📝 Creating GitHub repository...
✓ GitHub repository created

🚀 Pushing to GitHub...
✓ Pushed all branches and tags

🔄 Migrating CI/CD to GitHub Actions...
✓ CI/CD migrated to GitHub Actions

🔄 Renaming master → main...
✓ Renamed master → main

🔐 Setting up GitHub secrets...
✓ Secrets configured

👥 Configuring team access...
✓ Team access configured

🛡️ Setting up branch protection...
✓ Branch protection enabled

✅ Verifying migration...
✓ Default branch: main
✓ Branches: 5
✓ Tags: 25
✓ Secrets: 2
✓ GitHub Actions workflow present
✓ bitbucket-pipelines.yml removed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Migration Complete!

📦 Repository: https://github.com/keboola/component-wr-sftp-csas
🔧 Component ID: wr-sftp-csas
🌿 Default branch: main

Next Steps:
  1. Verify GitHub Actions workflow runs successfully
  2. Update Developer Portal URLs (on next release)
  3. Update local working directory

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Reference

- Original guide (Czech): MIGRATION_GUIDE.md
- GitHub CLI docs: https://cli.github.com/
- Keboola Developer Portal: https://components.keboola.com/

