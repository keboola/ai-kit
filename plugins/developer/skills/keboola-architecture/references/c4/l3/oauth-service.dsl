# L3 inter-service relationships for oauth-service
# Included inside keboolaPlatform block in model.dsl

oauth-service-api                                        -> connection "verifies tokens via Storage API; reads project and org data"
oauth-service-messenger-consumer-connection-events       -> connection "receives devBranchDeleted events published by Connection (async)"
