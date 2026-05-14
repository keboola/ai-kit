# L3 inter-service relationships for ai-service
# Included inside keboolaPlatform block in model.dsl

ai-api           -> connection "reads/writes storage, verifies tokens via Storage API and Manage API"
ai-api           -> queue      "submits component jobs"
ai-api           -> stream     "records prompts and feedback (PROMPT_RECORD_URL / FEEDBACK_RECORD_URL)"
ai-agent         -> ai-api     "calls for context and responses via localhost"
ai-index-builder -> connection "reads project data and configurations to build vector index"
