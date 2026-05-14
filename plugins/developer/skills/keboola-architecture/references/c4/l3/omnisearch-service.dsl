# L3 inter-service relationships for omnisearch-service
# Included inside keboolaPlatform block in model.dsl

omnisearch-service-api       -> connection "verifies storage tokens; reads project and org data via Management API"
omnisearch-metastore-builder -> connection "collects project objects; creates storage tokens via Management API; uploads lineage metadata"
omnisearch-metastore-builder -> queue      "reads job history per configuration via QueueClient (URL derived from Storage API URL at runtime)"
