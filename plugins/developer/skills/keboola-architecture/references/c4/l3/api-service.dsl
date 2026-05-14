# L3 inter-service relationships for api-service
# Included inside keboolaPlatform block in model.dsl
#
# The API Portal has NO runtime inter-service dependencies.
# It is a fully static SPA — OpenAPI specs are fetched from live services
# at Docker image build time (collector/collect.js) and bundled as static files.
# There are no server-side API calls at runtime.
