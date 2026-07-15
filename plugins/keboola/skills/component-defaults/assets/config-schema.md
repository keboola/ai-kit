# Default: `component_config/configSchema.json` and `configRowSchema.json`

## What these files are

`configSchema.json` defines the UI form and validation rules for the root (shared) configuration. `configRowSchema.json` does the same for per-row configuration. Both use [JSON Schema](https://json-schema.org/) with Keboola-specific UI extensions.

## Defaults

**`configSchema.json`** — minimal working default for a component with no user-configurable parameters:
```json
{}
```

**`configRowSchema.json`** — when the component does not use rows:
```json
{}
```

An empty object means the component is not row-based. Do not put content in `configRowSchema.json` unless the component actually uses rows.

## How root + row parameters merge

**The platform merges root config and configRow parameters into a single dict before the component runs.** The component always reads from `self.configuration.parameters` — it never needs to handle them separately.

- Root config (`configSchema.json`): shared settings across all rows (credentials, global options)
- Row config (`configRowSchema.json`): per-row variation (endpoint, object type, output name)
- On key collision, row parameters override root parameters

```python
# Correct for both row-based and non-row-based components
params = self.configuration.parameters
api_key = params["#api_key"]   # comes from root config
endpoint = params["endpoint"]  # comes from row config
# No special handling needed — platform already merged them
```

## Annotated example

```json
{
  "type": "object",
  "title": "Configuration",
  "required": ["#api_key"],
  "properties": {
    "#api_key": {
      "type": "string",
      "title": "API Key",
      "description": "Your API authentication token.",
      "format": "password",
      "propertyOrder": 1
    },
    "base_url": {
      "type": "string",
      "title": "Base URL",
      "description": "API base URL, e.g. https://api.example.com",
      "propertyOrder": 2
    },
    "debug": {
      "type": "boolean",
      "title": "Debug Mode",
      "default": false,
      "propertyOrder": 99
    }
  }
}
```

## Key rules and conventions

- **`propertyOrder`**: controls field ordering in the UI. Use sequential integers (1, 2, 3…). Use a high number (e.g., 99) for secondary fields like `debug`.
- **`#` prefix on property name** (e.g., `"#api_key"`): marks the value as sensitive. Keboola hashes it at rest and never exposes it in plaintext. Always use this for passwords, tokens, and API keys. The component reads it as `params["#api_key"]` — the `#` is part of the key name in Python too.
- **`"format": "password"`**: renders the field as a masked input in the UI. Always pair with `#` prefix.
- **`"required"` array**: list property names exactly as they appear including the `#` prefix. Keboola validates these before running the component.
- **`"default"` values**: used as placeholders in the UI and applied if the user leaves the field empty.

## Common field formats

| `format` value | Effect |
|---|---|
| `"password"` | Masked input |
| `"textarea"` | Multi-line text area |
| `"date"` | Date picker |

## Further reference

For dropdowns, code editors (ACE), sync action buttons, and conditional fields (show/hide based on other fields), see:
- [`ui-elements.md`](../../build-component-ui/references/ui-elements.md) — field formats and editor modes
- [`conditional-fields.md`](../../build-component-ui/references/conditional-fields.md) — `options.dependencies` for show/hide logic
- [`sync-actions.md`](../../build-component-ui/references/sync-actions.md) — dynamic dropdowns populated from API calls
- [`examples.md`](../../build-component-ui/references/examples.md) — real production schema examples
