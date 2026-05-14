# Cloud resource relationships for metastore-service
# Included at top level of model block in model.dsl

metastore-api -> postgresql-instance "persists metadata objects and refs (metastore_service database)"
