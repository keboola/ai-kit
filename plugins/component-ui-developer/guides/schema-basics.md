# Keboola Configuration Schema Basics

Quick overview of Keboola configuration schemas.

## Two Types of Schemas

### 1. Component Schema (`configSchema.json`)
Global configuration shared across all rows. Examples:
- API endpoint URL
- Authentication credentials
- Connection settings
- Default values

### 2. Row Schema (`configRowSchema.json`)
Per-row configuration for each entity/table. Examples:
- Entity name to extract
- Fields to select
- Filters
- Sync type (full/incremental)

## Basic Structure

```json
{
  "type": "object",
  "title": "My Configuration",
  "required": ["field1", "field2"],
  "properties": {
    "field1": {
      "type": "string",
      "title": "Field 1",
      "description": "Help text for users"
    },
    "field2": {
      "type": "integer",
      "default": 100
    }
  }
}
```

## JSON Schema Types

- `string` - Text input
- `integer` - Number input
- `number` - Decimal number
- `boolean` - Checkbox
- `array` - List of items
- `object` - Nested group

## Special Field Prefixes

### Encrypted Fields: `#`

Use `#` prefix for sensitive data:
```json
{
  "#password": {
    "type": "string",
    "format": "password"
  },
  "#api_key": {
    "type": "string",
    "format": "password"
  }
}
```

### System Fields: `$`

Reserved for Keboola system use.

## Required Fields

Mark required fields in the `required` array:
```json
{
  "required": ["base_url", "auth_type"],
  "properties": {
    "base_url": {"type": "string"},
    "auth_type": {"type": "string"}
  }
}
```

## Defaults

Provide default values:
```json
{
  "page_size": {
    "type": "integer",
    "default": 1000
  },
  "verify_ssl": {
    "type": "boolean",
    "default": true
  }
}
```

## Property Order

Control field order with `propertyOrder`:
```json
{
  "base_url": {
    "type": "string",
    "propertyOrder": 1
  },
  "auth_type": {
    "type": "string",
    "propertyOrder": 10
  },
  "username": {
    "type": "string",
    "propertyOrder": 11
  }
}
```

Lower numbers appear first.

## See Also

- `conditional-fields.md` - Show/hide fields dynamically
- `ui-elements.md` - All available UI elements
- `sync-actions.md` - Dynamic field loading
- `examples.md` - Real-world schemas
