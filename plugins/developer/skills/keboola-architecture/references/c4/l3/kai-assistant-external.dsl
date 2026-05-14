# Cloud resource relationships for kai-assistant
# Included at top level of model block in model.dsl
# Covers three deployed apps: kai-app-ai-chat, kai-app-kai-assistant, kai-app-kai-agent

# PostgreSQL -- shared instance, separate database per app
kai-app-ai-chat       -> postgresql-instance "persists chat history and app data (ai_chat database)"
kai-app-kai-assistant -> postgresql-instance "persists conversation history and app data (kai_assistant database)"
kai-app-kai-agent     -> postgresql-instance "persists agent run history and app data (kai_agent database)"

# Object storage -- service-owned per-app buckets (same resource IDs used for all three apps)
kai-app-ai-chat       -> s3-bucket-ai-chat-storage  "stores uploaded files and artifacts on AWS stacks"
kai-app-ai-chat       -> abs-ai-chat-storage         "stores uploaded files and artifacts on Azure stacks"
kai-app-ai-chat       -> gcs-ai-chat-storage         "stores uploaded files and artifacts on GCP stacks"

kai-app-kai-assistant -> s3-bucket-ai-chat-storage  "stores uploaded files and artifacts on AWS stacks"
kai-app-kai-assistant -> abs-ai-chat-storage         "stores uploaded files and artifacts on Azure stacks"
kai-app-kai-assistant -> gcs-ai-chat-storage         "stores uploaded files and artifacts on GCP stacks"

kai-app-kai-agent     -> s3-bucket-ai-chat-storage  "stores agent artifacts and code outputs on AWS stacks"
kai-app-kai-agent     -> abs-ai-chat-storage         "stores agent artifacts and code outputs on Azure stacks"
kai-app-kai-agent     -> gcs-ai-chat-storage         "stores agent artifacts and code outputs on GCP stacks"

# GCP KMS -- used only to encrypt GCS buckets at rest (GCP stacks only, no AWS/Azure equivalent)
kai-app-ai-chat       -> kms-key-ai-chat-gcp        "GCS bucket encrypted with service-owned KMS key on GCP stacks"
kai-app-kai-assistant -> kms-key-ai-chat-gcp        "GCS bucket encrypted with service-owned KMS key on GCP stacks"
kai-app-kai-agent     -> kms-key-ai-chat-gcp        "GCS bucket encrypted with service-owned KMS key on GCP stacks"

# Cloud LLM -- provider varies by cloud stack (Vertex on AWS+GCP, Azure AI Foundry on Azure)
kai-app-ai-chat       -> google-vertex-ai   "calls Claude model via Vertex AI on AWS and GCP stacks"
kai-app-ai-chat       -> azure-ai-foundry   "calls Claude model via Azure AI Foundry on Azure stacks"

kai-app-kai-assistant -> google-vertex-ai   "calls Claude model via Vertex AI on AWS and GCP stacks"
kai-app-kai-assistant -> azure-ai-foundry   "calls Claude model via Azure AI Foundry on Azure stacks"

kai-app-kai-agent     -> google-vertex-ai   "calls Claude model via Vertex AI on AWS and GCP stacks"
kai-app-kai-agent     -> azure-ai-foundry   "calls Claude model via Azure AI Foundry on Azure stacks"

# E2B -- kai-agent only
kai-app-kai-agent     -> e2b               "executes sandboxed Python/JS code via E2B code interpreter"
