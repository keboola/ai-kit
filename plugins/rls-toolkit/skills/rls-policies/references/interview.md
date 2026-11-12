# Interview script (questions only)

Mechanics (dry-run, apply, bind, close-out) belong to whatever runs the interview (the `/rls-build`
command). Ask with the runtime's question tool where there is one (Claude Code: AskUserQuestion),
propose a default and ask only for corrections, group tables that share a dimension column, and batch
up to four questions per call (for example rows, columns and default of one table cluster). Look up
the columns and sample values of all candidate tables in one go, not table by table. Show what
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
   an ownership column holding an email as an `$identity` rule (readers without a verified email get
   no rows: is that acceptable?); managers or auditors as `{"true":true}`. Ask the default; recommend
   `{"false":true}`. Use range conditions (`gt`..`lte`) only on typed numeric or date columns, `eq`/`in`
   otherwise (`policy-model.md`).
5. **Column rules** per table. Suggest PII-like columns by name (`email`, `phone`, `birth`, `ssn`,
   `salary`, `margin`, `address`, `iban`): which groups may see them. A cls-policy alone gives the
   readers it names all rows of the table: add an rls-policy to limit them, and bind the cls-policy in
   `runtime.workspace.clsPolicies`.
6. **Scope**, only when the runtime can set one. `targeted` (this project) unless the user brings up
   grants or organization scope; then say it needs an organization admin and an organization policy
   affects every project on every backend. A runtime without a scope option writes project policies
   and skips this question.
7. **Summary.** A table of what will be written (table, kind, selector and condition or columns,
   default, create or replace). Mark every rule that widens access: a `["*"]` selector,
   `{"true":true}`, an administrator rule, a `default` that is not `{"false":true}`. Then wait for an
   explicit "go".
