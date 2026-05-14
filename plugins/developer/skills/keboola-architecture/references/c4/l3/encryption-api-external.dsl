# Cloud resource relationships for encryption-api
# Included at top level of model block in model.dsl

encryption-api -> kms-key-job-runner-aws   "encrypts and decrypts configuration values on AWS stacks"
encryption-api -> kms-key-job-runner-azure "encrypts and decrypts configuration values on Azure stacks"
encryption-api -> kms-key-job-runner-gcp   "encrypts and decrypts configuration values on GCP stacks"
