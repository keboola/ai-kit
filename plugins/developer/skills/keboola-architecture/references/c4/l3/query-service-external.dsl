# Cloud resource relationships for query-service
# Included at top level of model block in model.dsl

# Shared PostgreSQL — same instance as kai-assistant apps, database: query_service
query-service-api                    -> postgresql-instance "persists query jobs and results (query_service database)"
query-service-coordinator            -> postgresql-instance "reads/writes job queue and worker heartbeats"
query-service-worker                 -> postgresql-instance "reads job queue, writes query results and worker heartbeats"
query-service-partition-maintenance  -> postgresql-instance "maintains PostgreSQL partitions for job history tables"
