# L3 inter-service relationships for connection
# Included inside keboolaPlatform block in model.dsl

connection-storage-api                     -> connection-elasticsearch "Indexes and queries events, files, and global search data"
connection-manage-api                      -> connection-elasticsearch "Queries global search index for manage-scoped searches"
connection-worker-events-elastic           -> connection-elasticsearch "Writes event records to search index"
connection-worker-search-index             -> connection-elasticsearch "Maintains global search index"
connection-cronjob-delete-events-indices   -> connection-elasticsearch "Deletes old events indices"
connection-cronjob-roll-elastic-events-index -> connection-elasticsearch "Rolls active events index"
connection-worker-triggers                 -> queue-public-api "Creates component jobs via Queue API (table trigger fired)"
connection-manage-api                      -> sandboxes        "Updates sandbox credentials during BYODB migrations and Snowflake hostname changes (CLI commands)"
