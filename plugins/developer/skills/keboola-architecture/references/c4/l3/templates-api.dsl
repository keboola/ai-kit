# L3 inter-service relationships for templates-api
# Included inside keboolaPlatform block in model.dsl

templates-api -> connection          "verifies tokens, reads and writes project configurations via Storage API"
templates-api -> templates-api-etcd  "uses for distributed locking to ensure write atomicity"
