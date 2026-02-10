# Review Standards Reference

Keboola data warehouse naming and architecture standards.
Agents: validate project against these rules. Flag violations per severity listed.

## 1. Architecture (validate: dwh-architect)

| Rule | Standard | Severity |
|------|----------|----------|
| 3-layer architecture | L0 (Staging), L1 (Integration/Aggregation), L2 (Datamarts) | HIGH |
| L0 project naming | L0-Staging or L0-Staging-[source_system_name] | HIGH |
| L1 project naming | L1-Integration or L1-Aggregation | HIGH |
| L2 project naming | L2-Presentation-[business_area] | HIGH |
| Layer separation | Data integration, consolidation, cleansing in L1 only | HIGH |
| No layer skipping | Transformations must not skip layers (e.g., L0 direct to L2) | HIGH |
| Master data management | Core data mastered in integration layer | MEDIUM |
| Data lineage | Clear overview of data flows, no repeated/orphan calculations | MEDIUM |

## 2. Bucket Naming (validate: dwh-architect, config-reviewer)

| Layer | Pattern | Example | Severity |
|-------|---------|---------|----------|
| L0 | L0-Staging-[source_system] | L0-Staging-Salesforce | HIGH |
| L0 (freq) | L0-Staging-[source]-[frequency] | L0-Staging-SAP-daily | MEDIUM |
| L1 | L1-Integration or L1-Aggregation | L1-Integration | HIGH |
| L1 (domain) | L1-Integration-[business_area] | L1-Integration-HR | MEDIUM |
| L2 | L2-[business_area] | L2-Finance | HIGH |
| L2 (sharing) | L2-[business_area]-[sharing_purpose] | L2-Finance-Shared | MEDIUM |
| L0 output prefix | OUT_ prefix for historization/cleansing output tables in L0 | -- | MEDIUM |

## 3. Component Naming (validate: config-reviewer)

| Type | Pattern | Example | Severity |
|------|---------|---------|----------|
| Extractor (In) | IN-[Source_System]-[Business_purpose]-[frequency] | IN-salesforce-client-daily | HIGH |
| Writer (Out) | OUT-[Target_System]-[Business_purpose]-[frequency] | OUT-snowflake-reporting-daily | HIGH |
| Transformation | [Target_Bucket]-[Target_Table]-[Source_Bucket]-[frequency] | L1-PARTY-L0-SAP-daily | HIGH |
| Flow | [Project_Name]-[Business_Area]-[Frequency] | L1-Integration-Finance-daily | HIGH |
| Flow count | Minimize number of flows (pricing model) | -- | MEDIUM |

## 4. Table Naming (validate: dwh-architect, sql-reviewer)

| Rule | Standard | Severity |
|------|----------|----------|
| Case | UPPERCASE (avoids Snowflake quoting) | HIGH |
| Spacing | Underscores, no spaces or special chars | HIGH |
| Singular | Singular names (PARTY not PARTIES) | MEDIUM |
| No acronyms | Prefer full words unless widely known | MEDIUM |
| Fact suffix | _F for fact tables | HIGH |
| History suffix | _H for history/SCD tables | HIGH |
| Reference suffix | _REF for reference/list-of-values tables | HIGH |
| Relational suffix | _REL for relational/bridge tables | HIGH |
| Keboola prefix alt | FT_, DIM_, STG_, RAW_, RPT_, DC_ also acceptable | MEDIUM |

## 5. Column Naming (validate: sql-reviewer, dwh-architect)

| Rule | Standard | Severity |
|------|----------|----------|
| Case | UPPERCASE | HIGH |
| Singular | Singular names | MEDIUM |
| Spacing | Underscores only | HIGH |
| Date suffix | _D for dates | MEDIUM |
| DateTime suffix | _DT for timestamps | MEDIUM |
| Amount suffix | _AMT for monetary amounts | MEDIUM |
| Identifier suffix | _ID for identifiers | HIGH |
| Description suffix | _DESCR for descriptions | MEDIUM |
| Code suffix | _CD for codes | MEDIUM |
| Number suffix | _NUM for numbers | MEDIUM |

## 6. Primary Keys & Foreign Keys (validate: sql-reviewer, config-reviewer, data-quality)

| Rule | Standard | Severity |
|------|----------|----------|
| PK required | Every table must have a primary key | HIGH |
| PK on SRC_ID | PK includes SRC_ID column (composite: SRC_SYS_ID.[SOURCE_TABLE].UNIQUE_VALUES) | HIGH |
| PK not nullable | PK columns must not be NULL | CRITICAL |
| FK naming | [Referenced_TABLE]_SRC_ID | HIGH |
| FK referential integrity | Every FK must reference an existing PK | HIGH |

## 7. Technical Columns (validate: sql-reviewer, dwh-architect)

Required columns per table type (x = required, X = mandatory):

| Column | Code | Stage | Dimension | Fact | Transactional | History |
|--------|------|-------|-----------|------|---------------|---------|
| SRC_ID | -- | -- | x | x | x | x |
| SRC_SYS_ID | -- | -- | x | x | X | x |
| SNAP_D | -- | x | -- | x | -- | -- |
| INS_DT | -- | x | x | x | X | x |
| UPD_DT | -- | x | x | x | X | x |
| INS_JOB_ID | -- | x | x | x | X | x |
| UPD_JOB_ID | -- | x | x | x | X | x |
| DEL_FLAG | -- | -- | x | -- | -- | x |
| ROW_4_DEL | -- | x | -- | x | x | -- |
| START_D | -- | -- | -- | -- | -- | x |
| END_D | -- | -- | -- | -- | -- | x |

Severity: Missing mandatory (X) = CRITICAL, missing recommended (x) = HIGH

## 7a. Slowly Changing Dimensions (validate: dwh-architect, sql-reviewer, data-quality)

| Rule | Standard | Severity |
|------|----------|----------|
| SCD candidates identified | Dimensions with mutable attributes need SCD strategy | HIGH |
| Type 2 tables use _H suffix | History tables named TABLE_H with START_D, END_D | HIGH |
| No overlapping date ranges | For each business key, date ranges must not overlap | CRITICAL |
| No gaps in date ranges | END_D of previous row = START_D of next row (or day before) | HIGH |
| Current row marker | CURRENT_FLAG or END_D = '9999-12-31' for active record | MEDIUM |
| Change detection | CHANGE_HASH or column-level comparison for detecting changes | MEDIUM |
| Original insert preserved | SCD merge must preserve INS_DT and INS_JOB_ID of original row | HIGH |

Common SCD candidates (recommend historization when these attributes change):
- Account/cost center hierarchies (reclassification, reorganization)
- Customer/vendor master data (address, status, classification changes)
- Product attributes (category, pricing tier changes)
- Employee data (department, role, cost center changes)
- Organizational structure (reporting lines, business unit changes)

## 8. Data Types (validate: sql-reviewer, data-quality)

| Domain | Type | Precision | Severity |
|--------|------|-----------|----------|
| Identifiers | VARCHAR(255) | -- | HIGH |
| Descriptions | VARCHAR(1000) | -- | MEDIUM |
| Amounts | NUMBER(19,3) | -- | HIGH |
| Rates | NUMBER(10,6) | -- | MEDIUM |
| Counts | INTEGER | -- | MEDIUM |
| Dates | DATE (not TIMESTAMP) | -- | HIGH |
| DateTimes | TIMESTAMP | -- | MEDIUM |
| Currency codes | VARCHAR(3) | -- | MEDIUM |
| Flags | INTEGER | 0/1 | MEDIUM |
| Do not use | CHAR, TIME | -- | HIGH |

## 9. Transformation Template (validate: sql-reviewer)

Expected pattern for L1+ transformations:
1. CREATE OR REPLACE TABLE OUT_{name} with SRC_ID, SRC_SYS_ID, {columns}, technical columns, CONSTRAINT PK
2. Transformation logic writes to TMP_{name}
3. INSERT INTO OUT_{name} SELECT from TMP_{name} LEFT JOIN {name} for upsert (preserving INS_DT, INS_JOB_ID)

Severity: Missing template structure = MEDIUM, missing technical columns in CREATE = HIGH

## 10. Keboola Platform Best Practices (validate: various agents)

| Rule | Agent | Severity |
|------|-------|----------|
| Use shared codes for duplicated logic | sql-reviewer | HIGH |
| Variables use {{ moustache }} syntax, all assigned | sql-reviewer | HIGH |
| Develop in workspaces first, not transformations | config-reviewer | MEDIUM |
| Read-only input mappings where possible (avoid cloning) | config-reviewer, performance | HIGH |
| Flow phases: dependent tasks in separate phases | config-reviewer | HIGH |
| Tasks within same phase can run in parallel | config-reviewer | MEDIUM |
| Schedule flows off-peak (avoid :00 times) | performance | MEDIUM |
| Use storage table triggers for cross-project deps | config-reviewer | MEDIUM |
| Continue-on-failure for non-critical flow tasks | config-reviewer | MEDIUM |
| PK + incremental output for efficient updates | performance, config-reviewer | HIGH |
| No nullable PK columns with incremental loading | data-quality | CRITICAL |
| Technical user accounts for extractors/writers | security | HIGH |
| Encrypt all sensitive values (# prefix) | security | CRITICAL |
| Data quality tests with centralized DQ_RESULTS_LOG | data-quality | MEDIUM |
| Minimize flows (Keboola pricing model) | config-reviewer | MEDIUM |
