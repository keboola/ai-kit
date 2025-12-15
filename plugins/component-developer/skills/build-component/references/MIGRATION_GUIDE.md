# Bitbucket → GitHub Migration Guide

Complete guide for migrating a repository from Bitbucket to GitHub with full history, all branches, tags, and GitHub Actions setup.

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- Git configured (user.name, user.email)
- Access to Bitbucket repository
- Permissions on GitHub organization (for creating repositories, setting teams, secrets)

## Step 1: Preparation

```bash
# Verify GitHub CLI authentication
gh auth status

# Verify git configuration
git config --get user.name
git config --get user.email
```

## Step 2: Clone Bitbucket Repository

```bash
# Clone Bitbucket repository locally
cd /path/to/parent/directory
git clone git@bitbucket.org:workspace/repo-name.git
cd repo-name

# Verify branches and tags
git branch -a
git tag
```

## Step 3: Create Empty GitHub Repository

Create an empty repository on GitHub (via web UI or gh CLI):
```bash
gh repo create org/repo-name --private --clone=false
```

Or use an existing empty repository.

## Step 4: Add GitHub Remote and Push Everything

```bash
# In the cloned Bitbucket repository
cd /path/to/bitbucket-repo

# Add GitHub as new remote
git remote add github git@github.com:org/repo-name.git

# Fetch everything
git fetch --all

# Push all branches
git push github --all

# Push all tags
git push github --tags

# Push all remote branches (if --all didn't push everything)
# For each branch separately:
git push github refs/remotes/origin/branch-name:refs/heads/branch-name

# Or for all at once (if there are many):
for branch in $(git branch -r | grep 'origin/' | grep -v 'HEAD' | grep -v 'master'); do
    branch_name=${branch#origin/}
    git push github refs/remotes/$branch:refs/heads/$branch_name
done
```

## Step 5: Add GitHub Actions Workflow

```bash
# In Bitbucket repository
git checkout master  # or main

# Delete Bitbucket Pipelines
rm -f bitbucket-pipelines.yml

# Create GitHub Actions workflow
mkdir -p .github/workflows
```

Create `.github/workflows/push.yml` file with:
- Set `KBC_DEVELOPERPORTAL_APP` to correct component ID
- Set `KBC_DEVELOPERPORTAL_VENDOR`
- Configure workflow as needed

```bash
# Commit changes
git add -A
git commit -m "Migrate from Bitbucket to GitHub

- Added GitHub Actions workflow (.github/workflows/push.yml)
- Removed bitbucket-pipelines.yml

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push to GitHub
git push github master
```

## Step 6: Rename master → main (if needed)

```bash
# Change default branch to master temporarily (if it's main)
gh api -X PATCH /repos/org/repo-name -f default_branch=master

# Remove branch protection from main (if exists)
gh api -X DELETE /repos/org/repo-name/branches/main/protection

# Delete old main branch (if exists)
git push github --delete main

# Create new main from master
git push github master:refs/heads/main

# Set main as default
gh api -X PATCH /repos/org/repo-name -f default_branch=main

# Delete master
git push github --delete master
```

## Step 7: Configure GitHub Actions Secrets

```bash
echo "kds-team+github" | gh secret set KBC_DEVELOPERPORTAL_USERNAME -R org/repo-name
echo "your-password-here" | gh secret set KBC_DEVELOPERPORTAL_PASSWORD -R org/repo-name
```

**Credentials for Keboola components:**
- Username: `kds-team+github`
- Password: (use existing from migration script or generate new)

## Step 8: Assign Team Access

```bash
# Add team with admin rights
gh api -X PUT /orgs/org-name/teams/team-slug/repos/org-name/repo-name -f permission=admin
```

Typically for Keboola:
```bash
gh api -X PUT /orgs/keboola/teams/component-factory/repos/keboola/repo-name -f permission=admin
```

## Step 9: Configure Branch Protection

```bash
gh api -X PUT "/repos/org/repo-name/branches/main/protection" --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["tests", "tests-kbc", "push"]
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
```

## Step 10: Verification

```bash
# Verify default branch
gh repo view org/repo-name --json defaultBranchRef

# Verify branches
gh api /repos/org/repo-name/branches --jq '.[].name'

# Verify tags
gh api /repos/org/repo-name/tags --jq '.[].name' | head -10

# Verify secrets
gh secret list -R org/repo-name

# Verify branch protection
gh api /repos/org/repo-name/branches/main/protection --jq '{
  required_checks: .required_status_checks.contexts,
  enforce_admins: .enforce_admins.enabled,
  required_reviews: .required_pull_request_reviews.required_approving_review_count
}'

# Verify workflow
gh api /repos/org/repo-name/contents/.github/workflows/push.yml --jq '.name'

# Verify bitbucket-pipelines is deleted
gh api /repos/org/repo-name/contents/bitbucket-pipelines.yml 2>&1 | grep -q "Not Found" && echo "✓ Correctly deleted" || echo "✗ Still exists"
```

## Step 11: Update Local Repository

```bash
# In original working directory (GitHub repository)
cd /path/to/working/repo
git fetch origin
git reset --hard origin/main
git log --oneline -5  # Verify history
```

## Notes

### Preserving Timestamps
- **Commit timestamps** (author date, committer date) are automatically preserved during push
- Only the new migration commit has the current date
- All other commits retain their original dates from Bitbucket

### Alternative Method (git mirror)
For a completely clean mirror you can use:
```bash
git clone --mirror git@bitbucket.org:workspace/repo.git repo.git
cd repo.git
git push --mirror git@github.com:org/repo.git
```

**Advantages:**
- Simpler, one command
- Complete mirror including all refs

**Disadvantages:**
- Doesn't add GitHub Actions workflow automatically
- Needs to be added afterwards to each branch or at least to main

### Important
- **Always verify** that all branches and tags were transferred
- **Check** GitHub Actions workflow before first push
- **Set** branch protection only after everything is configured
- **Developer Portal attributes** (sourceCodeUrl, documentationUrl, licenseUrl) should be updated during next component release

## Troubleshooting

### Branch Protection Blocks Deletion
```bash
# Remove branch protection first
gh api -X DELETE /repos/org/repo-name/branches/branch-name/protection
# Then delete branch
git push github --delete branch-name
```

### Remote Branches Won't Push
```bash
# Use full refspec
git push github refs/remotes/origin/branch-name:refs/heads/branch-name
```

### Non-fast-forward Error During Rename
```bash
# If there's conflict between main and master, change default branch first
gh api -X PATCH /repos/org/repo-name -f default_branch=master
# Then remove branch protection and delete main
gh api -X DELETE /repos/org/repo-name/branches/main/protection
git push github --delete main
# Then create new main from master
git push github master:refs/heads/main
```

### Push Declined Due to Repository Rule Violations
This means branch protection is blocking direct push. You need to either:
1. Temporarily disable enforce_admins
2. Create a branch and PR instead of direct push

## Post-Migration Checklist

- [ ] All branches transferred
- [ ] All tags transferred
- [ ] Commit history preserved (including timestamps)
- [ ] GitHub Actions workflow added and correctly configured
- [ ] `KBC_DEVELOPERPORTAL_APP` ID set correctly in workflow
- [ ] bitbucket-pipelines.yml deleted
- [ ] Secrets configured (KBC_DEVELOPERPORTAL_USERNAME, KBC_DEVELOPERPORTAL_PASSWORD)
- [ ] Team access assigned (component-factory: admin)
- [ ] Branch protection configured on main
- [ ] Default branch set correctly (main)
- [ ] First GitHub Actions build started (doesn't need to pass, but should start)

## Example: Real Migration kds-team.wr-sftp-csas

```bash
# 1. Cloned Bitbucket repo
cd ../kds-team.wr-sftp-csas

# 2. Add GitHub remote
git remote add github git@github.com:keboola/component-wr-sftp-csas.git

# 3. Push everything
git push github --all
git push github --tags
git push github refs/remotes/origin/feature-add-test-host:refs/heads/feature-add-test-host
git push github refs/remotes/origin/feature/retry-on-path-not-found:refs/heads/feature/retry-on-path-not-found
git push github refs/remotes/origin/test:refs/heads/test

# 4. Add GitHub Actions
rm -f bitbucket-pipelines.yml
mkdir -p .github/workflows
# Create .github/workflows/push.yml with KBC_DEVELOPERPORTAL_APP: "kds-team.wr-sftp-csas"
git add -A
git commit -m "Migrate from Bitbucket to GitHub..."
git push github master

# 5. Rename to main
gh api -X PATCH /repos/keboola/component-wr-sftp-csas -f default_branch=master
gh api -X DELETE /repos/keboola/component-wr-sftp-csas/branches/main/protection
git push github --delete main
git push github master:refs/heads/main
gh api -X PATCH /repos/keboola/component-wr-sftp-csas -f default_branch=main
git push github --delete master

# 6. Secrets
echo "kds-team+github" | gh secret set KBC_DEVELOPERPORTAL_USERNAME -R keboola/component-wr-sftp-csas
echo "password" | gh secret set KBC_DEVELOPERPORTAL_PASSWORD -R keboola/component-wr-sftp-csas

# 7. Team
gh api -X PUT /orgs/keboola/teams/component-factory/repos/keboola/component-wr-sftp-csas -f permission=admin

# 8. Branch protection
gh api -X PUT "/repos/keboola/component-wr-sftp-csas/branches/main/protection" --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["tests", "tests-kbc", "push"]
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

# 9. Verification
gh repo view keboola/component-wr-sftp-csas --json defaultBranchRef,name
gh api /repos/keboola/component-wr-sftp-csas/branches --jq '.[].name'
gh api /repos/keboola/component-wr-sftp-csas/tags --jq '.[].name' | head -10
```

Result:
- ✅ 4 branches (main, feature-add-test-host, feature/retry-on-path-not-found, test)
- ✅ 25 tags (0.0.1 to 1.2.7 + test)
- ✅ Full commit history preserved
- ✅ GitHub Actions workflow active
- ✅ Repository URL: https://github.com/keboola/component-wr-sftp-csas
