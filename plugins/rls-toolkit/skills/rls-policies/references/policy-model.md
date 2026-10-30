# Policy model

The live grammar is `kbagent --json rls schema|cls schema --project P` (a stack may serve an older
schema version: kbagent's `--dry-run` says so). Flags and combination rules: the `rls-workflow`
reference of the kbagent skill. Compact reminder, for generating rules:

- rls-policy: `{table, dialect?, rules[], default?}`; a rule is exactly one of `groups` / `subjects`
  plus `condition`: `{column, op, value}` (eq ne gt gte lt lte), `{column, op, values}` (in, not_in),
  `{column, op}` (is_null, is_not_null), `and`/`or` of two or more, `{"true":true}`,
  `{"false":true}`. No `not`, no free SQL. `value` may be `{"$identity":"email"}`, `values`
  `{"$identity":"groups"}` (a reader without a verified email is refused on the first).
- cls-policy: `{table, dialect?, rules[]}`; a rule is `{groups|subjects, visible_columns[]}`; no
  `default`: a reader that matches no rule is refused on the table.
- `table` is the Storage id `<stage>.<bucket>.<table>`, `dialect` defaults to the project backend.

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
`kbagent rls bind` writes it for any other governed workspace.

## Who may do what

- Create, update, delete a `targeted` policy of the own project: project admin.
- `--target-project` grants and `--scope organization`: organization admin only (403 otherwise). An
  organization policy is loaded by every project of the organization on any backend: prefer `targeted`.
