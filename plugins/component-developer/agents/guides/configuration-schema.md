# Keboola Component Configuration Schema Documentation for AI

**Version 3.0 - With Real Production Examples and Confluence Best Practices**

This comprehensive documentation explains how to create and configure `configSchema.json` and `configRowSchema.json` files for Keboola components. All examples in this document are extracted from real production components in the Keboola Storage API (connection.us-east4.gcp.keboola.com) and internal Confluence documentation.

## Sources

- **Keboola Storage API**: Real production component schemas from 888+ components
- **Confluence Documentation**: UI Elements (JSON Schema) & App Configuration internal guide
- **Developer Documentation**: Official Keboola developer documentation

---

## Table of Contents

1. [Overview](#overview)
2. [File Structure and Location](#file-structure-and-location)
3. [JSON Schema Basics](#json-schema-basics)
4. [Configuration Schema (configSchema.json)](#configuration-schema-configschemajson)
5. [Configuration Row Schema (configRowSchema.json)](#configuration-row-schema-configrowschemajson)
6. [UI Options and Flags](#ui-options-and-flags)
7. [Field Formats and UI Elements](#field-formats-and-ui-elements)
8. [Sync Actions for Dynamic UI](#sync-actions-for-dynamic-ui)
9. [Default Configurations](#default-configurations)
10. [Code Pattern Components](#code-pattern-components)
11. [Validation Rules and Constraints](#validation-rules-and-constraints)
12. [Best Practices](#best-practices)
13. [Advanced UI Patterns (from Confluence)](#advanced-ui-patterns-from-confluence)
14. [UI Development Tools](#ui-development-tools)
15. [Real Production Examples](#real-production-examples)
16. [Quick Reference](#quick-reference)
17. [API Statistics](#api-statistics)

---

## Overview

### What are Configuration Schemas?

Configuration schemas define the structure and UI for component configuration in Keboola. They use [JSON Schema](https://json-schema.org/) format to:

1. **Define the configuration structure** - What parameters the component accepts
2. **Generate UI forms** - Automatically create user-friendly configuration forms
3. **Validate user input** - Ensure configurations meet requirements
4. **Provide documentation** - Titles and descriptions guide users

### Two Types of Schemas

| Schema File | Purpose | When Used |
|-------------|---------|-----------|
| `configSchema.json` | Component-level configuration | Main configuration that applies to the entire component instance |
| `configRowSchema.json` | Row-level configuration | Configuration for individual rows (iterations) within a component |

### How Schemas Integrate with Component Lifecycle

1. **Registration**: Schemas are uploaded to the Developer Portal when registering/updating a component
2. **Storage**: The Storage API stores schemas and serves them to the UI
3. **Rendering**: The Keboola UI renders forms based on the schemas
4. **Validation**: User input is validated against the schema before saving
5. **Execution**: The component receives the validated configuration at runtime

---

## File Structure and Location

### Directory Structure

```
component_config/
├── configSchema.json       # Component-level configuration schema
├── configRowSchema.json    # Row-level configuration schema (optional)
└── component_long_description.md  # Long description (optional)
```

### File Requirements

- Files must be valid JSON
- Maximum size: **256 KB** for schema files
- Empty schema `{}` is valid (results in raw JSON editor)
- Files are uploaded via the Developer Portal

---

## JSON Schema Basics

### Root Structure

Every configuration schema follows this basic structure:

```json
{
  "type": "object",
  "title": "Configuration",
  "required": ["field1", "field2"],
  "properties": {
    "field1": { ... },
    "field2": { ... }
  }
}
```

### Essential Properties

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Always `"object"` for root schema |
| `title` | string | Form title displayed in UI |
| `required` | array | List of required field names |
| `properties` | object | Field definitions |
| `propertyOrder` | number | Controls field display order (lower = higher) |

### Field Definition Structure

Each field in `properties` can have:

```json
{
  "fieldName": {
    "type": "string",
    "title": "Field Title",
    "description": "Help text shown below the field",
    "default": "default value",
    "format": "password",
    "propertyOrder": 100,
    "options": {
      "dependencies": { ... },
      "tooltip": "Hover text"
    }
  }
}
```

---

## Configuration Schema (configSchema.json)

The `configSchema.json` defines the main component configuration. This is the "root" configuration that applies to the entire component instance.

### Key Characteristics

- Defines credentials, connection settings, and global options
- Values are available to all configuration rows
- Typically contains authentication and shared settings

### Real Example: Salesforce Extractor (kds-team.ex-salesforce-v2)

This is a real production schema from the Keboola Storage API:

```json
{
  "type": "object",
  "title": "Salesforce Credentials",
  "format": "table",
  "$schema": "http://json-schema.org/draft-04/schema#",
  "required": ["username", "#password", "api_version"],
  "properties": {
    "login_method": {
      "enum": ["security_token", "connected_app", "connected_app_oauth_cc"],
      "type": "string",
      "title": "Login Method",
      "default": "security_token",
      "options": {
        "enum_titles": [
          "Security Token with Username and Password",
          "Connected App with Username and Password",
          "Connected App OAuth Client 2.0 Client Credentials"
        ]
      },
      "description": "Specify the login method you wish to use",
      "propertyOrder": 1
    },
    "username": {
      "type": "string",
      "title": "Login Name",
      "default": "",
      "options": {
        "dependencies": {
          "login_method": ["security_token", "connected_app"]
        }
      },
      "minLength": 1,
      "description": "Login name for Salesforce",
      "propertyOrder": 10
    },
    "#password": {
      "type": "string",
      "title": "Password",
      "format": "password",
      "default": "",
      "options": {
        "dependencies": {
          "login_method": ["security_token", "connected_app"]
        }
      },
      "minLength": 1,
      "description": "Salesforce password",
      "propertyOrder": 20
    },
    "#security_token": {
      "type": "string",
      "title": "Security token",
      "format": "password",
      "default": "",
      "options": {
        "dependencies": {
          "login_method": "security_token"
        }
      },
      "description": "Salesforce security token",
      "propertyOrder": 30
    },
    "domain": {
      "type": "string",
      "title": "Domain",
      "default": "",
      "options": {
        "dependencies": {
          "login_method": "connected_app_oauth_cc"
        }
      },
      "description": "Your Salesforce Domain. For example: https://keboola-dev-ed.my.salesforce.com",
      "propertyOrder": 30
    },
    "#consumer_key": {
      "type": "string",
      "title": "Consumer Key",
      "format": "password",
      "options": {
        "dependencies": {
          "login_method": ["connected_app", "connected_app_oauth_cc"]
        }
      },
      "description": "Salesforce Connected App Consumer Key",
      "propertyOrder": 33
    },
    "#consumer_secret": {
      "type": "string",
      "title": "Consumer Secret",
      "format": "password",
      "options": {
        "dependencies": {
          "login_method": ["connected_app", "connected_app_oauth_cc"]
        }
      },
      "description": "Salesforce Connected App Consumer Secret",
      "propertyOrder": 36
    },
    "sandbox": {
      "type": "boolean",
      "title": "Sandbox",
      "format": "checkbox",
      "options": {
        "dependencies": {
          "login_method": ["security_token", "connected_app"]
        }
      },
      "description": "Download records from sandbox instead of the production environment.",
      "propertyOrder": 40
    },
    "api_version": {
      "enum": ["52.0", "53.0", "54.0", "55.0", "56.0", "57.0", "58.0", "59.0", "60.0", "61.0", "62.0"],
      "type": "string",
      "title": "API version",
      "default": "62.0",
      "description": "Specify the version of API you want to extract data from",
      "propertyOrder": 50
    },
    "proxy": {
      "type": "object",
      "title": "Proxy Settings",
      "format": "grid-strict",
      "properties": {
        "use_proxy": {
          "type": "boolean",
          "title": "Use Proxy",
          "format": "checkbox",
          "default": false,
          "options": {
            "grid_break": true,
            "grid_columns": 6
          },
          "propertyOrder": 1
        },
        "proxy_server": {
          "type": "string",
          "title": "HTTPS Proxy Server Address",
          "options": {
            "dependencies": { "use_proxy": true },
            "grid_columns": 8
          },
          "propertyOrder": 2
        },
        "proxy_port": {
          "type": "string",
          "title": "HTTPS Proxy Server Port",
          "options": {
            "dependencies": { "use_proxy": true },
            "grid_columns": 4
          },
          "propertyOrder": 3
        },
        "basic_auth": {
          "type": "boolean",
          "title": "Basic Authentication",
          "format": "checkbox",
          "default": false,
          "options": {
            "grid_break": true,
            "dependencies": { "use_proxy": true },
            "grid_columns": 6
          },
          "propertyOrder": 6
        },
        "username": {
          "type": "string",
          "title": "HTTPS Proxy Server Username",
          "options": {
            "dependencies": { "use_proxy": true, "basic_auth": true }
          },
          "propertyOrder": 10
        },
        "#password": {
          "type": "string",
          "title": "HTTPS Proxy Server Password",
          "format": "password",
          "options": {
            "dependencies": { "use_proxy": true, "basic_auth": true }
          },
          "propertyOrder": 15
        }
      },
      "description": "Proxy address will be constructed in (username:password@)your.proxy.server.com(:port) format.",
      "propertyOrder": 60
    },
    "test_connection": {
      "type": "button",
      "format": "test-connection",
      "propertyOrder": 70
    }
  }
}
```

**Key Features Demonstrated:**
- `enum` with `enum_titles` for user-friendly dropdown labels
- `format: "password"` for encrypted fields (note the `#` prefix)
- `options.dependencies` for conditional field visibility
- Nested `object` with `format: "grid-strict"` for layout
- `grid_columns` and `grid_break` for responsive grid layout
- `format: "checkbox"` for boolean fields
- `format: "test-connection"` for test connection button

---

## Configuration Row Schema (configRowSchema.json)

The `configRowSchema.json` defines the schema for individual configuration rows. Each row represents a separate iteration of the component execution.

### Key Characteristics

- Each row is executed separately
- Row configuration is merged with root configuration (row values override root)
- Typically contains query definitions, table selections, or task-specific settings

### Real Example: Salesforce Extractor Row Schema (kds-team.ex-salesforce-v2)

```json
{
  "type": "object",
  "title": "Query Configuration",
  "required": ["query_type_selector"],
  "properties": {
    "query_type_selector": {
      "enum": ["Object", "Custom SOQL"],
      "type": "string",
      "title": "Query type",
      "default": "Object",
      "propertyOrder": 1
    },
    "object": {
      "enum": [],
      "type": "string",
      "items": {
        "enum": [],
        "type": "string"
      },
      "title": "Object Name",
      "format": "select",
      "options": {
        "async": {
          "label": "Re-load Objects",
          "action": "loadObjects"
        },
        "dependencies": {
          "query_type_selector": "Object"
        }
      },
      "description": "Salesforce object identifier, eg. Contact",
      "propertyOrder": 2
    },
    "fields": {
      "enum": [],
      "type": "array",
      "items": {
        "enum": [],
        "type": "string"
      },
      "title": "Fields (optional)",
      "format": "select",
      "options": {
        "async": {
          "label": "Load Fields",
          "action": "loadFields"
        },
        "dependencies": {
          "query_type_selector": "Object"
        }
      },
      "description": "Salesforce fields to fetch. If left empty, all fields will be downloaded.",
      "uniqueItems": true,
      "propertyOrder": 3
    },
    "soql_query": {
      "type": "string",
      "title": "SOQL Query",
      "format": "textarea",
      "options": {
        "dependencies": {
          "query_type_selector": "Custom SOQL"
        }
      },
      "description": "Specify the SOQL query, eg. SELECT Id, FirstName, LastName FROM Contact.",
      "propertyOrder": 4
    },
    "validation_button": {
      "type": "button",
      "format": "sync-action",
      "options": {
        "async": {
          "label": "Test Query",
          "action": "testQuery"
        },
        "dependencies": {
          "query_type_selector": "Custom SOQL"
        }
      },
      "propertyOrder": 5
    },
    "is_deleted": {
      "type": "boolean",
      "title": "Get deleted records",
      "format": "checkbox",
      "default": false,
      "description": "Fetch records that have been deleted",
      "propertyOrder": 6
    },
    "loading_options": {
      "type": "object",
      "title": "Loading Options",
      "required": ["incremental"],
      "properties": {
        "output_table_name": {
          "type": "string",
          "title": "Storage Table Name",
          "description": "Override the default name of the table in Storage",
          "propertyOrder": 20
        },
        "incremental": {
          "enum": [0, 1],
          "type": "integer",
          "title": "Load type",
          "default": 0,
          "options": {
            "enum_titles": ["Full Load", "Incremental Update"]
          },
          "description": "If set to Incremental update, the result tables will be updated based on primary key.",
          "propertyOrder": 200
        },
        "incremental_fetch": {
          "type": "boolean",
          "title": "Incremental fetch",
          "format": "checkbox",
          "default": false,
          "options": {
            "dependencies": {
              "incremental": 1
            }
          },
          "description": "Fetch records that have been updated since the last run",
          "propertyOrder": 250
        },
        "incremental_field": {
          "enum": [],
          "type": "string",
          "title": "Incremental Field",
          "format": "select",
          "options": {
            "async": {
              "label": "Re-load Fields",
              "action": "loadPossibleIncrementalField"
            },
            "dependencies": {
              "incremental": 1,
              "incremental_fetch": true
            }
          },
          "description": "Field to use for incremental fetching, eg. LastModifiedDate",
          "propertyOrder": 300
        },
        "incremental_overlap_seconds": {
          "type": "integer",
          "title": "Incremental Overlap (seconds)",
          "default": 0,
          "minimum": 0,
          "options": {
            "dependencies": {
              "incremental": 1,
              "incremental_fetch": true
            }
          },
          "description": "Seconds to subtract from last watermark to prevent missing records",
          "propertyOrder": 350
        },
        "pkey": {
          "type": "array",
          "items": {
            "enum": [],
            "type": "string"
          },
          "title": "Primary key",
          "format": "select",
          "default": ["Id"],
          "options": {
            "async": {
              "label": "Re-load Fields",
              "action": "loadPossiblePrimaryKeys"
            }
          },
          "uniqueItems": true,
          "propertyOrder": 5000
        }
      },
      "propertyOrder": 100
    }
  }
}
```

**Key Features Demonstrated:**
- Dynamic dropdowns with `options.async` for sync actions
- `format: "select"` for dropdown fields
- `format: "textarea"` for multi-line text input
- `format: "sync-action"` for validation buttons
- Nested dependencies (e.g., `incremental_field` depends on both `incremental: 1` AND `incremental_fetch: true`)
- `uniqueItems: true` for arrays to prevent duplicates

---

## UI Options and Flags

### Available UI Flags

UI flags control which UI elements are shown for a component. Set these in the Developer Portal.

| Flag | Description |
|------|-------------|
| `genericDockerUI` | Base UI with configuration form |
| `genericDockerUI-rows` | Enable configuration rows |
| `genericDockerUI-tableInput` | Show table input mapping |
| `genericDockerUI-fileInput` | Show file input mapping |
| `genericDockerUI-tableOutput` | Show table output mapping |
| `genericDockerUI-fileOutput` | Show file output mapping |
| `genericDockerUI-authorization` | Show OAuth authorization |
| `genericDockerUI-processors` | Show processors configuration |
| `genericDockerUI-resetState` | Show reset state button |
| `genericDockerUI-simpleTableInput` | Simplified table input |
| `genericCodeBlocksUI` | Code blocks UI (transformations) |
| `genericTemplatesUI` | Templates UI |
| `genericPackagesUI` | Packages UI |
| `appInfo.dataIn` | Show data input info |
| `appInfo.dataOut` | Show data output info |
| `appInfo.beta` | Mark as beta |
| `appInfo.experimental` | Mark as experimental |

### Default UI Options by Component Type

| Component Type | Default UI Options |
|----------------|-------------------|
| `extractor` | `genericDockerUI` |
| `writer` | `genericDockerUI`, `genericDockerUI-tableInput` |
| `application` | `genericDockerUI`, `genericDockerUI-tableInput`, `genericDockerUI-tableOutput` |
| `processor` | (none - uses raw JSON) |
| `transformation` | `genericCodeBlocksUI` |
| `code-pattern` | `genericCodeBlocksUI` |
| `data-app` | (custom UI) |

### Real Example: Component Flags

From **kds-team.ex-salesforce-v2**:
```json
{
  "flags": ["genericDockerUI", "genericDockerUI-rows"]
}
```

From **kds-team.app-snowflake-query-runner**:
```json
{
  "flags": ["genericDockerUI", "genericDockerUI-rows", "appInfo.beta"]
}
```

---

## Field Formats and UI Elements

### String Formats

| Format | Description | Example |
|--------|-------------|---------|
| `password` | Masked input, value encrypted | API keys, passwords |
| `textarea` | Multi-line text input | Long text, queries |
| `editor` | Code editor with syntax highlighting | SQL, Python, JSON |
| `select` | Dropdown selection | Single choice from list |
| `trim` | Auto-trim whitespace | Clean text input |
| `date` | Date picker | Date selection |
| `uri` | URL input with validation | Endpoint URLs |

### Boolean Formats

| Format | Description |
|--------|-------------|
| `checkbox` | Checkbox toggle |
| (default) | Dropdown with true/false |

### Array Formats

| Format | Description |
|--------|-------------|
| `select` | Multi-select dropdown |
| `checkbox` | Multiple checkboxes |
| `table` | Editable table |

### Button Formats

| Format | Description |
|--------|-------------|
| `test-connection` | Test connection button (calls `testConnection` action) |
| `sync-action` | Custom sync action button |

### Code Editor Languages

Use `format: "editor"` with `options.editor.mode`:

| Mode | Language |
|------|----------|
| `text/x-sql` | SQL |
| `text/x-python` | Python |
| `text/x-rsrc` | R |
| `text/x-julia` | Julia |
| `application/json` | JSON |
| `text/x-markdown` | Markdown |

### Real Example: SQL Code Editor (kds-team.app-snowflake-query-runner)

```json
{
  "query": {
    "type": "string",
    "title": "Query",
    "format": "editor",
    "options": {
      "editor": {
        "mode": "text/x-sql"
      }
    },
    "description": "Query to execute",
    "propertyOrder": 300
  }
}
```

### Real Example: Date Picker (actum.ex-zbozicz-report-extractor)

```json
{
  "dateFrom": {
    "type": "string",
    "title": "Date From",
    "format": "date",
    "description": "Optional. If left empty, defaults to 3 days ago."
  },
  "dateTo": {
    "type": "string",
    "title": "Date To",
    "format": "date",
    "description": "Optional. If left empty, defaults to today."
  }
}
```

---

## Sync Actions for Dynamic UI

Sync actions allow the UI to call component endpoints to dynamically populate dropdowns, validate input, or test connections.

### Types of Sync Actions

1. **Dynamic Dropdowns** - Populate dropdown options from API
2. **Test Connection** - Verify credentials work
3. **Validation Buttons** - Validate specific input (e.g., test query)

### Dynamic Dropdown Structure

```json
{
  "fieldName": {
    "enum": [],
    "type": "string",
    "title": "Select Option",
    "format": "select",
    "options": {
      "async": {
        "label": "Load Options",
        "action": "actionName"
      }
    }
  }
}
```

**Key Properties:**
- `enum: []` - Empty array, populated by sync action
- `format: "select"` - Renders as dropdown
- `options.async.action` - Name of the sync action to call
- `options.async.label` - Button label to reload options

### Test Connection Button

```json
{
  "test_connection": {
    "type": "button",
    "format": "test-connection",
    "propertyOrder": 100
  }
}
```

This automatically calls the `testConnection` action defined in the component.

### Custom Sync Action Button

```json
{
  "validation_button": {
    "type": "button",
    "format": "sync-action",
    "options": {
      "async": {
        "label": "Test Query",
        "action": "testQuery"
      }
    },
    "propertyOrder": 100
  }
}
```

### Sync Action Response Format

The component must return JSON in this format:

```json
{
  "status": "success",
  "values": ["option1", "option2", "option3"]
}
```

Or with labels:

```json
{
  "status": "success",
  "values": [
    {"value": "opt1", "label": "Option 1"},
    {"value": "opt2", "label": "Option 2"}
  ]
}
```

### Real Example: Multiple Sync Actions (kds-team.ex-salesforce-v2)

The Salesforce extractor defines these sync actions:
- `loadObjects` - Load available Salesforce objects
- `loadFields` - Load fields for selected object
- `loadPossiblePrimaryKeys` - Load possible primary key fields
- `loadPossibleIncrementalField` - Load date fields for incremental fetch
- `testConnection` - Test Salesforce credentials
- `testQuery` - Validate SOQL query

Component actions array:
```json
{
  "actions": [
    "loadFields",
    "loadObjects",
    "loadPossibleIncrementalField",
    "loadPossiblePrimaryKeys",
    "testConnection",
    "testQuery"
  ]
}
```

---

## Default Configurations

### emptyConfiguration

The `emptyConfiguration` field defines the initial configuration when a user creates a new component configuration. This is useful for setting sensible defaults.

```json
{
  "emptyConfiguration": {
    "parameters": {
      "api_version": "v2",
      "incremental": true
    }
  }
}
```

### emptyConfigurationRow

The `emptyConfigurationRow` field defines the initial configuration for new rows.

```json
{
  "emptyConfigurationRow": {
    "parameters": {
      "incremental": false,
      "primary_key": ["id"]
    }
  }
}
```

### configurationDescription

Markdown text displayed above the configuration form. Supports HTML.

```json
{
  "configurationDescription": "## Configuration\n\nThis extractor downloads data from the API.\n\n### Prerequisites\n\n- API key from the dashboard\n- Account ID"
}
```

### Real Example: Configuration Description (kds-team.app-snowflake-query-runner)

```json
{
  "configurationDescription": "## Configuration-Specific Parameters\n\nThe following parameters need to be specified to connect successfully to a Snowflake instance:\n\n- `account`: Snowflake account name\n- `username`: Snowflake user\n- `#password`: Password for the specified Snowflake user\n- `warehouse`: Name of the Snowflake warehouse\n\n## Row-Specific Parameters\n\nEach row allows to specify a query to be run:\n\n- `database`: Name of the Snowflake database\n- `schema`: Snowflake schema\n- `query`: Query to execute"
}
```

---

## Code Pattern Components

Code pattern components are special components that generate code for transformations.

### Special Requirements

1. **Component Type**: Must be `code-pattern`
2. **supported_components**: Must specify which transformation types are supported

### supported_components Field

Add to the root of `configurationSchema`:

```json
{
  "type": "object",
  "title": "Code Pattern Configuration",
  "supported_components": [
    "keboola.snowflake-transformation",
    "keboola.synapse-transformation",
    "keboola.google-bigquery-transformation"
  ],
  "properties": {
    ...
  }
}
```

### Available Transformation Components

| Component ID | Description |
|--------------|-------------|
| `keboola.snowflake-transformation` | Snowflake SQL |
| `keboola.synapse-transformation` | Azure Synapse SQL |
| `keboola.google-bigquery-transformation` | BigQuery SQL |
| `keboola.python-transformation-v2` | Python |
| `keboola.r-transformation-v2` | R |
| `keboola.julia-transformation` | Julia |

### Code Pattern Actions

Code patterns implement only the `generate` action, which returns the generated code.

---

## Validation Rules and Constraints

### Developer Portal Constraints

| Field | Max Size |
|-------|----------|
| `configurationSchema` | 256 KB |
| `configurationRowSchema` | 256 KB |
| `configurationDescription` | 64 KB |
| `emptyConfiguration` | 256 KB |
| `emptyConfigurationRow` | 256 KB |

### JSON Schema Validation

| Property | Description |
|----------|-------------|
| `required` | Array of required field names |
| `minLength` | Minimum string length |
| `maxLength` | Maximum string length |
| `minimum` | Minimum number value |
| `maximum` | Maximum number value |
| `pattern` | Regex pattern for strings |
| `enum` | Allowed values |
| `uniqueItems` | Array items must be unique |

### Real Example: Validation (actum.ex-zbozicz-report-extractor)

```json
{
  "reportsToDownload": {
    "type": "integer",
    "title": "How many last reports to download",
    "default": 7,
    "maximum": 50,
    "minimum": 1,
    "description": "How many recent reports do you want to merge and download? (max 50)"
  }
}
```

---

## Best Practices

### 1. Always Use propertyOrder

Fields are displayed in order of `propertyOrder`. Always specify this to ensure consistent field ordering.

```json
{
  "username": { "propertyOrder": 100 },
  "password": { "propertyOrder": 200 },
  "options": { "propertyOrder": 300 }
}
```

### 2. Use Descriptive Titles

- Don't end titles with colons or periods
- Use sentence case
- Be concise but clear

```json
{
  "title": "API Key",
  "title": "Database Connection",
  "title": "Output Table Name"
}
```

### 3. Encrypt Sensitive Data

Always prefix sensitive fields with `#` and use `format: "password"`:

```json
{
  "#api_key": {
    "type": "string",
    "title": "API Key",
    "format": "password"
  }
}
```

### 4. Group Related Fields

Use nested objects to group related fields:

```json
{
  "connection": {
    "type": "object",
    "title": "Connection Settings",
    "properties": {
      "host": { ... },
      "port": { ... },
      "database": { ... }
    }
  }
}
```

### 5. Use Dependencies for Conditional Fields

Show/hide fields based on other field values:

```json
{
  "auth_type": {
    "enum": ["password", "key_pair"],
    "type": "string",
    "title": "Authentication Type"
  },
  "#password": {
    "type": "string",
    "format": "password",
    "options": {
      "dependencies": {
        "auth_type": "password"
      }
    }
  },
  "#private_key": {
    "type": "string",
    "format": "textarea",
    "options": {
      "dependencies": {
        "auth_type": "key_pair"
      }
    }
  }
}
```

### 6. Provide Helpful Descriptions

Include examples and links in descriptions:

```json
{
  "description": "Account identifier of the Snowflake instance. This is a prefix of your Snowflake instance URL, e.g., <strong>keboola.eu-central-1</strong>. See <a href='https://docs.snowflake.com/'>the documentation</a>."
}
```

### 7. Use enum_titles for User-Friendly Labels

```json
{
  "load_type": {
    "enum": [0, 1],
    "type": "integer",
    "options": {
      "enum_titles": ["Full Load", "Incremental Update"]
    }
  }
}
```

### 8. Set Sensible Defaults

```json
{
  "api_version": {
    "type": "string",
    "default": "v2"
  },
  "incremental": {
    "type": "boolean",
    "default": false
  }
}
```

### 9. Use Grid Layout for Complex Forms

```json
{
  "type": "object",
  "format": "grid-strict",
  "properties": {
    "field1": {
      "options": { "grid_columns": 6 }
    },
    "field2": {
      "options": { "grid_columns": 6, "grid_break": true }
    }
  }
}
```

### 10. Include Test Connection

Always include a test connection button for components with credentials:

```json
{
  "test_connection": {
    "type": "button",
    "format": "test-connection",
    "propertyOrder": 9999
  }
}
```

---

## Advanced UI Patterns (from Confluence)

This section contains advanced UI patterns and best practices from the internal Keboola Confluence documentation.

### Placeholder Hints Inside Inputs

For better UX, provide users with hints of what kind of value should be in the input element:

```json
{
  "shop_name": {
    "type": "string",
    "title": "Shop Name",
    "propertyOrder": 1
  },
  "base_url": {
    "type": "string",
    "title": "Base URL",
    "options": {
      "inputAttributes": {
        "placeholder": "https://www.myshop.cz"
      }
    },
    "propertyOrder": 2
  }
}
```

### Element Tooltips

Additional description with optional links:

```json
{
  "test_tooltip": {
    "type": "string",
    "title": "Example tooltip",
    "options": {
      "tooltip": "custom tooltip, default is Open documentation"
    },
    "description": "Test value.",
    "propertyOrder": 1
  }
}
```

**Tooltip with documentation link:**

```json
{
  "options": {
    "documentation": {
      "link": "absolute_url",
      "tooltip": "custom tooltip, default is Open documentation"
    }
  }
}
```

### Read Only Inputs

Sometimes you need inputs that are not editable:

```json
{
  "api_version": {
    "type": "string",
    "title": "API version",
    "default": "2022-04",
    "description": "The API version, gets updated regularly based on the <a href=\"https://shopify.dev/api/usage/versioning#release-schedule\">Shopify release cycle</a>",
    "propertyOrder": 251,
    "readOnly": true
  }
}
```

### Creatable Dropdown of Values

Add `options.creatable=true` to allow users to add custom values (works also for multiselects):

```json
{
  "region": {
    "type": "string",
    "title": "Region",
    "options": {
      "tags": true,
      "creatable": true
    },
    "enum": [
      "US",
      "EU",
      "AZURE-EU",
      "GCP-EU-W3",
      "GCP-US-E4"
    ],
    "propertyOrder": 500,
    "default": "AZURE-EU"
  }
}
```

### Required Fields & Drop Down Enums

When defining an enum field there will be a default empty value if the field is not required.

**Important:** When adding new required field, never use `required` list on the parent object because this will break existing CLI integrations. Always use the `required` bool option on the field itself:

```json
{
  "types": {
    "type": "array",
    "required": true,
    "items": {
      "enum": ["page", "event"],
      "type": "string"
    }
  }
}
```

### SSH Key Pair (Generate or Upload)

```json
{
  "ssh_keys": {
    "type": "object",
    "format": "ssh-editor",
    "options": {
      "only_keys": true
    }
  }
}
```

### SSH Tunnel Block

Generates a complete SSH Tunnel configuration block:

```json
{
  "ssh_options": {
    "type": "object",
    "format": "ssh-editor",
    "propertyOrder": 60
  }
}
```

The UI generates the Private & Public key pair using the `keboola.ssh-keygen-v2` component.

**The resulting configuration object is:**

```json
{
  "enabled": true,
  "keys": {
    "public": "ssh-rsa XXX",
    "#private": "XXX"
  },
  "sshHost": "hostname",
  "user": "username",
  "sshPort": 22
}
```

### Backfilling Configuration

Consider adding an option to easily backfill with historical data when designing an extractor component:

```json
{
  "backfill_mode": {
    "type": "object",
    "format": "grid",
    "required": ["backfill_enabled", "backfill_max_window"],
    "title": "Backfill mode",
    "description": "If backfill mode is enabled, each consecutive run of the component will continue from the end of the last run period, until current date is reached.",
    "propertyOrder": 455,
    "properties": {
      "backfill_enabled": {
        "type": "boolean",
        "enum": [false, true],
        "default": false,
        "options": {
          "enum_titles": ["No", "Yes"]
        }
      },
      "backfill_max_window": {
        "type": "number",
        "title": "Size of the backfill window in days",
        "description": "Set maximum number of days that will be used to split the reported interval."
      }
    }
  }
}
```

### Optional Blocks Using Arrays

Create an array with parameter `"maxItems": 1` to create optional blocks:

```json
{
  "customers": {
    "type": "array",
    "title": "Customers",
    "description": "Download Customers.",
    "propertyOrder": 4000,
    "maxItems": 1,
    "items": {
      "type": "object",
      "title": "Setup",
      "required": ["filters", "attributes"],
      "properties": {
        "filters": {
          "type": "string",
          "title": "Filter",
          "description": "Optional JSON filter. If left empty, all users are downloaded",
          "format": "textarea",
          "propertyOrder": 1
        },
        "attributes": {
          "type": "string",
          "title": "Attributes",
          "format": "textarea",
          "options": {
            "input_height": "100px"
          },
          "description": "Comma separated list of required customer attributes.",
          "propertyOrder": 700
        }
      }
    }
  }
}
```

### Dependencies Across Nested Objects

There is a bug that causes dependencies not to work between nested objects of different levels. This can be fixed by using a dummy hidden element that watches the required object:

```json
{
  "type": "object",
  "title": "Table configuration",
  "properties": {
    "element_1": {
      "type": "object",
      "propertyOrder": 150,
      "title": "element_1",
      "properties": {
        "element_1_nested": {
          "type": "string",
          "title": "element_1_nested",
          "enum": ["SHOW_ELEMENT2_NESTED", "HIDE_ELEMENT2_NESTED"],
          "propertyOrder": 150
        }
      }
    },
    "element_2": {
      "type": "object",
      "propertyOrder": 150,
      "title": "element_2",
      "properties": {
        "helper_element": {
          "type": "string",
          "description": "Helper dummy element to render sql_loader_options",
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
          "propertyOrder": 150,
          "options": {
            "dependencies": {
              "helper_element": "SHOW_ELEMENT2_NESTED"
            }
          }
        }
      }
    }
  }
}
```

### Standard Destination Block

A lot of blocks are repetitive in Keboola components, mainly in Extractors. This is the standard Destination block that should be copy-pasted into extractor schemas:

```json
{
  "destination": {
    "title": "Destination",
    "type": "object",
    "required": ["output_table_name", "incremental_load", "primary_keys"],
    "properties": {
      "output_table_name": {
        "type": "string",
        "title": "Storage Table Name",
        "description": "Name of the table stored in Storage.",
        "propertyOrder": 100
      },
      "incremental_load": {
        "type": "boolean",
        "format": "checkbox",
        "title": "Incremental Load",
        "description": "If incremental load is turned on, the table will be updated instead of rewritten. Tables with a primary key will have rows updated, tables without a primary key will have rows appended.",
        "propertyOrder": 110
      },
      "primary_keys": {
        "type": "string",
        "title": "Primary Keys",
        "description": "Primary keys separated by commas e.g. id, other_id. If a primary key is set, updates can be done on the table by selecting incremental loads.",
        "propertyOrder": 120
      }
    }
  }
}
```

### Accessing Table Column Names from Input Mapping

To access table column names from input mapping:

1. Add `"simpleTableInput"` value under UI options in the Developer Portal
2. The UI schema will contain `_metadata_` object with table information
3. Use `watch` and `enumSource` to load values:

```json
{
  "coordinates": {
    "type": "object",
    "title": "Source coordinates columns",
    "format": "grid",
    "description": "Columns in input table with coordinates in decimal degrees format.",
    "required": ["longitude_column", "latitude_column"],
    "properties": {
      "longitude_column": {
        "type": "string",
        "title": "Longitude column name",
        "watch": {
          "columns": "_metadata_.table.columns"
        },
        "enumSource": "columns",
        "required": true,
        "propertyOrder": 2
      },
      "latitude_column": {
        "type": "string",
        "title": "Latitude column name",
        "watch": {
          "columns": "_metadata_.table.columns"
        },
        "enumSource": "columns",
        "required": true,
        "propertyOrder": 1
      }
    },
    "propertyOrder": 3
  }
}
```

### Conditionally Changing Schema (if/then/else)

Use `if/then/else` for conditional schema changes:

```json
{
  "type": "object",
  "title": "Table configuration",
  "properties": {
    "additional_requests_pars": {
      "type": "array",
      "items": {
        "type": "object",
        "title": "Item",
        "required": ["key", "value"],
        "properties": {
          "key": {
            "type": "string",
            "title": "Key",
            "enum": ["params", "cookies", "timeout", "allow_redirects", "proxies", "verify"],
            "propertyOrder": 1
          }
        },
        "if": {
          "properties": {
            "key": {
              "const": "cookies"
            }
          }
        },
        "then": {
          "properties": {
            "value": {
              "type": "object",
              "properties": {
                "key": {
                  "type": "string",
                  "title": "Key",
                  "propertyOrder": 1
                },
                "value": {
                  "type": "string",
                  "title": "Value",
                  "propertyOrder": 2
                }
              },
              "title": "Additional requests parameters",
              "format": "table",
              "propertyOrder": 600
            }
          }
        },
        "else": {
          "properties": {
            "value": {
              "type": "boolean"
            }
          }
        }
      },
      "title": "Additional requests parameters",
      "format": "table",
      "propertyOrder": 600
    }
  }
}
```

### Input String Validation (pattern)

Use `pattern` for regex validation:

```json
{
  "output_table_name": {
    "type": "string",
    "title": "Storage Table Name",
    "description": "Name of the table stored in Storage.",
    "pattern": "^(in|out)\\.[a-zA-z0-9_-]+\\.[a-zA-z0-9_-]+",
    "propertyOrder": 100
  }
}
```

### Accessing Parameter from Config Root (from Config Row)

Under `_metadata_.root.parameters` are all parameters from the root config. Use this pattern to access root configuration values from row schemas:

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

---

## UI Development Tools

The UI form can be previewed, tested and developed using these tools:

1. **Online JSON Editor**: https://json-editor.github.io/json-editor/ - online editor & renderer
2. **Advanced JSON Editor**: https://pmk65.github.io/jedemov2/dist/demo.html - Advanced version with undocumented features and large library of examples
3. **Keboola Components Portal**: https://components.keboola.com - Preview the rendered UI directly from the JSON Schema field
4. **Test Connection Component**: https://bitbucket.org/kds_consulting_team/kds-team.ex-test-connection/src/master/ - For testing UI elements in KBC

---

## Real Production Examples

### Example 1: AWS Cost and Usage Reports Extractor (kds-team.ex-aws-cost-and-usage-reports)

**Component Info:**
- Type: extractor
- Flags: `["genericDockerUI", "appInfo.dataIn", "genericDockerUI-resetState"]`

**configurationSchema:**

```json
{
  "type": "object",
  "title": "Configuration",
  "required": ["aws_parameters", "report_path_prefix", "min_date_since", "max_date", "since_last"],
  "properties": {
    "aws_parameters": {
      "type": "object",
      "title": "AWS config",
      "format": "grid",
      "required": ["api_key_id", "#api_key_secret", "s3_bucket", "aws_region"],
      "properties": {
        "api_key_id": {
          "type": "string",
          "title": "AWS API Key ID",
          "options": { "grid_columns": "2" },
          "propertyOrder": 1
        },
        "#api_key_secret": {
          "type": "string",
          "title": "AWS API Key Secret",
          "format": "password",
          "options": { "grid_columns": "2" },
          "propertyOrder": 2
        },
        "s3_bucket": {
          "type": "string",
          "title": "AWS S3 bucket name",
          "description": "An existing S3 bucket name for lambda function package staging.",
          "propertyOrder": 3
        },
        "aws_region": {
          "enum": [
            "us-east-1", "us-west-1", "us-west-2", "ap-east-1", "ap-south-1",
            "ap-northeast-2", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
            "ca-central-1", "cn-north-1", "cn-northwest-1", "eu-central-1",
            "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1", "me-south-1",
            "sa-east-1", "us-gov-east-1", "us-gov-west-1"
          ],
          "type": "string",
          "title": "AWS Region",
          "default": "eu-central-1",
          "propertyOrder": 4
        }
      },
      "propertyOrder": 1
    },
    "loading_options": {
      "type": "object",
      "title": "Loading Options",
      "format": "grid",
      "required": ["incremental_output", "pkey"],
      "properties": {
        "incremental_output": {
          "enum": [0, 1],
          "type": "number",
          "title": "Load type",
          "default": 0,
          "options": {
            "enum_titles": ["Full Load", "Incremental Update"]
          },
          "description": "If set to Incremental update, the result tables will be updated based on primary key.",
          "propertyOrder": 450
        },
        "pkey": {
          "type": "array",
          "items": {
            "type": "string",
            "title": "col name"
          },
          "title": "Primary key",
          "propertyOrder": 5000
        }
      },
      "propertyOrder": 2
    },
    "since_last": {
      "type": "boolean",
      "title": "New files only.",
      "format": "checkbox",
      "default": true,
      "description": "Download only new reports since last run. The Maximum date parameter is ignored.",
      "propertyOrder": 3
    },
    "min_date_since": {
      "type": "string",
      "title": "Minimum date since",
      "description": "Lowest report date to download. Date in YYYY-MM-DD format or dateparser string.",
      "propertyOrder": 5
    },
    "max_date": {
      "type": "string",
      "title": "Maximum date",
      "default": "now",
      "description": "Max report date to download. Date in YYYY-MM-DD format or dateparser string.",
      "propertyOrder": 7
    },
    "report_path_prefix": {
      "type": "string",
      "title": "Report prefix",
      "description": "The prefix as you set up in the AWS CUR config. E.g. my-report or some/long/prefix/myreport",
      "propertyOrder": 10
    }
  }
}
```

### Example 2: Snowflake Query Runner (kds-team.app-snowflake-query-runner)

**Component Info:**
- Type: application
- Flags: `["genericDockerUI", "genericDockerUI-rows", "appInfo.beta"]`

**configurationSchema:**

```json
{
  "type": "object",
  "title": "Snowflake Connection",
  "required": ["account", "username", "warehouse"],
  "properties": {
    "auth_type": {
      "enum": ["password", "key_pair"],
      "type": "string",
      "title": "Authentication Type",
      "default": "key_pair",
      "options": {
        "enum_titles": ["Password", "Key Pair"]
      },
      "propertyOrder": 0
    },
    "account": {
      "type": "string",
      "title": "Account Identifier",
      "description": "Account identifier of the Snowflake instance. This is a prefix of your Snowflake instance URL, e.g., <strong>keboola.eu-central-1</strong>.",
      "propertyOrder": 100
    },
    "username": {
      "type": "string",
      "title": "Username",
      "description": "Snowflake user that will be used to run queries",
      "propertyOrder": 200
    },
    "#password": {
      "type": "string",
      "title": "Password",
      "format": "password",
      "options": {
        "dependencies": { "auth_type": "password" }
      },
      "description": "Password authenticating the Snowflake user",
      "propertyOrder": 300
    },
    "#private_key": {
      "type": "string",
      "title": "Private Key",
      "format": "textarea",
      "options": {
        "dependencies": { "auth_type": "key_pair" }
      },
      "description": "Private key used for authentication",
      "propertyOrder": 400
    },
    "#private_key_passphrase": {
      "type": "string",
      "title": "Private Key Passphrase",
      "format": "password",
      "options": {
        "dependencies": { "auth_type": "key_pair" }
      },
      "description": "Passphrase for the private key",
      "propertyOrder": 500
    },
    "warehouse": {
      "type": "string",
      "title": "Warehouse",
      "description": "Name of the Snowflake warehouse to be used",
      "propertyOrder": 600
    },
    "test_connection": {
      "type": "button",
      "format": "sync-action",
      "options": {
        "async": {
          "label": "TEST CONNECTION",
          "action": "testConnection"
        }
      },
      "propertyOrder": 700
    }
  }
}
```

**configurationRowSchema:**

```json
{
  "type": "object",
  "title": "Parameters",
  "required": ["database", "schema", "query"],
  "properties": {
    "database": {
      "type": "string",
      "title": "Database",
      "description": "Snowflake database where the query will be executed",
      "propertyOrder": 100
    },
    "schema": {
      "type": "string",
      "title": "Schema",
      "description": "Snowflake schema where the query will be executed",
      "propertyOrder": 200
    },
    "query": {
      "type": "string",
      "title": "Query",
      "format": "editor",
      "options": {
        "editor": {
          "mode": "text/x-sql"
        }
      },
      "description": "Query to execute",
      "propertyOrder": 300
    }
  }
}
```

### Example 3: Simple Extractor with Date Picker (actum.ex-zbozicz-report-extractor)

**configurationSchema:**

```json
{
  "type": "object",
  "required": ["authorization", "action"],
  "properties": {
    "authorization": {
      "type": "object",
      "title": "API Credentials",
      "required": ["#username", "#api_key"],
      "properties": {
        "#username": {
          "type": "string",
          "title": "Shop ID"
        },
        "#api_key": {
          "type": "string",
          "title": "API Key"
        }
      }
    },
    "action": {
      "enum": ["create_report", "list_reports", "download_latest_report"],
      "type": "string",
      "title": "Select Action",
      "default": "create_report"
    },
    "dateFrom": {
      "type": "string",
      "title": "Date From",
      "format": "date",
      "description": "Optional. If left empty, defaults to 3 days ago."
    },
    "dateTo": {
      "type": "string",
      "title": "Date To",
      "format": "date",
      "description": "Optional. If left empty, defaults to today."
    },
    "outputTable": {
      "type": "string",
      "title": "Output Table Name",
      "default": "zbozi_report",
      "description": "Name of the output table (without .csv extension)"
    },
    "reportsToDownload": {
      "type": "integer",
      "title": "How many last reports to download",
      "default": 7,
      "maximum": 50,
      "minimum": 1,
      "description": "How many recent reports do you want to merge and download? (max 50)"
    }
  }
}
```

### Example 4: Code Editor with Validation (actum.app-booklist-maintainer)

**configurationRowSchema:**

```json
{
  "type": "object",
  "required": ["name", "columns", "values"],
  "properties": {
    "name": {
      "type": "string",
      "title": "Booklist Name",
      "description": "The name of the Booklist table.",
      "propertyOrder": 1
    },
    "columns": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "format": "select",
      "default": ["SRC_ID", "DESCR"],
      "options": {
        "tags": true
      },
      "description": "Select the columns to be in the booklist table.",
      "uniqueItems": true,
      "propertyOrder": 2
    },
    "values": {
      "type": "string",
      "title": "Booklist Values",
      "format": "editor",
      "default": "'RNT_WH', 'Rent - Warehouse'\n'RNT_OFF', 'Rent - Office'",
      "options": {
        "editor": {
          "mode": "text/x-python"
        }
      },
      "description": "Enter values in csv format. Each row should be separated by a new line.",
      "propertyOrder": 3
    },
    "validation_button": {
      "type": "button",
      "format": "sync-action",
      "options": {
        "async": {
          "label": "Validate Values",
          "action": "validate_values"
        }
      },
      "propertyOrder": 4
    }
  }
}
```

---

## Quick Reference

### Minimal configSchema.json

```json
{
  "type": "object",
  "title": "Configuration",
  "required": ["#api_key"],
  "properties": {
    "#api_key": {
      "type": "string",
      "title": "API Key",
      "format": "password",
      "propertyOrder": 1
    }
  }
}
```

### Minimal configRowSchema.json

```json
{
  "type": "object",
  "title": "Query",
  "required": ["table_name"],
  "properties": {
    "table_name": {
      "type": "string",
      "title": "Table Name",
      "propertyOrder": 1
    }
  }
}
```

### Common Field Patterns

**Password Field:**
```json
{
  "#api_key": {
    "type": "string",
    "title": "API Key",
    "format": "password",
    "propertyOrder": 1
  }
}
```

**Checkbox:**
```json
{
  "incremental": {
    "type": "boolean",
    "title": "Incremental Load",
    "format": "checkbox",
    "default": false,
    "propertyOrder": 1
  }
}
```

**Dropdown:**
```json
{
  "region": {
    "enum": ["us-east-1", "eu-west-1", "ap-southeast-1"],
    "type": "string",
    "title": "Region",
    "default": "us-east-1",
    "propertyOrder": 1
  }
}
```

**Dropdown with Labels:**
```json
{
  "load_type": {
    "enum": [0, 1],
    "type": "integer",
    "title": "Load Type",
    "default": 0,
    "options": {
      "enum_titles": ["Full Load", "Incremental"]
    },
    "propertyOrder": 1
  }
}
```

**Dynamic Dropdown:**
```json
{
  "table": {
    "enum": [],
    "type": "string",
    "title": "Table",
    "format": "select",
    "options": {
      "async": {
        "label": "Load Tables",
        "action": "getTables"
      }
    },
    "propertyOrder": 1
  }
}
```

**Conditional Field:**
```json
{
  "auth_type": {
    "enum": ["password", "token"],
    "type": "string",
    "title": "Auth Type",
    "propertyOrder": 1
  },
  "#password": {
    "type": "string",
    "format": "password",
    "options": {
      "dependencies": {
        "auth_type": "password"
      }
    },
    "propertyOrder": 2
  }
}
```

**Code Editor:**
```json
{
  "query": {
    "type": "string",
    "title": "SQL Query",
    "format": "editor",
    "options": {
      "editor": {
        "mode": "text/x-sql"
      }
    },
    "propertyOrder": 1
  }
}
```

**Test Connection Button:**
```json
{
  "test_connection": {
    "type": "button",
    "format": "test-connection",
    "propertyOrder": 9999
  }
}
```

**Sync Action Button:**
```json
{
  "validate": {
    "type": "button",
    "format": "sync-action",
    "options": {
      "async": {
        "label": "Validate",
        "action": "validate"
      }
    },
    "propertyOrder": 9999
  }
}
```

---

## Statistics from Keboola Storage API

Based on analysis of 1594 components from the Keboola Storage API (connection.us-east4.gcp.keboola.com):

- **888 components** have non-empty configuration schemas
- **169 components** have row schemas
- **124 Keboola/KDS components** have row schemas
- **17 components** use code editors
- **78 components** use table format
- **60 components** use grid format
- **32 components** use date pickers
- **74 components** use textarea format

---

*This documentation was generated from real production components in the Keboola Storage API.*
