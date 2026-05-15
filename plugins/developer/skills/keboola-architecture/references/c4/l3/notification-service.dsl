# L3 inter-service relationships for notification-service
# Included inside keboolaPlatform block in model.dsl

notification-api                -> connection "verifies tokens and reads project/org data via Storage and Manage APIs"
notification-messenger-consumer -> connection "verifies tokens"
