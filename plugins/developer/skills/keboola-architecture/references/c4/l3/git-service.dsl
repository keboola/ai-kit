# L3 inter-service relationships for git-service
# Included inside keboolaPlatform block in model.dsl
# Not yet fully commissioned — no Terraform wiring exists yet.

git-service-api -> connection "verifies tokens and reads project context via Manage API (GIT_SERVICE_MANAGE_API_URL)"
git-service-api -> forgejo    "manages Git repositories via Forgejo admin token (GIT_SERVICE_FORGEJO_URL)"
