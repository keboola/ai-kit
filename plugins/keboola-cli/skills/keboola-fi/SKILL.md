---
name: keboola-fi
description: Use this skill for financial intelligence context in Keboola projects. Activates when the user asks to "review financial logic", "check P&L", "validate Balance Sheet", "audit COA mapping", "review KPI calculations", or mentions budget variance, multi-ERP data, financial transformations, or accounting standards in Keboola projects.
allowed-tools: ['*']
---

# Financial Intelligence Context

Financial domain knowledge for Keboola project reviews. Used by `kbc-financial-analyst`, `kbc-template-readiness`, and `kbc-fi-template-spec` agents when `--fi` flag is passed to `/kbc-review`.

## ERP Systems Supported

Financial review agents understand data structures from:
- NetSuite (GL, journal entries, subsidiaries)
- SAP S/4HANA / BW (BKPF/BSEG, cost centers, profit centers)
- Oracle Fusion / EBS (GL segments, ledgers, subledger accounting)
- Microsoft Dynamics 365 (financial dimensions, main accounts)
- QuickBooks / Xero (simplified COA, class tracking)

## Financial Metrics Covered

- Core P&L + Balance Sheet (Revenue, COGS, EBITDA, Net Income, Working Capital)
- SaaS metrics (MRR, ARR, Churn, LTV, CAC, NRR, Rule of 40)
- Cash flow (Operating CF, Free CF, DSO, DPO, DIO, Cash Conversion Cycle)
- Budget variance (Actual vs Budget, Forecast accuracy, YoY/MoM growth)

## COA Mapping Patterns

Common Chart of Accounts structures across ERP systems:
- Flat COA (QuickBooks/Xero): single-level account list with type classification
- Hierarchical COA (NetSuite/SAP): parent-child account tree with rollup levels
- Segmented COA (Oracle/D365): account + department + cost center segments
- Multi-entity: entity-scoped COA with cross-entity mapping for consolidation

Key validation: mapped account total must equal raw GL total (no silent drops).

## FI Naming Conventions

Recommended Keboola bucket/table naming for financial projects:
- Buckets: `in.c-fi-[source]`, `out.c-fi-staging`, `out.c-fi-core`, `out.c-fi-mart`
- Fact tables: suffix `_fact` (e.g., `journal_entries_fact`, `budget_fact`)
- Dimension tables: prefix `dim_` (e.g., `dim_account`, `dim_entity`, `dim_period`)
- Mapping tables: prefix `DC_` (e.g., `DC_ACCOUNT_MAPPING`, `DC_EXCHANGE_RATE`)

## Template Specification Patterns

When building a master FI template from a reference project:

- **Universal logic**: P&L cascade, BS balance check, journal entry validation, period aggregation -- these are the same for every client
- **Always parameterize**: COA hierarchy root, fiscal year start month, base currency, entity list, budget version names, GL account ranges
- **Required mapping tables**: DC_ACCOUNT_MAPPING (COA to standard categories), DC_EXCHANGE_RATE (currency pairs + rate types), DC_BUSINESS_UNIT (entity hierarchy), DC_METRIC (semantic layer definitions)
- **Source-agnostic staging**: template extractors should produce a standard staging schema regardless of ERP; staging-to-core transforms normalize ERP-specific structures
- **ER model FK conventions**: dimension PKs use `SRC_ID` suffix, fact FKs reference `[DIM_TABLE]_SRC_ID`, all relationships documented in DC_METRIC source_tables field
