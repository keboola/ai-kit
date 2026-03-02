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
9. [Required Fields — Important Warning](#required-fields--important-warning)
10. [Dependencies Across Nested Objects](#dependencies-across-nested-objects)
11. [Conditional Schemas (if/then/else)](#conditional-schemas-ifthenelse)
12. [Input Validation with Pattern](#input-validation-with-pattern)
13. [Metadata Access Patterns](#metadata-access-patterns)
14. [Date Range Pattern](#date-range-pattern)
15. [Standard Loading Options Block](#standard-loading-options-block)
16. [Visual Separation of Sections](#visual-separation-of-sections)
17. [Bulk Row Creation](#bulk-row-creation)
18. [Standard Destination Block](#standard-destination-block)
19. [UI Development Tools](#ui-development-tools)

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

There are two distinct tooltip mechanisms:

### 1. Field tooltip (info icon on field label)

Use `options.tooltip` to add an info icon `ⓘ` next to the field label. On hover it shows the tooltip text.

```json
{
  "test_tooltip": {
    "type": "string",
    "title": "Example tooltip",
    "options": {
      "tooltip": "custom tooltip, default is Open documentation"
    },
    "description": "Test value."
  }
}
```

### 2. Documentation link (on section header)

Use `options.documentation` to add a documentation link icon on an object section header.

```json
{
  "type": "object",
  "title": "Authorization",
  "options": {
    "documentation": {
      "link": "https://docs.example.com/auth",
      "tooltip": "custom tooltip, default is Open documentation"
    }
  },
  "properties": {}
}
```

### 3. HTML links in description

HTML links are also supported directly in `description`:

```json
{
  "endpoint": {
    "type": "string",
    "title": "API Endpoint",
    "description": "The base URL for API requests. <a href='https://docs.example.com/api' target='_blank'>Learn more</a>"
  }
}
```

## Read-Only Inputs

There are two ways to create read-only fields:

### Option 1: JSON Schema `readOnly` (recommended for display-only fields)

```json
{
  "api_version": {
    "type": "string",
    "title": "API version",
    "default": "2022-04",
    "description": "Current API version (updated by the platform).",
    "readOnly": true
  }
}
```

### Option 2: `options.inputAttributes.readonly` (json-editor specific)

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

Both approaches visually prevent editing. Use `readOnly: true` at field level for simplicity.

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

### SSH Editor Output Structure

When `ssh-editor` generates a key pair via the Keboola UI, the resulting configuration object has this structure:

```json
{
  "enabled": true,
  "keys": {
    "public": "ssh-rsa AAAA...",
    "#private": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
  },
  "sshHost": "your-ssh-host.example.com",
  "user": "ssh-user",
  "sshPort": 22
}
```

The key pair is generated by the `keboola.ssh-keygen-v2` component using:
`ssh-keygen -b 4096 -t rsa -f <privateKeyFile> -N '' -q`

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

### Window-Based Backfilling (Chunked Extraction)

For long date ranges that would cause component timeouts, use a window-based approach. The component splits the full interval into smaller chunks and processes one chunk per run, storing progress in state so each consecutive run continues from where it left off.

```json
{
  "backfill_mode": {
    "type": "object",
    "title": "Backfill mode",
    "format": "grid",
    "propertyOrder": 455,
    "description": "If backfill mode is enabled, each consecutive run of the component will continue from the end of the last run period, until current date is reached. The size of the backfill window is used to specify the maximum chunk of the interval that will be used in one run.",
    "required": ["backfill_enabled", "backfill_max_window"],
    "properties": {
      "backfill_enabled": {
        "type": "boolean",
        "title": "Enable Backfill",
        "enum": [false, true],
        "default": false,
        "options": {
          "enum_titles": ["No", "Yes"]
        }
      },
      "backfill_max_window": {
        "type": "number",
        "title": "Size of the backfill window in days",
        "description": "Set maximum number of days that will be used to split the reported interval and used in one call."
      }
    }
  }
}
```

Implementation of the chunking logic is supported by convenience methods in the KDS Python library.

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

## Required Fields — Important Warning

> **Never use the `required` list on the parent object for new fields — this breaks existing CLI integrations.**
> Always use `"required": true` directly on the field itself.

**Wrong (breaks CLI):**
```json
{
  "type": "object",
  "required": ["my_field"],
  "properties": {
    "my_field": { "type": "string" }
  }
}
```

**Correct:**
```json
{
  "type": "object",
  "properties": {
    "my_field": {
      "type": "string",
      "required": true
    }
  }
}
```

This applies to both string fields and enum/array fields. The parent-level `required` list is only acceptable for existing schemas where it was already present.

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

### Option 3: Dummy hidden element with `template`/`watch` (cross-object dependencies)

When you need a field in `obj_2` to react to a value from `obj_1`, use a hidden helper field that mirrors the value via `watch`/`template`, then depend on the helper:

```json
{
  "type": "object",
  "properties": {
    "element_1": {
      "type": "object",
      "properties": {
        "element_1_nested": {
          "type": "string",
          "enum": ["SHOW_ELEMENT2", "HIDE_ELEMENT2"],
          "propertyOrder": 1
        }
      }
    },
    "element_2": {
      "type": "object",
      "properties": {
        "helper_element": {
          "type": "string",
          "description": "Helper dummy element — mirrors element_1.element_1_nested",
          "template": "{{val}}",
          "watch": {
            "val": "element_1.element_1_nested"
          },
          "options": {
            "hidden": true
          }
        },
        "element_2_nested": {
          "type": "string",
          "title": "element_2_nested",
          "options": {
            "dependencies": {
              "helper_element": "SHOW_ELEMENT2"
            }
          },
          "propertyOrder": 1
        }
      }
    }
  }
}
```

**How it works:** The hidden `helper_element` watches the sibling object's field and copies its value. `element_2_nested` then depends on the helper (which is in the same object scope) — this bypasses the cross-object dependency limitation.

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

Requires `genericDockerUI-simpleTableInput` flag in Developer Portal UI options.

**Option A: `watch`/`enumSource` pattern (direct metadata binding)**

```json
{
  "column_name": {
    "type": "string",
    "title": "Column name",
    "watch": {
      "columns": "_metadata_.table.columns"
    },
    "enumSource": "columns",
    "required": true,
    "propertyOrder": 1
  }
}
```

The `_metadata_` hidden object is automatically injected into the schema root when `simpleTableInput` is enabled:

```json
{
  "_metadata_": {
    "type": "object",
    "options": { "hidden": true },
    "properties": {
      "table": {
        "type": "object",
        "properties": {
          "id":         { "type": "string" },
          "name":       { "type": "string" },
          "columns":    { "type": "array" },
          "primaryKey": { "type": "array" }
        }
      }
    }
  }
}
```

**Option B: async action (sync action call)**

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
    }
  }
}
```

### Access Root Parameters from Row Schema

Access parameters from the root configuration in a row schema using the `template`/`watch` pattern:

```json
{
  "helper_access_method": {
    "type": "string",
    "title": "Helper Access Method",
    "options": {
      "hidden": true
    },
    "template": "{{val}}",
    "watch": {
      "val": "_metadata_.root.parameters.access_method"
    },
    "propertyOrder": 20
  }
}
```

Other fields can then use `options.dependencies` on this helper to react to root config values.

## Date Range Pattern

The standard convention for date range fields accepts both ISO dates (`YYYY-MM-DD`) and relative dateparser strings like `5 days ago`, `1 month ago`, `yesterday`, `now`.

```json
{
  "date_from": {
    "type": "string",
    "title": "From date [inclusive]",
    "description": "Date in YYYY-MM-DD format or a dateparser string i.e. 5 days ago, 1 month ago, yesterday, etc. If left empty, all records are downloaded.",
    "propertyOrder": 5
  },
  "date_to": {
    "type": "string",
    "title": "To date [exclusive]",
    "default": "now",
    "description": "Date in YYYY-MM-DD format or a dateparser string i.e. 5 days ago, 1 month ago, yesterday, etc. If left empty, all records are downloaded.",
    "propertyOrder": 6
  }
}
```

Use the KDS tooling helper `get_date_period_converted(from_date, to_date)` in the component code to parse these values.

## Standard Loading Options Block

The standard Incremental vs. Full Load block using `enum` + `enum_titles`. Copy-paste into schemas that need load type control.

```json
{
  "loading_options": {
    "type": "object",
    "title": "Loading Options",
    "format": "grid",
    "propertyOrder": 400,
    "required": ["incremental_output", "date_since", "date_to"],
    "properties": {
      "date_since": {
        "type": "string",
        "title": "Period from date [including].",
        "default": "1 week ago",
        "description": "Date in YYYY-MM-DD format or dateparser string i.e. 5 days ago, 1 month ago, yesterday, etc.",
        "propertyOrder": 300
      },
      "date_to": {
        "type": "string",
        "title": "Period to date [excluding].",
        "default": "now",
        "description": "Date in YYYY-MM-DD format or dateparser string i.e. 5 days ago, 1 month ago, yesterday, etc.",
        "propertyOrder": 400
      },
      "incremental_output": {
        "type": "number",
        "title": "Load type",
        "enum": [0, 1],
        "options": {
          "enum_titles": ["Full Load", "Incremental Update"]
        },
        "default": 1,
        "description": "If set to Incremental update, the result tables will be updated based on primary key. Full load overwrites the destination table each time.",
        "propertyOrder": 450
      }
    }
  }
}
```

## Visual Separation of Sections

Use `"format": "grid"` on `type: "object"` to visually group related fields into a collapsible section with a header.

```json
{
  "advanced_settings": {
    "type": "object",
    "title": "Advanced Settings",
    "format": "grid",
    "propertyOrder": 500,
    "properties": {
      "timeout": {
        "type": "integer",
        "title": "Timeout (seconds)",
        "default": 30,
        "propertyOrder": 1
      },
      "retries": {
        "type": "integer",
        "title": "Max Retries",
        "default": 3,
        "propertyOrder": 2
      }
    }
  }
}
```

Use arrays with `"maxItems": 1` for fully optional sections (see [Optional Blocks Using Arrays](#optional-blocks-using-arrays)).

## Bulk Row Creation

Allows users to create multiple configuration rows at once from a dialog (e.g., by selecting multiple tables).

**Requirements:**
1. Define `createConfigurationRowSchema` in the Developer Portal — a JSON Schema for the row creation form.
2. Implement a `prepareRows` sync action in the component that returns rows in this format:

```json
[
  {
    "name": "table_name",
    "description": "Optional description",
    "configuration": "{\"parameters\": {\"table\": \"table_name\"}}"
  }
]
```

**Python implementation:**

```python
from keboola.component import sync_action

@sync_action("prepareRows")
def prepare_rows(self):
    rows = []
    for table in self.params.init_tables:
        row = {
            "name": table,
            "description": f"Extracts table: {table}",
            "configuration": {"parameters": {"table": table}},
        }
        rows.append(row)
    return rows
```

The Keboola UI then shows a "Create rows" dialog where the user selects items from the `createConfigurationRowSchema` form and all rows are created at once.

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
