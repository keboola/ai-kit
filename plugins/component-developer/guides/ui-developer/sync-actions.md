# Configuration Schema Sync Actions

Complete reference for dynamic UI elements including dropdowns, test connection, and validation buttons.

## Table of Contents

1. [Introduction](#introduction)
2. [Types of Sync Actions](#types-of-sync-actions)
3. [Dynamic Dropdowns](#dynamic-dropdowns)
4. [Test Connection Button](#test-connection-button)
5. [Validation Buttons](#validation-buttons)
6. [Sync Action Response Format](#sync-action-response-format)
7. [Common Sync Actions](#common-sync-actions)

## Introduction

Sync actions enable dynamic UI elements that communicate with the component backend to:
- Load dropdown options dynamically
- Validate configurations
- Test connections
- Perform other server-side operations

Sync actions are defined using the `links` property with `rel: "self"` or the `options.async` property.

## Types of Sync Actions

### 1. Dynamic Dropdowns
Load options from the server based on current configuration.

### 2. Test Connection
Verify credentials and connectivity before saving.

### 3. Validation Buttons
Validate specific fields or configurations.

### 4. Custom Actions
Perform any server-side operation and return results.

## Dynamic Dropdowns

Dynamic dropdowns load their options from the component backend.

### Basic Structure

```json
{
  "table": {
    "type": "string",
    "title": "Table",
    "format": "select",
    "propertyOrder": 1,
    "links": [
      {
        "rel": "self",
        "href": "/{{componentId}}/configs/{{configId}}/actions/loadTables",
        "method": "POST"
      }
    ],
    "options": {
      "async": {
        "label": "Load Tables",
        "action": "loadTables"
      }
    }
  }
}
```

### With Autoload

Automatically load options when the form opens:

```json
{
  "table": {
    "type": "string",
    "title": "Table",
    "format": "select",
    "options": {
      "async": {
        "label": "Load Tables",
        "action": "loadTables",
        "autoload": true
      }
    }
  }
}
```

### With Caching

Cache results to avoid repeated API calls:

```json
{
  "table": {
    "type": "string",
    "title": "Table",
    "format": "select",
    "options": {
      "async": {
        "label": "Load Tables",
        "action": "loadTables",
        "autoload": true,
        "cache": true
      }
    }
  }
}
```

### Dependent Dropdowns

Load options based on another field's value:

```json
{
  "database": {
    "type": "string",
    "title": "Database",
    "format": "select",
    "propertyOrder": 1,
    "options": {
      "async": {
        "label": "Load Databases",
        "action": "loadDatabases",
        "autoload": true
      }
    }
  },
  "table": {
    "type": "string",
    "title": "Table",
    "format": "select",
    "propertyOrder": 2,
    "options": {
      "async": {
        "label": "Load Tables",
        "action": "loadTables"
      }
    }
  }
}
```

The `loadTables` action receives the current form values including the selected database.

## Test Connection Button

Test connection buttons verify credentials before saving.

### Basic Structure

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

### With Custom Label

```json
{
  "test_connection": {
    "type": "button",
    "format": "test-connection",
    "options": {
      "async": {
        "label": "Verify Credentials",
        "action": "testConnection"
      }
    }
  }
}
```

### Complete Example with Credentials

```json
{
  "type": "object",
  "title": "Configuration",
  "required": ["host", "#password"],
  "properties": {
    "host": {
      "type": "string",
      "title": "Host",
      "propertyOrder": 1
    },
    "port": {
      "type": "integer",
      "title": "Port",
      "default": 5432,
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
    },
    "test_connection": {
      "type": "button",
      "format": "test-connection",
      "propertyOrder": 5,
      "options": {
        "async": {
          "label": "Test Connection",
          "action": "testConnection"
        }
      }
    }
  }
}
```

## Validation Buttons

Validation buttons check specific fields or configurations.

### Basic Structure

```json
{
  "validate_query": {
    "type": "button",
    "format": "sync-action",
    "propertyOrder": 10,
    "options": {
      "async": {
        "label": "Validate Query",
        "action": "validateQuery"
      }
    }
  }
}
```

### SQL Query Validation Example

```json
{
  "query": {
    "type": "string",
    "title": "SQL Query",
    "format": "editor",
    "propertyOrder": 1,
    "options": {
      "editor": {
        "mode": "text/x-sql"
      }
    }
  },
  "validate_query": {
    "type": "button",
    "format": "sync-action",
    "propertyOrder": 2,
    "options": {
      "async": {
        "label": "Validate SQL",
        "action": "validateQuery"
      }
    }
  }
}
```

### SOQL Query Validation (Salesforce Example)

```json
{
  "soql": {
    "type": "string",
    "title": "SOQL Query",
    "format": "editor",
    "propertyOrder": 1,
    "options": {
      "editor": {
        "mode": "text/x-sql"
      }
    }
  },
  "validate_soql": {
    "type": "button",
    "format": "sync-action",
    "propertyOrder": 2,
    "options": {
      "async": {
        "label": "Validate SOQL",
        "action": "validateSoql"
      }
    }
  }
}
```

## Sync Action Response Format

### Success Response

```json
{
  "status": "success",
  "message": "Connection successful"
}
```

### Error Response

```json
{
  "status": "error",
  "message": "Connection failed: Invalid credentials"
}
```

### Dropdown Options Response

```json
{
  "status": "success",
  "data": [
    {"value": "table1", "label": "Table 1"},
    {"value": "table2", "label": "Table 2"},
    {"value": "table3", "label": "Table 3"}
  ]
}
```

### Alternative Dropdown Format

```json
{
  "status": "success",
  "data": {
    "values": ["table1", "table2", "table3"],
    "labels": ["Table 1", "Table 2", "Table 3"]
  }
}
```

## Common Sync Actions

Based on analysis of 888+ production components, here are the most common sync actions:

### Connection & Authentication

| Action | Description |
|--------|-------------|
| `testConnection` | Test database/API connection |
| `testCredentials` | Verify credentials |
| `authorize` | OAuth authorization |
| `refreshToken` | Refresh OAuth token |

### Data Loading

| Action | Description |
|--------|-------------|
| `loadTables` | Load available tables |
| `loadDatabases` | Load available databases |
| `loadSchemas` | Load database schemas |
| `loadColumns` | Load table columns |
| `loadFields` | Load object fields |
| `loadObjects` | Load available objects |
| `loadProfiles` | Load user profiles |
| `loadAccounts` | Load accounts |
| `loadWorkspaces` | Load workspaces |
| `loadProjects` | Load projects |

### Validation

| Action | Description |
|--------|-------------|
| `validateQuery` | Validate SQL query |
| `validateSoql` | Validate SOQL query |
| `validateConfig` | Validate configuration |
| `validateMapping` | Validate field mapping |

### Metadata

| Action | Description |
|--------|-------------|
| `loadPrimaryKeys` | Load possible primary keys |
| `loadPossiblePrimaryKeys` | Load primary key candidates |
| `loadMetadata` | Load object metadata |
| `describeObject` | Get object description |

### Real Production Example: Salesforce Extractor

```json
{
  "type": "object",
  "title": "Salesforce Configuration",
  "properties": {
    "login_type": {
      "type": "string",
      "title": "Login Type",
      "enum": ["password", "oauth"],
      "enum_titles": ["Username & Password", "OAuth"],
      "default": "password",
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
    "#security_token": {
      "type": "string",
      "title": "Security Token",
      "format": "password",
      "propertyOrder": 4
    },
    "test_connection": {
      "type": "button",
      "format": "test-connection",
      "propertyOrder": 5,
      "options": {
        "async": {
          "label": "Test Connection",
          "action": "testConnection"
        }
      }
    }
  },
  "dependencies": {
    "login_type": {
      "oneOf": [
        {
          "properties": {
            "login_type": {"enum": ["password"]},
            "username": {"type": "string"},
            "#password": {"type": "string"},
            "#security_token": {"type": "string"}
          },
          "required": ["username", "#password"]
        },
        {
          "properties": {
            "login_type": {"enum": ["oauth"]}
          }
        }
      ]
    }
  }
}
```

### Row Schema with Dynamic Dropdowns

```json
{
  "type": "object",
  "title": "Table Configuration",
  "properties": {
    "object": {
      "type": "string",
      "title": "Salesforce Object",
      "format": "select",
      "propertyOrder": 1,
      "options": {
        "async": {
          "label": "Load Objects",
          "action": "loadObjects",
          "autoload": true,
          "cache": true
        }
      }
    },
    "fields": {
      "type": "array",
      "title": "Fields",
      "format": "select",
      "propertyOrder": 2,
      "items": {
        "type": "string"
      },
      "options": {
        "async": {
          "label": "Load Fields",
          "action": "loadFields"
        }
      }
    },
    "primary_key": {
      "type": "string",
      "title": "Primary Key",
      "format": "select",
      "propertyOrder": 3,
      "options": {
        "async": {
          "label": "Load Primary Keys",
          "action": "loadPossiblePrimaryKeys"
        }
      }
    },
    "soql": {
      "type": "string",
      "title": "Custom SOQL Query",
      "format": "editor",
      "propertyOrder": 4,
      "options": {
        "editor": {
          "mode": "text/x-sql"
        }
      }
    },
    "validate_soql": {
      "type": "button",
      "format": "sync-action",
      "propertyOrder": 5,
      "options": {
        "async": {
          "label": "Validate SOQL",
          "action": "validateSoql"
        }
      }
    }
  }
}
```

## Related Documentation

- [Overview](configuration-schema-overview.md) - Introduction and basics
- [UI Elements](configuration-schema-ui-elements.md) - Field formats and options
- [Advanced Patterns](configuration-schema-advanced.md) - Confluence best practices
- [Examples](configuration-schema-examples.md) - Real production examples
