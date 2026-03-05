# Breaking Changes Reference

Detailed guide to all backward compatibility breaking change vectors in Keboola Python components. Use this reference when reviewing PRs for potential issues that could break existing user configurations.

## 1. Configuration Schema (`configSchema.json` / `configRowSchema.json`)

The configuration schema defines the UI form that users interact with. Changes here directly affect every existing configuration.

### Removed Property

**Risk: HIGH**

When a property is removed from the schema, existing configurations that use this property will:
- Show validation errors in the UI
- May fail to save or run
- Lose the previously configured value

**Detection:**
```bash
# Compare schemas between base and PR branch
git diff $(git merge-base HEAD main)..HEAD -- 'component_config/configSchema.json' 'component_config/configRowSchema.json'
```

Look for removed keys in the `properties` object.

**Mitigation:** The property should be deprecated (hidden from UI) rather than removed, or a migration must be provided.

### Renamed Property

**Risk: HIGH**

Renaming a property is equivalent to removing the old one and adding a new one. Existing configs will lose their values.

**Detection:** Look for a removed property and a new property with similar semantics in the same diff.

### Changed Type

**Risk: HIGH**

Changing a property's `type` (e.g., `string` to `number`, `string` to `array`) invalidates existing stored values.

**Detection:** Look for changes to `"type":` within property definitions.

### Narrowed Enum

**Risk: HIGH (if values in use) / MEDIUM (if no configs use removed values)**

Removing values from an `enum` array breaks configurations that use the removed values.

**Detection:**
```bash
# Look for enum changes
git diff $(git merge-base HEAD main)..HEAD -- 'component_config/configSchema.json' | grep -A5 '"enum"'
```

**Telemetry check:** Query `configuration_json` to count how many configs use each enum value.

### Added to Required Without Default

**Risk: HIGH**

Adding a field to the `required` array without providing a `default` value means existing configurations (which don't have this field) will fail validation.

**Detection:** Look for additions to `"required": [...]` and verify the corresponding property has a `"default"` value.

### Changed Default Value

**Risk: MEDIUM**

Changing a default value silently changes behavior for all configurations that rely on the old default (i.e., configs that never explicitly set this field).

**Detection:** Look for changes to `"default":` values.

### Removed/Changed Password Prefix (`#`)

**Risk: HIGH**

The `#` prefix on property names (e.g., `#api_key`) controls Keboola's encryption handling. Removing it:
- Exposes previously encrypted values
- Breaks the encryption/decryption flow
- May leak sensitive data

**Detection:** Look for properties where the `#` prefix is added or removed.

### Removed Sync Action Reference

**Risk: HIGH**

If a property uses `"options": {"async": {"action": "someAction"}}` to reference a sync action, and that sync action is removed, the UI will break (loading spinners that never resolve).

**Detection:** Cross-reference `options.async.action` values in the schema with `@sync_action` decorators in the code.

### PropertyOrder Changes

**Risk: LOW**

Removing items from `propertyOrder` may hide fields in the UI, but doesn't break configurations.

**Detection:** Look for removed items in the `"propertyOrder"` array.

## 2. Configuration Models (Pydantic / Dataclass)

Python configuration models validate the JSON configuration at runtime. Changes here affect whether existing configs pass validation.

### Removed Optional

**Risk: HIGH**

Changing a field from `Optional[str]` (or `str | None`) to `str` makes it required. Existing configs that don't have this field will fail at runtime with a validation error.

**Detection:** Look for `Optional` being removed from type annotations, or `| None` being removed.

### Added Required Field Without Default

**Risk: HIGH**

Adding a new field to a Pydantic model without `default=` or `default_factory=` means existing configs will fail validation.

**Detection:**
```python
# HIGH RISK - no default
new_field: str

# SAFE - has default
new_field: str = "default_value"

# SAFE - Optional with None default
new_field: str | None = None
```

### Changed Field Alias

**Risk: HIGH**

`Field(alias="json_key")` controls which JSON key maps to the Python field. Changing the alias changes the expected JSON structure, breaking existing configs.

**Detection:** Look for changes to `alias=` in `Field()` definitions.

### Changed Field Type

**Risk: HIGH**

Changing a field type (e.g., `str` to `int`, `str` to `list[str]`) means existing values will fail Pydantic validation.

### Removed Field

**Risk: MEDIUM-HIGH**

Depends on the model's `model_config`:
- With `extra = "forbid"`: removing a field means configs with that key will fail
- With `extra = "allow"` or `extra = "ignore"`: the key is silently ignored (less risky but data is lost)

**Detection:** Check the model's `model_config` for the `extra` setting.

## 3. Sync Actions

Sync actions provide dynamic data to the UI (dropdowns, validation, test connections).

### Removed Sync Action

**Risk: HIGH**

If `@sync_action("action_name")` is removed:
- UI buttons referencing this action stop working
- Dynamic dropdowns that load data via this action show loading spinners forever
- "Test Connection" buttons break

**Detection:**
```bash
# Find all sync actions in the codebase
grep -rn '@sync_action' src/
```

Compare with the base branch to identify removed actions.

### Renamed Sync Action

**Risk: HIGH**

Same as removal — the UI references actions by name.

### Changed Return Format

**Risk: HIGH for select/dropdown actions**

Sync actions that feed `select` dropdowns MUST return `[{"label": "...", "value": "..."}]` format. Changing this format breaks the dropdown.

**Detection:** Check the return type and structure of sync action methods.

### Changed Consumed Parameters

**Risk: MEDIUM**

If a sync action starts requiring different parameters than before, existing configurations may fail when the action is triggered.

## 4. Output Tables

Output table changes affect downstream transformations, orchestrations, and data pipelines.

### Changed Column Names

**Risk: HIGH**

Renaming or removing columns breaks:
- SQL transformations that reference these columns
- Orchestrations that depend on specific column names
- Any downstream processing

**Detection:**
```bash
# Look for changes in output table definitions
grep -rn 'create_out_table_definition\|write_manifest\|columns' src/ --include='*.py'
```

### Changed Primary Key

**Risk: HIGH**

Changing the primary key affects:
- Deduplication behavior
- Incremental loading (which rows get updated vs inserted)
- Data integrity

### Changed Destination Table

**Risk: HIGH**

Changing the destination table name means data lands in a different Storage table, breaking all references to the old table name.

### Removed Table

**Risk: HIGH**

Removing an output table breaks all downstream dependencies.

### Changed Incremental Flag

**Risk: MEDIUM**

Changing from incremental to full load (or vice versa) changes data behavior:
- Full -> Incremental: old data preserved, may accumulate
- Incremental -> Full: existing data overwritten each run

## 5. Dockerfile

### Major Runtime Version Change

**Risk: MEDIUM**

Python version changes (e.g., 3.10 -> 3.12) may introduce behavioral differences in:
- String handling
- Dictionary ordering
- Deprecated stdlib functions
- Third-party library compatibility

### Removed System Packages

**Risk: MEDIUM**

Removing system packages from the Dockerfile may cause runtime failures for features that depend on them.

## 6. State File

### Changed State Structure

**Risk: HIGH**

The state file persists between runs for incremental processing. If the structure changes:
- The next run won't find expected keys
- Incremental processing may restart from scratch
- Data may be duplicated or lost

**Detection:**
```bash
# Look for state file access patterns
grep -rn 'get_state_file\|write_state_file\|state_file' src/ --include='*.py'
```

**Mitigation:** State changes should include a backward-compatible fallback that handles both old and new formats.

### Changed State Key Names

**Risk: HIGH**

Renaming state keys without a fallback means the next run won't find the previous state, effectively resetting incremental processing.

## Quick Reference: Severity Decision Matrix

| Change | 0 external configs | Few configs (1-10) | Many configs (10+) |
|--------|-------------------|--------------------|--------------------|
| Removed configSchema property | MEDIUM | HIGH | HIGH |
| Changed type | MEDIUM | HIGH | HIGH |
| Narrowed enum (value unused) | LOW | MEDIUM | MEDIUM |
| Narrowed enum (value in use) | MEDIUM | HIGH | HIGH |
| Added required without default | MEDIUM | HIGH | HIGH |
| Removed sync action | MEDIUM | HIGH | HIGH |
| Changed output columns | MEDIUM | HIGH | HIGH |
| Changed primary key | MEDIUM | HIGH | HIGH |
| State structure change | LOW | MEDIUM | HIGH |
| Dockerfile version change | LOW | MEDIUM | MEDIUM |
| UI-only changes | LOW | LOW | LOW |
