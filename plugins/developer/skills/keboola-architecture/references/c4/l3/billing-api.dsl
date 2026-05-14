# L3 inter-service relationships for billing-api
# Included inside keboolaPlatform block in model.dsl

billing-api                          -> connection "verifies tokens and reads project/org data via Storage and Manage APIs"
billing-api                          -> queue      "triggers jobs via Queue API (resolved via Storage API service URL)"
billing-gcp-marketplace-consumer     -> connection "verifies tokens"
billing-marketplaces-reporting-azure -> connection "reads subscriptions and billing data"
