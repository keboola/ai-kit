# Configuration Schema Overview

Complete reference for creating and configuring `configSchema.json` and `configRowSchema.json` files for Keboola components.

## Table of Contents

1. [Introduction](#introduction)
2. [File Structure and Location](#file-structure-and-location)
3. [JSON Schema Basics](#json-schema-basics)
4. [configSchema vs configRowSchema](#configschema-vs-configrowschema)
   - [How They Work Together](#how-they-work-together)
   - [Platform Execution Model](#platform-execution-model) ⚠️ **Important**
   - [createConfigurationRowSchema.json](#createconfigurationrowschemajson)
5. [Default Configurations](#default-configurations)
6. [Code Pattern Components](#code-pattern-components)
7. [Validation Rules](#validation-rules)
8. [Best Practices](#best-practices)
9. [Quick Reference](#quick-reference)

## Introduction

Configuration schemas define the structure and validation rules for component configurations in Keboola. They use JSON Schema format and are rendered as forms in the Keboola UI.

**Two main schema files:**
- `configSchema.json` - Defines the component-level configuration
- `configRowSchema.json` - Defines the row-level configuration (for components with rows)

**Data sources for this documentation:**
- Keboola Storage API (888+ production components analyzed)
- Internal Confluence documentation
- Official Keboola developer documentation

## File Structure and Location

Configuration schemas are stored in the `component_config/` directory:

```
my-component/
├── component_config/
│   ├── configSchema.json              # Component-level configuration schema
│   ├── configRowSchema.json           # Row-level configuration schema (optional)
│   ├── createConfigurationRowSchema.json  # Schema for row creation form (optional)
│   ├── component_long_description.md  # Detailed description
│   └── component_short_description.md # Brief description
├── src/
│   └── component.py
└── ...
```

## JSON Schema Basics

### Basic Structure

```json
{
  "type": "object",
  "title": "Configuration",
  "required": ["api_key"],
  "properties": {
    "api_key": {
      "type": "string",
      "title": "API Key",
      "description": "Your API key for authentication",
      "propertyOrder": 1
    },
    "endpoint": {
      "type": "string",
      "title": "Endpoint URL",
      "default": "https://api.example.com",
      "propertyOrder": 2
    }
  }
}
```

### Key Properties

| Property | Description |
|----------|-------------|
| `type` | Data type: `string`, `number`, `integer`, `boolean`, `array`, `object` |
| `title` | Display label in UI (no colons or periods at end) |
| `description` | Help text shown below the field |
| `default` | Default value for the field |
| `required` | Array of required property names |
| `propertyOrder` | Controls field display order (lower = higher) |
| `format` | Special formatting/rendering (see [UI Elements](configuration-schema-ui-elements.md)) |
| `options` | UI-specific options (see [UI Elements](configuration-schema-ui-elements.md)) |
| `enum` | Array of allowed values |
| `enum_titles` | Human-readable labels for enum values |

### Encrypted Fields

Fields with names starting with `#` are automatically encrypted:

```json
{
  "#api_key": {
    "type": "string",
    "title": "API Key",
    "format": "password"
  }
}
```

## configSchema vs configRowSchema

### configSchema.json

Defines the main component configuration. Used for:
- Global settings (credentials, endpoints)
- Settings shared across all rows
- Components without row-level configuration

### configRowSchema.json

Defines row-level configuration. Used for:
- Per-table/per-entity settings
- Iterative configurations (e.g., multiple tables to extract)
- Settings that vary between rows

### How They Work Together

The root configuration is merged with each row configuration at runtime:

```
Root Config (configSchema)     Row Config (configRowSchema)
{                              {
  "parameters": {                "parameters": {
    "api_key": "xxx",              "table": "users",
    "endpoint": "..."              "columns": ["id", "name"]
  }                              }
}                              }

                    ↓ Merged at runtime ↓

{
  "parameters": {
    "api_key": "xxx",
    "endpoint": "...",
    "table": "users",
    "columns": ["id", "name"]
  }
}
```

### Platform Execution Model

**IMPORTANT**: The Keboola platform executes **one job per row configuration**.

When you configure multiple rows in the UI:
- Each row is executed as a **separate job**
- The platform merges root config + single row config before job execution
- The merged result is in `self.configuration.parameters` (NOT in `image_parameters`)
- `image_parameters` contains **global component parameters** (same for all configurations)

**What this means for component code:**

```python
# ❌ INCORRECT - Don't look for rows in image_parameters
for row in self.configuration.image_parameters:  # Wrong!
    process_row(row)

# ❌ INCORRECT - image_parameters is for global settings only
row_config = self.configuration.image_parameters[0]  # Wrong!

# ✅ CORRECT - Read merged parameters directly
# Platform already merged root + row config into parameters
params = self.configuration.parameters  # Contains merged config
process_merged_config(params)
```

**Example execution flow:**

User configures component with root config and 3 rows in UI:

**Root config (configSchema.json):**
```json
{
  "connection": {
    "url": "https://api.example.com",
    "#api_key": "secret123"
  }
}
```

**Row configs (configRowSchema.json):**
- Row 1: `{ "table": "users", "incremental": true }`
- Row 2: `{ "table": "orders", "incremental": false }`
- Row 3: `{ "table": "products", "incremental": true }`

Platform creates **3 separate jobs**, each with merged config:

```python
# Job 1 - self.configuration.parameters contains:
{
  "connection": { "url": "...", "#api_key": "..." },  # from root
  "table": "users",                                     # from row 1
  "incremental": true                                   # from row 1
}

# Job 2 - self.configuration.parameters contains:
{
  "connection": { "url": "...", "#api_key": "..." },  # from root
  "table": "orders",                                    # from row 2
  "incremental": false                                  # from row 2
}

# Job 3 - self.configuration.parameters contains:
{
  "connection": { "url": "...", "#api_key": "..." },  # from root
  "table": "products",                                  # from row 3
  "incremental": true                                   # from row 3
}
```

**Key implications:**
1. No need for concurrency limits between rows (platform handles this)
2. Component code processes merged parameters directly
3. No iteration over rows needed - platform runs component once per row
4. Memory usage is per-row, not per-component
5. Each execution is completely isolated

**Code pattern:**

```python
from pydantic import BaseModel, ConfigDict

class Configuration(BaseModel):
    """Configuration schema combining root + row parameters."""
    model_config = ConfigDict(extra='ignore')  # Ignore unknown fields

    # Root config fields (from configSchema.json)
    connection: ConnectionConfig
    debug: bool = False

    # Row config fields (from configRowSchema.json)
    table: str
    incremental: bool = False

class Component(ComponentBase):
    def run(self):
        # Load merged configuration (root + row already merged by platform)
        config = Configuration.from_dict(self.configuration.parameters)

        # Use connection from root config
        client = create_client(config.connection)

        # Use table and incremental from row config
        extract_table(client, config.table, config.incremental)
```

**Alternative pattern** (separate root and row classes):

```python
class RootConfig(BaseModel):
    model_config = ConfigDict(extra='ignore')
    connection: ConnectionConfig
    debug: bool = False

class RowConfig(BaseModel):
    model_config = ConfigDict(extra='ignore')
    table: str
    incremental: bool = False

class Component(ComponentBase):
    def run(self):
        # Both read from same merged parameters
        root = RootConfig.from_dict(self.configuration.parameters)
        row = RowConfig.from_dict(self.configuration.parameters)

        client = create_client(root.connection)
        extract_table(client, row.table, row.incremental)
```

### createConfigurationRowSchema.json

Optional schema for the row creation form. If not provided, `configRowSchema.json` is used.

```json
{
  "type": "object",
  "title": "Add New Table",
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

## Default Configurations

### emptyConfiguration

Default configuration when creating a new component configuration:

```json
{
  "emptyConfiguration": {
    "parameters": {
      "incremental": true,
      "debug": false
    }
  }
}
```

### emptyConfigurationRow

Default configuration when creating a new row:

```json
{
  "emptyConfigurationRow": {
    "parameters": {
      "enabled": true
    }
  }
}
```

## Code Pattern Components

Code pattern components require a special `supported_components` field:

```json
{
  "type": "object",
  "title": "Code Pattern Configuration",
  "required": ["supported_components"],
  "properties": {
    "supported_components": {
      "type": "array",
      "title": "Supported Components",
      "description": "List of component IDs this code pattern supports",
      "items": {
        "type": "string"
      },
      "propertyOrder": 1
    }
  }
}
```

## Validation Rules

### Size Limits

| Item | Maximum Size |
|------|--------------|
| Configuration schema | 256 KB |
| Row schema | 256 KB |
| Description | 64 KB |
| Component name | 128 characters |

### Required Fields

- `type` must be `"object"` at the root level
- `properties` must be defined for object types
- `items` must be defined for array types

### Naming Conventions

- Use `snake_case` for property names
- Use `#` prefix for encrypted fields
- Avoid special characters in property names

## Best Practices

### 1. Always Use propertyOrder

```json
{
  "api_key": {
    "type": "string",
    "title": "API Key",
    "propertyOrder": 1
  },
  "endpoint": {
    "type": "string",
    "title": "Endpoint",
    "propertyOrder": 2
  }
}
```

### 2. Use Descriptive Titles (No Colons/Periods)

```json
{
  "title": "API Key",
  "title": "Maximum Records"
}
```

### 3. Encrypt Sensitive Data

```json
{
  "#password": {
    "type": "string",
    "format": "password"
  }
}
```

### 4. Group Related Fields

```json
{
  "authentication": {
    "type": "object",
    "title": "Authentication",
    "properties": {
      "username": { ... },
      "#password": { ... }
    }
  }
}
```

### 5. Use Dependencies for Conditional Fields

```json
{
  "dependencies": {
    "auth_type": {
      "oneOf": [
        {
          "properties": {
            "auth_type": { "enum": ["password"] },
            "#password": { "type": "string" }
          }
        },
        {
          "properties": {
            "auth_type": { "enum": ["key"] },
            "#private_key": { "type": "string" }
          }
        }
      ]
    }
  }
}
```

### 6. Provide Helpful Descriptions

```json
{
  "description": "Enter your API key. You can find it in Settings > API Keys."
}
```

### 7. Use enum_titles for User-Friendly Labels

```json
{
  "region": {
    "type": "string",
    "enum": ["us-east-1", "eu-west-1"],
    "enum_titles": ["US East (N. Virginia)", "EU West (Ireland)"]
  }
}
```

### 8. Set Sensible Defaults

```json
{
  "timeout": {
    "type": "integer",
    "default": 30,
    "description": "Request timeout in seconds"
  }
}
```

### 9. Use Grid Layout for Complex Forms

```json
{
  "options": {
    "grid_columns": 2
  }
}
```

### 10. Include Test Connection Button

```json
{
  "test_connection": {
    "type": "button",
    "format": "test-connection",
    "options": {
      "async": {
        "label": "Test Connection",
        "action": "testConnection"
      }
    }
  }
}
```

## Quick Reference

### Common Field Types

| Type | Use Case |
|------|----------|
| `string` | Text input, passwords, selections |
| `integer` | Whole numbers |
| `number` | Decimal numbers |
| `boolean` | Checkboxes, toggles |
| `array` | Lists, multi-select |
| `object` | Grouped fields |

### Common Formats

| Format | Description |
|--------|-------------|
| `password` | Masked input for secrets |
| `textarea` | Multi-line text |
| `editor` | Code editor |
| `select` | Dropdown selection |
| `checkbox` | Boolean checkbox |
| `date` | Date picker |
| `uri` | URL input |

### Common Options

| Option | Description |
|--------|-------------|
| `propertyOrder` | Field display order |
| `hidden` | Hide field from UI |
| `inputAttributes.placeholder` | Placeholder text |
| `editor.mode` | Code editor language |
| `async` | Sync action configuration |

## Related Documentation

- [UI Elements](configuration-schema-ui-elements.md) - Field formats, options, and editor modes
- [Sync Actions](configuration-schema-sync-actions.md) - Dynamic dropdowns and validation
- [Advanced Patterns](configuration-schema-advanced.md) - Confluence best practices
- [Examples](configuration-schema-examples.md) - Real production examples
- [Initialization Guide](initialization-guide.md) - Setting up new components
- [Architecture Guide](architecture.md) - Component structure and patterns
