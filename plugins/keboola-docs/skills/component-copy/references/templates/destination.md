# Template: data destination connector (`destination/*` buckets)

Section headings below are the **exact `component_config/` file names**, so the mapping to
`scripts/developer_portal/update_properties.sh` is 1:1 and nothing has to be remembered.

Every rule here is a restatement of docs that already exist — cite them in the PR body, do
not invent conventions:
- `src/content/docs/extend/publish/index.md` § Component Name and Description, § Component Configuration
- `src/content/docs/extend/publish/checklist/index.md`
- `src/content/docs/extend/component/ui-options/configuration-schema/index.md`

Placeholders are `{{snake_case}}`. Fill them **only** from what already exists: the current
portal copy, the repo README, the config schema, and the linked service documentation. No new
factual claims. Anything you cannot source gets `VERIFY(owner)` inline, never a guess.

**A template is a checklist, not a form.** A placeholder you cannot source is omitted
entirely — never padded to one thin sentence per slot. A page where every section holds one
boilerplate line reads as machine filler and erodes trust in the whole catalog (benchmark:
Fivetran's "Lite" connector shells are the anti-pattern). If the component is **beta or
deprecated**, that status opens the long description — a reader deep-linked to the component
must see lifecycle state on the page itself, not only on a catalog badge.

## What every component always has (house rules, agreed 2026-11-12)

Four things are never left out, whatever the sources say; the linter fails a component without them:

1. **`### Before you start`** in the long description of every connector: Account and plan,
   Access, Permissions, Network, Set up first. All five, in that order; "not needed" is written
   out, unknown is `VERIFY(owner)`.
2. **Load behaviour** in the long description of every connector, in fixed phrasing and
   including the negative. Unknown → `VERIFY(owner)` and the PR waits for the answer.
3. **A configuration description**, at least a minimal one: where the credentials or access
   come from, and what the first run produces. Gotchas on top when they exist.
4. **Images only from `https://help.keboola.com/`.** The file goes into keboola/connection-docs
   `public/` and the copy uses its absolute URL. No other host, no README-relative path.

Everything else below is "state it when a source has it, omit it when not".

## component_short_description.md

```
{{service_one_liner}}
```

- Describes **the service** the data is being sent to, so a user scanning the catalog
  recognises it — not the component, and never the mechanism.
  OK: *"Cloud data warehouse for analytics at scale"*.
  WRONG: *"This writer writes tables to Snowflake"*.
- No `extractor` / `writer` / `application` as a self-reference.
- One sentence.

## component_long_description.md

```
{{what_lands_in_the_target}}

### Before you start

- Account and plan: {{account_and_plan}}
- Access: {{access}}
- Permissions: {{permissions}}
- Network: {{network}}
- Set up first: {{set_up_first}}

{{load_behaviour}}

{{resource_links}}
```

- `what_lands_in_the_target` — what the target system ends up holding: tables, objects, files,
  and under what naming.
- `### Before you start` — **always present, all five items, in this order and with these
  labels** (house rule, 2026-11-12), so a reader can compare components and tell "not needed"
  from "not written". An item that does not apply says so in fixed phrasing ("No paid plan
  needed.", "None.", "No network setup needed."). An item no source answers gets
  `VERIFY(owner)`; never drop it.
  - `account_and_plan` — the account the user needs and any paid plan, edition or external
    approval.
  - `access` — how Keboola authenticates (OAuth, token, API key, username and password) and who
    issues it.
  - `permissions` — the **write** permission the credentials need, named as the target system names it.
  - `network` — whether the user must allow-list Keboola's IP addresses, open a port or use an
    SSH tunnel. For databases this is the usual reason a connection fails; for a public cloud API
    it is "No network setup needed."
  - `set_up_first` — any object that must exist before the first run (database, schema, dataset, bucket, table). This is the line most destination connectors get wrong by omitting.
- `load_behaviour` — full load versus incremental/upsert, and what happens to rows already
  there. Say it plainly; this is the field users are burned by. **Always present**: state it in
  the fleet's fixed phrasing **including the negative**, and where no source answers it write
  `VERIFY(owner)` rather than guess or omit (*"Upsert is not supported; existing rows are replaced."*). An
  explicit no beats silence (benchmark: Fivetran's fixed feature-matrix vocabulary; its flaw
  is blank cells where "No" should be).
- `resource_links` — the target service's own documentation on limits and quotas.
- **Never configuration instructions.** This text is shown *before* the user starts
  configuring.

## configuration_description.md

```
{{where_access_comes_from}} {{what_the_first_run_produces}}

{{non_trivial_setup_notes}}
```

- **Always present.** The minimum is one to three sentences: where the destination credentials
  and the write permission come from, and what the first run creates or changes in the target.
  Add setup notes only where the configuration is not self-explanatory.
- Must **not** start with a header (the UI prepends a level-2 one) and may use only `###` and
  `####`.
- Must not repeat what Configuration and Row schema already make obvious.

## configSchema.json / configRowSchema.json

Not rewritten in the first cut — the gap-fill phase reports on these and touches nothing.
When it is enabled, only these leaves may change: `title`, `description`,
`options.tooltip`, `options.documentation`, `options.enum_titles`.

The UI shows `title` as the label, `description` under the field, and `options.tooltip` behind
an info icon. Short text in the form, the detail one click away: that is the shape the owner
asked for. `keboola.ex-medallia`'s schemas are the worked example (its connection and row
fields; not its short or long description, which describe the component). A Medallia-shaped
row schema is `fixtures/clean/configRowSchema.json`.

- `title`: the field's name, sentence case, no trailing colon or period, under ~40 characters.
- `description`: one short line saying what goes in the field ("The API address for your
  instance"), only where the title is not self-evident. No instructions, no links.
- `options.tooltip` (Markdown): the how and the why. Where the value comes from (who issues
  it, where in the service's UI), an example value in backticks, what happens if it is left
  empty, and the gotcha a user would otherwise hit ("test/sandbox instances use a different
  address"). Two to four sentences.
- Link to documentation from the tooltip, or with `options.documentation` `{link, tooltip}`,
  whenever the field takes a value whose grammar lives elsewhere: a query or filter language,
  an API object name, a date expression, a cron string. Link the service's own page for the
  grammar, not a search result.
- `options.enum_titles`: human labels for every `enum` value, same length and order ("Guided
  (pick an object)", not `structured`).
- Secrets (`#`-prefixed keys) say in the tooltip who issues them and that they are stored
  encrypted.
- Every property carries `propertyOrder` and a `type`; every name in `required` exists under
  `properties`.

## documentationUrl.md

One `https://` URL, nothing else. It points at the component repo's README unless a help page
for the component is actually maintained (rule agreed with the owner, 2026-08-17; dead links
are PRDCT-648, not a copy PR).

## Per-kind notes

**ERP systems** (`destination/saas-api` today): see the ERP note in `source.md`; the same
questions apply (which modules or document types it writes, cloud API or on-premise).

**`destination/database`** — say whether the component can provision the target database or
requires an existing one, and name the write modes (append, replace, upsert) that exist.
Credentials sentence names the exact grant the user must hand over.

**`destination/file-storage`** — say which formats are produced, how paths are composed, and
whether existing objects are overwritten. Name the exact permission (bucket write, folder
share).

**`destination/saas-api`** — name the API version or product edition, the object types that can
be written, and any rate limit or batch cap the user will hit. If the API rejects partial
batches, say so.
