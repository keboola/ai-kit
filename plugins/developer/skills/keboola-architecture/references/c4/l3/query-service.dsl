# L3 inter-service relationships for query-service
# Included inside keboolaPlatform block in model.dsl

# All components use QUERY_STORAGE_API_HOST = connection.{suffix}
# for Storage API token verification and workspace credential retrieval.
query-service-api                    -> connection "verifies tokens and retrieves workspace credentials via Storage API"
query-service-coordinator            -> connection "verifies tokens and reads stack services map via Storage API"
query-service-worker                 -> connection "verifies tokens and retrieves workspace credentials via Storage API"
query-service-partition-maintenance  -> connection "verifies tokens via Storage API"

# Worker executes queries directly against storage backends
query-service-worker                 -> snowflake  "executes SQL queries against customer Snowflake accounts"
query-service-worker                 -> bigquery   "executes SQL queries against customer BigQuery projects"
