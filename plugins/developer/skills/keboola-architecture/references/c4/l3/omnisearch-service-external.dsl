# Cloud resource relationships for omnisearch-service
# Included at top level of model block in model.dsl

omnisearch-service-api       -> azure-openai-ai-service "LLM and embeddings for lineage analysis using shared Azure OpenAI deployment"
omnisearch-metastore-builder -> azure-openai-ai-service "LLM and embeddings for lineage analysis using shared Azure OpenAI deployment"

omnisearch-service-api       -> storage-omnisearch-metastore-aws   "reads metastore files on AWS stacks"
omnisearch-service-api       -> storage-omnisearch-metastore-azure "reads metastore files on Azure stacks"
omnisearch-service-api       -> storage-omnisearch-metastore-gcp   "reads metastore files on GCP stacks"

omnisearch-metastore-builder -> storage-omnisearch-metastore-aws   "writes metastore files on AWS stacks"
omnisearch-metastore-builder -> storage-omnisearch-metastore-azure "writes metastore files on Azure stacks"
omnisearch-metastore-builder -> storage-omnisearch-metastore-gcp   "writes metastore files on GCP stacks"
