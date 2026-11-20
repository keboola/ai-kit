# Template: data source connector (`source/*` buckets)

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

## What every component always has (house rules, agreed 2026-11-12 with the owner)

The linter fails a component without these:

1. **Load behaviour** in the long description of every connector, in fixed phrasing and
   including the negative. Unknown → `VERIFY(owner)` and the PR waits for the answer.
2. **`## Prerequisites` in the README** of every connector, five items in a fixed order:
   Account and plan, Access, Permissions, Network, Set up first. "Not needed" is written out,
   unknown is `VERIFY(owner)`. The owner wants prerequisites in the README, not in the copy the
   Keboola UI shows.
3. **No images in the copy the UI shows** (short, long, configuration description). Pictures go in
   the README, in the repo, as they always have.

Where each field shows (checked 2026-11-12 on components.keboola.com and in a Keboola project):

| Field | components.keboola.com | Keboola project |
|---|---|---|
| Short description | under the name | the card in Add New Component, and the dialog that creates a configuration |
| Long description | below the component's facts | on the component's page and on each configuration's page, inside the facts box once it is expanded (collapsed by default); not on the card, not in the create dialog |
| Configuration description | not shown | only on a configuration's page, in the "Configuration Description" panel (collapsed by default) |

So most users meet the short description first; the long one only when they open the collapsed
facts box. Images render in all of these places, the configuration description's included
(checked with a temporary configuration, 2026-11-12). The configuration description is optional; the owner would rather remove that field from
the UI than fill it, so leave it empty unless it already has text.

Everything else below is "state it when a source has it, omit it when not".

## component_short_description.md

```
{{service_one_liner}}
```

- Describes **the service**, so a user scanning the catalog recognises it — not the component,
  and never the mechanism. OK: *"Native analytic database for Apache Hadoop"*.
  WRONG: *"This extractor extracts data from Cloudera Impala"*.
- No `extractor` / `writer` / `application` as a self-reference.
- One sentence. For a large service, describe the part this component actually touches.

## component_long_description.md

```
{{what_the_user_gets}}

{{incremental_behaviour}}

{{resource_links}}
```

- `what_the_user_gets` — which objects, endpoints or reports land in Storage, and as what.
- `incremental_behaviour` — is loading incremental, and on what key. **Always present**: state it
  in the fleet's fixed phrasing **including the negative**, and where no source answers it write
  `VERIFY(owner)` rather than guess or omit (*"Incremental loading is not supported; every run is a
  full load."*). An explicit no beats silence: users compare components on exactly this line
  (benchmark: Fivetran's feature matrix works because the vocabulary is identical across ~700
  connectors; its one flaw is blank cells where "No" should be).
- `resource_links` — the service's own API/limits documentation.
- **Never configuration instructions.** This text is shown *before* the user starts
  configuring, so steps here have no context to land in.

## README.md: Prerequisites

Part of the same PR when the README lacks it or has it in another shape. Replace the README's
existing prerequisites section in place (keep any detail it has, such as a list of scopes, under
the matching item); never rewrite the rest of the README.

```
## Prerequisites

- Account and plan: {{account_and_plan}}
- Access: {{access}}
- Permissions: {{permissions}}
- Network: {{network}}
- Set up first: {{set_up_first}}
```

- **Always present in a connector's README, all five items, in this order and with these
  labels** (house rule, 2026-11-12; in the README on the owner's word), so a reader can compare components and tell "not needed"
  from "not written". An item that does not apply says so in fixed phrasing ("No paid plan
  needed.", "None.", "No network setup needed."). An item no source answers gets
  `VERIFY(owner)`; never drop it.
  - `account_and_plan` — the account the user needs and any paid plan, edition or external
    approval.
  - `access` — how Keboola authenticates (OAuth, token, API key, username and password) and who
    issues it.
  - `permissions` — the scopes, roles or read rights the credentials must carry.
  - `network` — whether the user must allow-list Keboola's IP addresses, open a port or use an
    SSH tunnel. For databases this is the usual reason a connection fails; for a public cloud API
    it is "No network setup needed."
  - `set_up_first` — anything the user creates or switches on in the service before configuring (an API app, a read replica, a setting).

## configuration_description.md

```
{{non_trivial_setup_notes}}
```

- **Optional; leave it empty** unless the component already has text here. The owner would
  rather remove the field from the UI than fill it (2026-11-12). Existing text is kept and must
  follow the rules below; images in it are removed (they go in the README).
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

**ERP systems** (`source/saas-api` and `destination/saas-api` today: Money S3, Oracle EBS,
Hyperion, POHODA and the like): name the modules or document types the connector reads, and
the deployment it reaches (cloud API, on-premise server through a gateway), because that is what
decides whether it works for the reader's install. Whether ERP becomes its own bucket is an open
question for the owner (classify.mjs open questions).

**`source/database`** — name the SQL dialect and the connection modes that exist (SSL, SSH
tunnel, read replica) in the long description, since they gate whether the user can connect at
all. Do not enumerate driver options; that is the schema's job.

**`source/file-storage`** — say which path/prefix conventions and file formats are supported,
and whether files are consumed once or re-read. Credentials sentence names the exact grant
(bucket read, delegated app permission).

**`source/saas-api`** — name the API version or product edition the component targets, and any
rate limit the user will actually hit. If authorisation is OAuth, say so — it changes what the
user has to prepare.
