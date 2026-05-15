# L3 inter-service relationships for editor-service
# Included inside keboolaPlatform block in model.dsl

editor-api -> connection      "reads storage, verifies tokens, manages configs"
editor-api -> sandboxes       "provisions and manages workspaces"
editor-api -> query           "runs SQL queries and table previews"
editor-consumer -> connection "Receives connection events and audit log (async, via queue)"
editor-session-worker -> connection "polls workspace jobs and manages workspace lifecycle via Storage API"
