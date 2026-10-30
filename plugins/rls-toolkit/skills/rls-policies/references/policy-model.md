# Policy model (schema 1.2.0)

Authoritative grammar: `kbagent --json rls schema --project P` (and `cls schema`). A stack may
still serve 1.1.0: read the schema first. Flags and output shapes: the `kbagent` plugin,
the `rls-workflow` reference of the kbagent skill.

## rls-policy

```json
{
  "table": "in.c-sales.orders",
  "dialect": "snowflake",
  "rules": [
    {"groups": ["sales-eu"], "condition": {"column": "region", "op": "eq", "value": "EU"}},
    {"groups": ["sales-us"], "condition": {"column": "region", "op": "eq", "value": "US"}},
    {"groups": ["sales-managers"], "condition": {"true": true}}
  ],
  "default": {"false": true}
}
```

- `table`: Storage id `<stage>.<bucket>.<table>`. `dialect`: `snowflake` or `bigquery`, defaults to
  the project backend (kbagent refuses another value).
- `rules`: at least one. Each rule has exactly one of `groups` (IdP group strings) or `subjects`
  (`<idp>|<sub>`, the IdP issuer without a trailing `/`, a `|`, the user's `sub`), plus `condition`.
  `["*"]` in either list is every signed-in reader and must be the only entry.
- `default`: condition for a signed-in reader that no rule matches. Absent = refused with an error.
  `{"false": true}` = no rows. A default cannot be removed later by `rls update` (recreate the policy).
- Condition shapes (no free SQL, no `not`):
  - comparison `{"column","op","value"}` with `eq ne gt gte lt lte`
  - membership `{"column","op","values":[...]}` with `in not_in`
  - null checks `{"column","op"}` with `is_null is_not_null` (the only way to match null)
  - `{"and":[c1,c2,...]}`, `{"or":[c1,c2,...]}` (two or more)
  - `{"true":true}` (everything, for example managers), `{"false":true}` (nothing)
  - `value` may be `{"$identity":"email"}` and `values` may be `{"$identity":"groups"}`: resolved per
    reader. A reader without a verified email is refused on `$identity.email`.
- Column names match `^[A-Za-z0-9_]+$` and are case-exact.

## cls-policy

```json
{
  "table": "in.c-sales.orders",
  "dialect": "snowflake",
  "rules": [
    {"groups": ["sales-eu", "sales-us"], "visible_columns": ["id", "region", "amount"]},
    {"groups": ["sales-managers"], "visible_columns": ["id", "region", "amount", "margin", "customer_email"]}
  ]
}
```

No `default`: a reader that matches no rule is refused on the table. A cls-policy alone grants no
rows: the table also needs an rls-policy. Several cls-policies on a table intersect.

## policy-binding

`{"kid": "KID:<stack>[:branch-N]:project-<id>:workspace-<wsId>", "rlsPolicyUUIDs": [...],
"clsPolicyUUIDs": [...]}`; at least one list, 1-100 unique UUIDs each. A list that is absent
contributes no policy of that kind. A workspace without a binding gets every policy of the
project. The object name equals the kid. Written by the operator for a data app and by
`kbagent rls bind` for any other governed workspace. A binding of only `clsPolicyUUIDs` refuses
every table (no rls-policy).

## Who may do what

- Create/update/delete a `targeted` policy of the own project: project admin.
- `--target-project` grants and `--scope organization`: organization admin only (403 otherwise).
  An organization policy is loaded by every project of the organization on any backend, so
  prefer `targeted`.
- `--scope project` does not exist for policies.
