# Configuration Schema Advanced Patterns

Advanced UI patterns and best practices from internal Keboola documentation.

## Table of Contents

1. [Placeholder Hints](#placeholder-hints)
2. [Element Tooltips](#element-tooltips)
3. [Read-Only Inputs](#read-only-inputs)
4. [Creatable Dropdowns](#creatable-dropdowns)
5. [SSH Key Pair Block](#ssh-key-pair-block)
6. [SSH Tunnel Block](#ssh-tunnel-block)
7. [Backfilling Configuration](#backfilling-configuration)
8. [Optional Blocks Using Arrays](#optional-blocks-using-arrays)
9. [Dependencies Across Nested Objects](#dependencies-across-nested-objects)
10. [Conditional Schemas (if/then/else)](#conditional-schemas-ifthenelse)
11. [Input Validation with Pattern](#input-validation-with-pattern)
12. [Metadata Access Patterns](#metadata-access-patterns)
13. [Standard Destination Block](#standard-destination-block)
14. [UI Development Tools](#ui-development-tools)

## Placeholder Hints

Add placeholder text to input fields:

```json
{
  "api_key": {
    "type": "string",
    "title": "API Key",
    "options": {
      "inputAttributes": {
        "placeholder": "Enter your API key here"
      }
    }
  }
}
```

## Element Tooltips

Add tooltips with documentation links:

```json
{
  "endpoint": {
    "type": "string",
    "title": "API Endpoint",
    "description": "The base URL for API requests. <a href='https://docs.example.com/api' target='_blank'>Learn more</a>"
  }
}
```

**Note:** HTML links are supported in descriptions.

## Read-Only Inputs

Create read-only fields that display values but cannot be edited:

```json
{
  "component_id": {
    "type": "string",
    "title": "Component ID",
    "options": {
      "inputAttributes": {
        "readonly": true
      }
    }
  }
}
```

## Creatable Dropdowns

Allow users to create custom options in a dropdown that aren't in the predefined enum list.

### For Multi-Select (Arrays)

Both `tags` and `creatable` options work for multi-select fields:

**Option 1: Using `tags`** (multi-select only)
```json
{
  "categories": {
    "type": "array",
    "title": "Categories",
    "format": "select",
    "uniqueItems": true,
    "items": {
      "type": "string",
      "enum": ["sales", "marketing", "support"]
    },
    "options": {
      "tags": true
    }
  }
}
```

**Option 2: Using `creatable`** (works for both single and multi-select)
```json
{
  "categories": {
    "type": "array",
    "title": "Categories",
    "format": "select",
    "uniqueItems": true,
    "items": {
      "type": "string",
      "enum": ["sales", "marketing", "support"]
    },
    "options": {
      "creatable": true
    }
  }
}
```

### For Single-Select (Strings)

**Only `creatable` works** for single-select fields. The `tags` option does NOT work for strings:

```json
{
  "category": {
    "type": "string",
    "title": "Category",
    "format": "select",
    "enum": ["sales", "marketing", "support"],
    "options": {
      "creatable": true
    }
  }
}
```

### Compatibility Summary

| Option | Single-Select (string) | Multi-Select (array) |
|--------|----------------------|---------------------|
| `tags: true` | ❌ Does not work | ✅ Works |
| `creatable: true` | ✅ Works | ✅ Works |

**Recommendation:** Use `creatable: true` for consistency, as it works for both field types.

### Validating Custom Values with Pattern

When creatable is enabled, you can use the `pattern` property to validate custom values against a regex:

```json
{
  "column_name": {
    "type": "string",
    "title": "Column Name",
    "format": "select",
    "enum": ["id", "name", "email"],
    "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*$",
    "options": {
      "creatable": true
    }
  }
}
```

This ensures that any custom value entered by the user matches the specified regex pattern. In this example, column names must start with a letter or underscore and contain only alphanumeric characters and underscores.

**Multi-select with pattern validation:**
```json
{
  "tags": {
    "type": "array",
    "title": "Tags",
    "format": "select",
    "uniqueItems": true,
    "items": {
      "type": "string",
      "enum": ["important", "urgent", "review"]
    },
    "pattern": "^[a-z][a-z0-9-]*$",
    "options": {
      "tags": true
    }
  }
}
```

## SSH Key Pair Block

**Note:** You can use the `ssh-editor` format for a built-in SSH form:
```json
{
  "ssh": {
    "type": "object",
    "format": "ssh-editor"
  }
}
```

For keys only (without full tunnel configuration):
```json
{
  "ssh": {
    "type": "object",
    "format": "ssh-editor",
    "options": {
      "only_keys": true
    }
  }
}
```

Or use the manual structure below for more control:

Standard block for SSH key pair authentication:

```json
{
  "ssh": {
    "type": "object",
    "title": "SSH Key Pair",
    "options": {
      "collapsed": true
    },
    "properties": {
      "enabled": {
        "type": "boolean",
        "title": "Enable SSH Key Pair",
        "default": false,
        "propertyOrder": 1
      },
      "#private_key": {
        "type": "string",
        "title": "Private Key",
        "format": "textarea",
        "propertyOrder": 2,
        "options": {
          "inputAttributes": {
            "placeholder": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
          }
        }
      },
      "public_key": {
        "type": "string",
        "title": "Public Key",
        "format": "textarea",
        "propertyOrder": 3,
        "options": {
          "inputAttributes": {
            "readonly": true
          }
        }
      }
    },
    "dependencies": {
      "enabled": {
        "oneOf": [
          {
            "properties": {
              "enabled": {"enum": [false]}
            }
          },
          {
            "properties": {
              "enabled": {"enum": [true]},
              "#private_key": {"type": "string"},
              "public_key": {"type": "string"}
            },
            "required": ["#private_key"]
          }
        ]
      }
    }
  }
}
```

## SSH Tunnel Block

Standard block for SSH tunnel configuration:

```json
{
  "ssh_tunnel": {
    "type": "object",
    "title": "SSH Tunnel",
    "options": {
      "collapsed": true
    },
    "properties": {
      "enabled": {
        "type": "boolean",
        "title": "Enable SSH Tunnel",
        "default": false,
        "propertyOrder": 1
      },
      "ssh_host": {
        "type": "string",
        "title": "SSH Host",
        "propertyOrder": 2
      },
      "ssh_port": {
        "type": "integer",
        "title": "SSH Port",
        "default": 22,
        "propertyOrder": 3
      },
      "ssh_user": {
        "type": "string",
        "title": "SSH User",
        "propertyOrder": 4
      },
      "#ssh_private_key": {
        "type": "string",
        "title": "SSH Private Key",
        "format": "textarea",
        "propertyOrder": 5
      }
    },
    "dependencies": {
      "enabled": {
        "oneOf": [
          {
            "properties": {
              "enabled": {"enum": [false]}
            }
          },
          {
            "properties": {
              "enabled": {"enum": [true]},
              "ssh_host": {"type": "string"},
              "ssh_port": {"type": "integer"},
              "ssh_user": {"type": "string"},
              "#ssh_private_key": {"type": "string"}
            },
            "required": ["ssh_host", "ssh_user", "#ssh_private_key"]
          }
        ]
      }
    }
  }
}
```

## Backfilling Configuration

Pattern for date-based backfilling:

```json
{
  "backfill": {
    "type": "object",
    "title": "Backfill Settings",
    "properties": {
      "enabled": {
        "type": "boolean",
        "title": "Enable Backfill",
        "default": false,
        "propertyOrder": 1
      },
      "start_date": {
        "type": "string",
        "title": "Start Date",
        "format": "date",
        "propertyOrder": 2
      },
      "end_date": {
        "type": "string",
        "title": "End Date",
        "format": "date",
        "propertyOrder": 3
      }
    },
    "dependencies": {
      "enabled": {
        "oneOf": [
          {
            "properties": {
              "enabled": {"enum": [false]}
            }
          },
          {
            "properties": {
              "enabled": {"enum": [true]},
              "start_date": {"type": "string"},
              "end_date": {"type": "string"}
            },
            "required": ["start_date"]
          }
        ]
      }
    }
  }
}
```

## Optional Blocks Using Arrays

Use arrays with `maxItems: 1` for optional configuration blocks:

```json
{
  "proxy": {
    "type": "array",
    "title": "Proxy Settings (Optional)",
    "maxItems": 1,
    "items": {
      "type": "object",
      "properties": {
        "host": {
          "type": "string",
          "title": "Proxy Host",
          "propertyOrder": 1
        },
        "port": {
          "type": "integer",
          "title": "Proxy Port",
          "default": 8080,
          "propertyOrder": 2
        },
        "username": {
          "type": "string",
          "title": "Username",
          "propertyOrder": 3
        },
        "#password": {
          "type": "string",
          "title": "Password",
          "format": "password",
          "propertyOrder": 4
        }
      },
      "required": ["host", "port"]
    }
  }
}
```

**Benefits:**
- User can add/remove the entire block
- No need for an "enabled" checkbox
- Clean UI when not used

## Dependencies Across Nested Objects

**Problem:** JSON Schema dependencies don't work across nested objects.

**Workaround:** Use flat structure or duplicate fields:

### Option 1: Flat Structure

```json
{
  "auth_type": {
    "type": "string",
    "title": "Authentication Type",
    "enum": ["password", "oauth"],
    "propertyOrder": 1
  },
  "username": {
    "type": "string",
    "title": "Username",
    "propertyOrder": 2
  },
  "#password": {
    "type": "string",
    "title": "Password",
    "format": "password",
    "propertyOrder": 3
  },
  "dependencies": {
    "auth_type": {
      "oneOf": [
        {
          "properties": {
            "auth_type": {"enum": ["password"]},
            "username": {"type": "string"},
            "#password": {"type": "string"}
          },
          "required": ["username", "#password"]
        },
        {
          "properties": {
            "auth_type": {"enum": ["oauth"]}
          }
        }
      ]
    }
  }
}
```

### Option 2: Conditional Schema (if/then/else)

```json
{
  "allOf": [
    {
      "if": {
        "properties": {
          "auth_type": {"const": "password"}
        }
      },
      "then": {
        "properties": {
          "username": {"type": "string"},
          "#password": {"type": "string"}
        },
        "required": ["username", "#password"]
      }
    }
  ]
}
```

## Conditional Schemas (if/then/else)

Use `if/then/else` for complex conditional logic:

```json
{
  "type": "object",
  "properties": {
    "data_source": {
      "type": "string",
      "title": "Data Source",
      "enum": ["database", "api", "file"],
      "propertyOrder": 1
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "data_source": {"const": "database"}
        }
      },
      "then": {
        "properties": {
          "host": {
            "type": "string",
            "title": "Database Host",
            "propertyOrder": 2
          },
          "port": {
            "type": "integer",
            "title": "Port",
            "propertyOrder": 3
          }
        },
        "required": ["host"]
      }
    },
    {
      "if": {
        "properties": {
          "data_source": {"const": "api"}
        }
      },
      "then": {
        "properties": {
          "endpoint": {
            "type": "string",
            "title": "API Endpoint",
            "format": "uri",
            "propertyOrder": 2
          },
          "#api_key": {
            "type": "string",
            "title": "API Key",
            "format": "password",
            "propertyOrder": 3
          }
        },
        "required": ["endpoint", "#api_key"]
      }
    },
    {
      "if": {
        "properties": {
          "data_source": {"const": "file"}
        }
      },
      "then": {
        "properties": {
          "file_path": {
            "type": "string",
            "title": "File Path",
            "propertyOrder": 2
          }
        },
        "required": ["file_path"]
      }
    }
  ]
}
```

## Input Validation with Pattern

Use regex patterns for input validation:

### Email Validation

```json
{
  "email": {
    "type": "string",
    "title": "Email",
    "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
  }
}
```

### URL Validation

```json
{
  "url": {
    "type": "string",
    "title": "URL",
    "pattern": "^https?://.*"
  }
}
```

### Phone Number Validation

```json
{
  "phone": {
    "type": "string",
    "title": "Phone Number",
    "pattern": "^\\+?[0-9]{10,15}$"
  }
}
```

### Custom ID Format

```json
{
  "project_id": {
    "type": "string",
    "title": "Project ID",
    "pattern": "^[A-Z]{2}-[0-9]{4}$",
    "description": "Format: XX-0000 (e.g., AB-1234)"
  }
}
```

## Metadata Access Patterns

### Access Column Names from Input Mapping

In row schemas, access column names from the input mapping:

```json
{
  "column": {
    "type": "string",
    "title": "Column",
    "format": "select",
    "options": {
      "async": {
        "label": "Load Columns",
        "action": "loadColumns"
      }
    },
    "links": [
      {
        "rel": "self",
        "href": "/_metadata_.table.columns"
      }
    ]
  }
}
```

### Access Root Parameters from Row Schema

Access parameters from the root configuration in a row schema:

```json
{
  "inherited_setting": {
    "type": "string",
    "title": "Inherited Setting",
    "options": {
      "inputAttributes": {
        "readonly": true
      }
    },
    "links": [
      {
        "rel": "self",
        "href": "/_metadata_.root.parameters.setting_name"
      }
    ]
  }
}
```

## Standard Destination Block

Template for extractor destination configuration:

```json
{
  "destination": {
    "type": "object",
    "title": "Destination",
    "propertyOrder": 100,
    "properties": {
      "output_table": {
        "type": "string",
        "title": "Output Table",
        "description": "Name of the output table in Storage",
        "propertyOrder": 1,
        "options": {
          "inputAttributes": {
            "placeholder": "out.c-bucket.table_name"
          }
        }
      },
      "incremental": {
        "type": "boolean",
        "title": "Incremental Load",
        "default": false,
        "description": "If enabled, data will be appended to existing table",
        "propertyOrder": 2
      },
      "primary_key": {
        "type": "array",
        "title": "Primary Key",
        "items": {
          "type": "string"
        },
        "uniqueItems": true,
        "description": "Columns that form the primary key",
        "propertyOrder": 3
      }
    }
  }
}
```

## UI Development Tools

### Testing Schemas Locally

1. Use the Keboola UI JSON Schema editor
2. Test with sample data before deploying
3. Validate against JSON Schema Draft-07

### Debugging Tips

1. **Check browser console** for JSON Schema validation errors
2. **Use `options.hidden`** to temporarily hide fields during development
3. **Test dependencies** by changing field values and observing UI updates
4. **Verify sync actions** by checking network requests in browser dev tools

### Common Issues

| Issue | Solution |
|-------|----------|
| Fields not showing | Check `propertyOrder` and `required` |
| Dependencies not working | Ensure correct `oneOf` structure |
| Dropdown empty | Verify sync action response format |
| Validation not triggering | Check `pattern` regex syntax |
| Nested dependencies failing | Use flat structure or `if/then/else` |

### JSON Schema Validators

- [JSON Schema Validator](https://www.jsonschemavalidator.net/)
- [JSON Editor Online](https://jsoneditoronline.org/)
- [Ajv JSON Schema Validator](https://ajv.js.org/)

## Related Documentation

- [Overview](configuration-schema-overview.md) - Introduction and basics
- [UI Elements](configuration-schema-ui-elements.md) - Field formats and options
- [Sync Actions](configuration-schema-sync-actions.md) - Dynamic dropdowns and validation
- [Examples](configuration-schema-examples.md) - Real production examples
