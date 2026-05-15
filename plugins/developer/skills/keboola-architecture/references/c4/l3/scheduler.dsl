# L3 inter-service relationships for scheduler
# Included inside keboolaPlatform block in model.dsl

scheduler-api  -> connection "verifies tokens and reads/writes schedule configurations via Storage API"
scheduler-cron -> connection "verifies tokens via Storage API"
scheduler-cron -> queue      "triggers scheduled jobs"
