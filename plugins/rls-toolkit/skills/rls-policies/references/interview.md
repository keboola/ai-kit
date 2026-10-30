# Interview script (questions only)

Mechanics, dry-run, apply, bind and close-out are in `commands/rls-build.md`. Ask with AskUserQuestion,
propose a default and ask only for corrections, group tables that share a dimension column, and batch
up to four questions per call (for example rows, columns and default of one table cluster). Look up
`storage table-detail` and sample values for all tables in parallel, not table by table. Show what
discovery already found instead of asking for it.

1. **Where is it enforced?** A data app (which one: list the apps), the MCP workspace, another
   governed workspace, or several. For an app, run `data-app-discovery.md` first and show the
   preconditions; when one fails, offer the exact fix and do not continue until the app can be governed.
2. **Who are the readers?**
   - OIDC/JumpCloud: "Which group strings does your IdP send for the users of this app?" Offer `["*"]`
     for everyone signed in. Case-sensitive; Entra sends ids unless configured.
   - GitHub or no groups: only `["*"]` or a few named `subjects` (`<idp>|<login>`); logins can change hands.
   - Administrators: do they need access? A `keboola|<user id>` subject or a group.
3. **Which tables?** The candidate list; the user removes and adds. Per table: restrict rows,
   columns, or both?
4. **Row rules** per table. Suggest from the columns and a sample of distinct values (only with a read
   query the user agrees to; never write sampled data into files): a dimension column (`region`,
   `country`, `owner`, `org_id`, `tenant`, `team`, `department`) as "group A sees X, group B sees Y";
   an ownership column holding an email as an `$identity` rule (readers without a verified email are
   refused: is that acceptable?); managers or auditors as `{"true":true}`. Ask the default; recommend
   `{"false":true}`.
5. **Column rules** per table. Suggest PII-like columns by name (`email`, `phone`, `birth`, `ssn`,
   `salary`, `margin`, `address`, `iban`): which groups may see them. A table with a cls-policy also
   needs an rls-policy, and the app does not apply a cls-policy yet.
6. **Scope.** `targeted` (this project) unless the user brings up grants or organization scope; then
   say it needs an organization admin and an organization policy affects every project on every backend.
7. **Summary.** Hand over to `/rls-build` step 4 (dry-run summary, "go").
