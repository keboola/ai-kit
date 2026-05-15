# L3 inter-service relationships for stream
# Included inside keboolaPlatform block in model.dsl

stream-api                    -> connection "validates tokens and reads stream/sink configurations via Storage API"
stream-storage-coordinator    -> connection "imports staged files into Keboola Storage tables"
stream-storage-writer         -> connection "uploads encoded data slices to Storage staging files"
stream-storage-reader         -> connection "reads staged slices for upload to Storage"

# Internal cluster coordination
stream-api                    -> stream-etcd "uses for distributed node coordination, task locking, and state machine"
stream-http-source            -> stream-etcd "uses for distributed node registration and slice routing"
stream-storage-coordinator    -> stream-etcd "uses for file/slice lifecycle state machine"
stream-storage-writer         -> stream-etcd "uses for slice state and statistics sync"
stream-storage-reader         -> stream-etcd "uses for slice state and statistics sync"
