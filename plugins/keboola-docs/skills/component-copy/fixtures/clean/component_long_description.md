Tables and query results from your Impala warehouse land in Storage as CSV tables, one per configured query.

### Before you start

- Account and plan: An Impala cluster you can reach; no Keboola add-on needed.
- Access: Username and password for the cluster.
- Permissions: Read access to the schemas you want to load.
- Network: Allow-list Keboola's IP addresses for your stack, or use an SSH tunnel. SSL is supported.
- Set up first: None.

Loading is incremental when a primary key is configured; otherwise each run replaces the table.

See the [Impala documentation](https://impala.apache.org/docs/) for dialect limits.
