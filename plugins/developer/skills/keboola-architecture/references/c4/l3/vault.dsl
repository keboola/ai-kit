# L3 inter-service relationships for vault
# Included inside keboolaPlatform block in model.dsl

vault-api                                  -> connection "verifies tokens and records Storage audit events via Storage API"
vault-messenger-consumer-connection-events -> connection "receives devBranchDeleted events published by Connection (async, via cloud queue)"
