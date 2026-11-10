# Policy model

The authoritative grammar is the JSON schema of the metastore object type (`rls-policy`,
`cls-policy`; schema 1.2.0 is the default, 1.3.0 adds the `attributes` selector, a stack may still
serve 1.1.0). Compact reminder, for generating rules:

- rls-policy: `{table, dialect?, rules[], default?}`; a rule is exactly one of `groups` / `subjects` /
  `attributes` (schema 1.3.0 only, below) plus `condition`: `{column, op, value}` (eq ne gt gte lt lte), `{column, op, values}` (in, not_in),
  `{column, op}` (is_null, is_not_null), `and`/`or` of two or more, `{"true":true}`,
  `{"false":true}`. No `not`, no free SQL. `value` may be `{"$identity":"email"}`, `values`
  `{"$identity":"groups"}` (a reader without a verified email is refused on the first: an ordinary
  reader then reads no rows).
- Ranges: `gt`/`gte`/`lt`/`lte` on an untyped table compare text, because Query Service writes the value
  as a string literal (`"col" >= '2'`), so `'10' < '2'` and a numeric range silently drops rows. Use
  `eq`/`in`, or ranges only on typed numeric or date columns.
- cls-policy: `{table, dialect?, rules[]}`; a rule is `{groups|subjects|attributes, visible_columns[]}`; no
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

## The `attributes` selector (schema 1.3.0)

```json
{
  "table": "in.c-sales.orders",
  "rules": [
    {
      "attributes": {"department": ["finance", "hr"]},
      "issuers": ["https://idp.example.com"],
      "condition": {"column": "department", "op": "in", "values": ["finance", "hr"]}
    },
    {"groups": ["sales-managers"], "condition": {"true": true}}
  ],
  "default": {"false": true}
}
```

- `attributes` maps a claim name to its accepted values: a reader matches when it has, for EVERY claim,
  one of the listed values (values of one claim are alternatives, claims are all required). Exact,
  case-sensitive; at most 16 claims, 32 values per claim, 1024 characters per value; no wildcard; a claim
  named like a claim of the token itself (`sub`, `email`, `groups`, `iss`, ...) is refused. Keep the
  values short: the claims reach Query Service in a token of at most 8 KB shared with the groups, so a
  claim that does not fit is dropped for that reader and a rule on it never matches them.
- `issuers` is required with `attributes` and not allowed with another selector: the issuer URLs of the
  identity providers the rule trusts (1-16). An attribute is only as trustworthy as the provider that
  asserts it, and the owner of a data app chooses the provider.
- A policy is created on schema 1.3.0 when a rule uses `attributes`; a policy created earlier (1.2.0)
  keeps its schema and cannot take the rule: create a new policy (delete the old one, unbind it first).
  1.2.0 stays the default for policies without the selector.
- A reader whose attribute is unknown (the claim is not in the ID token, not in the app's
  `attribute_claims`, or a Storage token or MCP caller) matches no `attributes` rule, and gets no
  `default` of a policy that has an `attributes` rule of its issuer: the read is refused, an ordinary
  reader reads no rows. A reader of another issuer is outside the rule and gets the `default`.
- A value changes in the IdP only when the user signs in again: the app's session lifetime is the delay.
  Use attributes the IdP admin controls, never a profile field the user can edit.

## policy-binding

`{"kid": "KID:<stack>[:branch-N]:project-<id>:workspace-<wsId>", "rlsPolicyUUIDs": [...],
"clsPolicyUUIDs": [...]}`: at least one list, 1-100 unique UUIDs each. A workspace without a binding
gets every policy of the project (a governed workspace that is not a data app: a data app's
workspace always has a binding, its `rlsPolicies` list, and an app without the list is not governed at
all); a list that is absent contributes none, so a binding of only `clsPolicyUUIDs` opens the tables of
those cls-policies for the readers they name and refuses every other table. The operator writes the binding of a data app's workspace; any other governed workspace needs
one written by whoever creates it.

## Who may do what

- Create, update, delete a `targeted` policy of the own project: a project admin (see the
  prerequisites in the skill for the exact roles).
- Grants (target projects) and `organization` scope: an organization admin only (403 otherwise). An
  organization policy is loaded by every project of the organization on any backend: prefer
  `targeted`. A runtime that cannot set a scope always writes project policies.
