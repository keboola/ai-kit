# Quick Reference: Conditional Fields in Keboola Schemas

## TL;DR

Use `options.dependencies` (NOT JSON Schema `dependencies` or `oneOf`):

```json
{
  "field_name": {
    "type": "string",
    "options": {
      "dependencies": {
        "parent_field": "required_value"
      }
    }
  }
}
```

## Common Patterns

### 1. Show field when dropdown equals specific value

```json
{
  "auth_type": {
    "type": "string",
    "enum": ["basic", "apiKey"]
  },
  "username": {
    "type": "string",
    "options": {
      "dependencies": {
        "auth_type": "basic"
      }
    }
  }
}
```

### 2. Show field when dropdown equals ANY of multiple values

```json
{
  "report_type": {
    "type": "string",
    "enum": ["simple", "detailed", "advanced"]
  },
  "advanced_options": {
    "type": "object",
    "options": {
      "dependencies": {
        "report_type": ["detailed", "advanced"]
      }
    }
  }
}
```

### 3. Show field when checkbox is checked

```json
{
  "enable_filtering": {
    "type": "boolean"
  },
  "filter_expression": {
    "type": "string",
    "options": {
      "dependencies": {
        "enable_filtering": true
      }
    }
  }
}
```

### 4. Show field when checkbox is NOT checked

```json
{
  "use_default": {
    "type": "boolean",
    "default": true
  },
  "custom_value": {
    "type": "string",
    "options": {
      "dependencies": {
        "use_default": false
      }
    }
  }
}
```

### 5. Multiple dependencies (AND logic)

```json
{
  "sync_type": {
    "type": "string",
    "enum": ["full", "incremental"]
  },
  "enable_advanced": {
    "type": "boolean"
  },
  "advanced_incremental_options": {
    "type": "object",
    "options": {
      "dependencies": {
        "sync_type": "incremental",
        "enable_advanced": true
      }
    }
  }
}
```

## What NOT to Do

### DON'T: Use JSON Schema `dependencies`

```json
// ❌ WRONG - This doesn't work with @json-editor
{
  "properties": {
    "auth_type": {"enum": ["basic", "apiKey"]}
  },
  "dependencies": {
    "auth_type": {
      "oneOf": [...]
    }
  }
}
```

### DON'T: Use `allOf + oneOf` for show/hide

```json
// ❌ WRONG - This creates a switcher dropdown, not show/hide
{
  "allOf": [
    {
      "properties": {
        "auth_type": {"enum": ["basic", "apiKey"]}
      }
    },
    {
      "oneOf": [
        {"title": "Basic Auth", "properties": {...}},
        {"title": "API Key", "properties": {...}}
      ]
    }
  ]
}
```

### DO: Use flat structure with `options.dependencies`

```json
// ✅ CORRECT - Dynamic show/hide
{
  "properties": {
    "auth_type": {
      "type": "string",
      "enum": ["basic", "apiKey"]
    },
    "username": {
      "type": "string",
      "options": {
        "dependencies": {
          "auth_type": "basic"
        }
      }
    },
    "#api_key": {
      "type": "string",
      "options": {
        "dependencies": {
          "auth_type": "apiKey"
        }
      }
    }
  }
}
```

## Testing Checklist

- [ ] Fields appear/disappear when parent field changes
- [ ] No switcher dropdown created
- [ ] All fields at same level in schema (no nesting)
- [ ] Dependencies in `options.dependencies`, not schema root
- [ ] Multiple values use array syntax: `["value1", "value2"]`
- [ ] Boolean dependencies use `true` or `false`, not strings

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Switcher dropdown appears | Using `oneOf` | Remove `oneOf`, use `options.dependencies` |
| Fields don't appear | Wrong syntax | Check it's `options.dependencies`, not root `dependencies` |
| All fields visible | Missing `dependencies` | Add `options.dependencies` to each conditional field |
| Fields missing entirely | Nested in `oneOf` | Move to flat `properties` structure |

## Real Example from SAP OData Extractor

### Component Schema (configSchema.json)

```json
{
  "type": "object",
  "title": "SAP OData Connection",
  "required": ["base_url", "service_path", "auth_type"],
  "properties": {
    "auth_type": {
      "type": "string",
      "enum": ["basic", "oauth", "apiKey"],
      "enum_titles": ["Username & Password", "OAuth 2.0", "API Key"],
      "default": "basic"
    },
    "username": {
      "type": "string",
      "title": "Username",
      "options": {
        "dependencies": {
          "auth_type": "basic"
        }
      }
    },
    "#password": {
      "type": "string",
      "title": "Password",
      "format": "password",
      "options": {
        "dependencies": {
          "auth_type": "basic"
        }
      }
    },
    "#api_key": {
      "type": "string",
      "title": "API Key",
      "format": "password",
      "options": {
        "dependencies": {
          "auth_type": "apiKey"
        }
      }
    }
  }
}
```

### Row Schema (configRowSchema.json)

```json
{
  "type": "object",
  "title": "Entity Extraction",
  "required": ["entity_set"],
  "properties": {
    "sync_type": {
      "type": "string",
      "enum": ["full", "incremental"],
      "default": "full"
    },
    "incremental_field": {
      "type": "string",
      "title": "Incremental Field",
      "format": "select",
      "options": {
        "dependencies": {
          "sync_type": "incremental"
        }
      }
    },
    "primary_key": {
      "type": "array",
      "title": "Primary Key",
      "format": "select",
      "items": {
        "type": "string"
      },
      "options": {
        "dependencies": {
          "sync_type": "incremental"
        }
      }
    }
  }
}
```

## Resources

- [@json-editor/json-editor documentation](https://github.com/json-editor/json-editor#dependencies)
- [Keboola Configuration Schema](https://developers.keboola.com/extend/component/ui-options/configuration-schema/)
- [Keboola UI Examples](https://developers.keboola.com/extend/component/ui-options/configuration-schema/examples/)
