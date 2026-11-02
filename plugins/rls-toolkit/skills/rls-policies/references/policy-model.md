# Policy model

The authoritative grammar is the JSON schema of the metastore object type (`rls-policy`,
`cls-policy`; schema 1.2.0 is the default, a stack may still serve 1.1.0). Compact reminder, for
generating rules:

- rls-policy: `{table, dialect?, rules[], default?}`; a rule is exactly one of `groups` / `subjects`
  plus `condition`: `{column, op, value}` (eq ne gt gte lt lte), `{column, op, values}` (in, not_in),
  `{column, op}` (is_null, is_not_null), `and`/`or` of two or more, `{"true":true}`,
  `{"false":true}`. No `not`, no free SQL. `value` may be `{"$identity":"email"}`, `values`
  `{"$identity":"groups"}` (a reader without a verified email is refused on the first: an ordinary
  reader then reads no rows).
- cls-policy: `{table, dialect?, rules[]}`; a rule is `{groups|subjects, visible_columns[]}`; no
  `default`: a reader that matches no rule is refused on the table.
- `table` is the Storage id `<stage>.<bucket>.<table>`. `dialect` is optional: omit it unless the
  policy is meant for one backend, because a policy whose dialect differs from the workspace's
  refuses reads of that table.
- Rule values are literals: Query Service escapes them into the rewritten SQL, it does not bind them
  as query parameters. Identifiers (`table`, `column`) are validated by pattern.

```json
{
  "table": "in.c-sales.orders",
  "rules": [
    {"groups": ["sales-eu"], "condition": {"column": "region", "op": "eq", "value": "EU"}},
    {"groups": ["sales-us"], "condition": {"column": "region", "op": "eq", "value": "US"}},
    {"groups": ["sales-managers"], "condition": {"true": true}}
  ],
  "default": {"false": true}
}
```

```json
{
  "table": "in.c-sales.orders",
  "rules": [
    {"groups": ["sales-eu", "sales-us"], "visible_columns": ["id", "region", "amount"]},
    {"groups": ["sales-managers"], "visible_columns": ["id", "region", "amount", "margin"]}
  ]
}
```

## policy-binding

`{"kid": "KID:<stack>[:branch-N]:project-<id>:workspace-<wsId>", "rlsPolicyUUIDs": [...],
"clsPolicyUUIDs": [...]}`: at least one list, 1-100 unique UUIDs each. A workspace without a binding
gets every policy of the project; a list that is absent contributes none, so a binding of only
`clsPolicyUUIDs` refuses every table. The operator writes the binding of a data app's workspace;
any other governed workspace needs one written by whoever creates it.

## Who may do what

- Create, update, delete a `targeted` policy of the own project: a project admin (see the
  prerequisites in the skill for the exact roles).
- Grants (target projects) and `organization` scope: an organization admin only (403 otherwise). An
  organization policy is loaded by every project of the organization on any backend: prefer
  `targeted`. A runtime that cannot set a scope always writes project policies.
