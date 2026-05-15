# L3 inter-service relationships for metastore-service
# Included inside keboolaPlatform block in model.dsl
# Gated on var.metastore_enabled — implemented but not yet enabled on production stacks.

metastore-api -> connection "verifies tokens and reads project context via Storage API (METASTORE_STORAGE_API_HOST)"
