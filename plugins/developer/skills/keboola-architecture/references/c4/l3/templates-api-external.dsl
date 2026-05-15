# Cloud resource relationships for templates-api
# Included at top level of model block in model.dsl
# templates-api has no cloud resource dependencies of its own.
# (No Terraform module, no KMS, no database, no queues, no object storage.)
# etcd is self-hosted as a Helm sub-chart co-deployed with templates-api.

templates-api -> github "clones template repositories at runtime to read template definitions (keboola/keboola-as-code-templates)"
