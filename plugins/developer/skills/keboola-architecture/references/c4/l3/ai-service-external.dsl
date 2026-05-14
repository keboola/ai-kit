# Cloud resource relationships for ai-service
# Included at top level of model block in model.dsl

ai-api           -> azure-openai-ai-service      "generates LLM responses and embeddings"
ai-api           -> mysql-instance-job-queue      "persists application data (shares job-queue MySQL instance)"
ai-api           -> kms-key-ai-aws               "encrypts data at rest on AWS stacks"
ai-api           -> kms-key-ai-azure             "encrypts data at rest on Azure stacks"
ai-api           -> kms-key-ai-gcp              "encrypts data at rest on GCP stacks"
ai-api           -> storage-ai-vectorstore-aws    "stores and reads vector index on AWS stacks"
ai-api           -> storage-ai-vectorstore-azure  "stores and reads vector index on Azure stacks"
ai-api           -> storage-ai-vectorstore-gcp    "stores and reads vector index on GCP stacks"

ai-index-builder -> azure-openai-ai-service      "generates embeddings for vector index rebuild"
ai-index-builder -> storage-ai-vectorstore-aws    "writes rebuilt vector index on AWS stacks"
ai-index-builder -> storage-ai-vectorstore-azure  "writes rebuilt vector index on Azure stacks"
ai-index-builder -> storage-ai-vectorstore-gcp    "writes rebuilt vector index on GCP stacks"
