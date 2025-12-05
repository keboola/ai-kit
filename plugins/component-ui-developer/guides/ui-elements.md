# UI Elements Reference

All available UI elements for Keboola configuration schemas.

## Text Input

Basic single-line text input:
```json
{
  "field_name": {
    "type": "string",
    "title": "Field Title",
    "description": "Help text"
  }
}
```

## Textarea

Multi-line text input:
```json
{
  "field_name": {
    "type": "string",
    "title": "Description",
    "format": "textarea"
  }
}
```

## Password

Masked text input (use `#` prefix):
```json
{
  "#password": {
    "type": "string",
    "title": "Password",
    "format": "password"
  }
}
```

## URL Input

Text input with URL validation:
```json
{
  "base_url": {
    "type": "string",
    "title": "Base URL",
    "format": "url"
  }
}
```

## Number Input

Integer or decimal:
```json
{
  "max_records": {
    "type": "integer",
    "title": "Max Records",
    "default": 1000,
    "minimum": 1,
    "maximum": 10000
  }
}
```

## Dropdown (Select)

Single selection:
```json
{
  "auth_type": {
    "type": "string",
    "title": "Authentication Type",
    "enum": ["basic", "oauth", "apiKey"],
    "enum_titles": ["Username & Password", "OAuth 2.0", "API Key"],
    "default": "basic"
  }
}
```

## Multi-Select

Multiple selections:
```json
{
  "select_fields": {
    "type": "array",
    "title": "Select Fields",
    "format": "select",
    "items": {
      "type": "string"
    }
  }
}
```

## Checkbox

Boolean toggle:
```json
{
  "verify_ssl": {
    "type": "boolean",
    "title": "Verify SSL Certificates",
    "default": true
  }
}
```

## Dynamic Select (Sync Action)

Dropdown populated by sync action:
```json
{
  "entity_set": {
    "type": "string",
    "title": "Entity Set",
    "format": "select",
    "options": {
      "async": {
        "label": "Load Entity Sets",
        "action": "loadEntities",
        "autoload": true,
        "cache": true
      }
    }
  }
}
```

## Buttons

### Test Connection Button

```json
{
  "test_connection": {
    "type": "button",
    "format": "test-connection",
    "propertyOrder": 100,
    "options": {
      "async": {
        "label": "Test Connection",
        "action": "testConnection"
      }
    }
  }
}
```

### Sync Action Button

```json
{
  "preview_data": {
    "type": "button",
    "format": "sync-action",
    "options": {
      "async": {
        "label": "Preview Data (10 records)",
        "action": "previewData"
      }
    }
  }
}
```

### Validate Button

```json
{
  "validate_filter": {
    "type": "button",
    "format": "sync-action",
    "options": {
      "async": {
        "label": "Validate Filter",
        "action": "validateFilter"
      }
    }
  }
}
```

## Object/Group

Nested group of fields:
```json
{
  "advanced_settings": {
    "type": "object",
    "title": "Advanced Settings",
    "properties": {
      "timeout": {"type": "integer"},
      "retries": {"type": "integer"}
    }
  }
}
```

## Array of Objects

List of repeated structures:
```json
{
  "entities": {
    "type": "array",
    "title": "Entities",
    "items": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "enabled": {"type": "boolean"}
      }
    }
  }
}
```

## Conditional Fields

Show/hide fields dynamically:
```json
{
  "sync_type": {
    "type": "string",
    "enum": ["full", "incremental"]
  },
  "incremental_field": {
    "type": "string",
    "options": {
      "dependencies": {
        "sync_type": "incremental"
      }
    }
  }
}
```

See `conditional-fields.md` for detailed examples.

## Field Properties

### Common Properties

- `type` - Data type (string, integer, boolean, array, object)
- `title` - Label shown to user
- `description` - Help text below field
- `default` - Default value
- `propertyOrder` - Display order (lower = first)

### String Validation

- `minLength` - Minimum characters
- `maxLength` - Maximum characters
- `pattern` - Regex pattern
- `format` - Special formats (url, email, password, textarea)

### Number Validation

- `minimum` - Minimum value
- `maximum` - Maximum value
- `multipleOf` - Must be multiple of this value

### Array Properties

- `minItems` - Minimum array length
- `maxItems` - Maximum array length
- `uniqueItems` - No duplicates (true/false)

## Readonly Fields

Make fields read-only:
```json
{
  "component_id": {
    "type": "string",
    "readonly": true,
    "default": "keboola.ex-sap-odata"
  }
}
```

## Help Text

Add help text below fields:
```json
{
  "page_size": {
    "type": "integer",
    "title": "Page Size",
    "description": "Number of records per page (can be overridden per entity)",
    "default": 1000
  }
}
```

## Placeholder Text

Add placeholder in empty fields:
```json
{
  "filter_expression": {
    "type": "string",
    "title": "Filter Expression",
    "description": "OData $filter expression",
    "default": "Status eq 'Active'"
  }
}
```

## See Also

- `conditional-fields.md` - Show/hide fields
- `sync-actions.md` - Dynamic field loading
- `examples.md` - Real-world examples
- [Keboola UI Options](https://developers.keboola.com/extend/component/ui-options/)
