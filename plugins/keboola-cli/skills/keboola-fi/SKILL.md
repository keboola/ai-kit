---
name: keboola-fi
description: Use this skill for financial intelligence context in Keboola projects. Activates when reviewing P&L, Balance Sheet, KPI calculations, COA mapping, multi-ERP data structures, or budget variance analysis.
allowed-tools: ['*']
---

# Financial Intelligence Context

Financial domain knowledge for Keboola project reviews. Used by `kbc-financial-analyst` and `kbc-template-readiness` agents when `--fi` flag is passed to `/kbc-review`.

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
