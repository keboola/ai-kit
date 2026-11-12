Tables and query results from your Impala warehouse land in Storage as CSV tables, one per configured query. SSL and SSH tunnels are supported.

Loading is incremental when a primary key is configured; otherwise each run replaces the table.

See the [Impala documentation](https://impala.apache.org/docs/) for dialect limits.
