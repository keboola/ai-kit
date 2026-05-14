# L3 inter-service relationships for runner-sync-api
# Included inside keboolaPlatform block in model.dsl

sync-actions-api -> connection "reads component configs and verifies tokens via Storage API"
sync-actions-api -> vault      "resolves variables before job execution"
