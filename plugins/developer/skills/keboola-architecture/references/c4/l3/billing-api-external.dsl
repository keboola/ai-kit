# Cloud resource relationships for billing-api
# Included at top level of model block in model.dsl
# Note: billing-api has no AWS module — it runs on Azure and GCP stacks only.

billing-api                          -> mysql-instance-job-queue "persists billing data (shares job-queue MySQL instance)"
billing-api                          -> azure-marketplace        "resolves and activates marketplace subscriptions on Azure stacks"
billing-api                          -> google-marketplace       "resolves entitlements via Cloud Commerce Partner Procurement API on GCP stacks"

billing-gcp-marketplace-consumer     -> mysql-instance-job-queue "persists billing data"
billing-gcp-marketplace-consumer     -> google-marketplace       "processes entitlement and account events via Pub/Sub subscription on Google's marketplace topic"

billing-marketplaces-reporting-azure -> mysql-instance-job-queue "reads subscription data to report"
billing-marketplaces-reporting-azure -> azure-marketplace        "reports hourly usage batches via Metering Service API"
