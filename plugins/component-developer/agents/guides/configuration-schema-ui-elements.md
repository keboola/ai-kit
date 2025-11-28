# Configuration Schema UI Elements

Complete reference for field formats, UI options, editor modes, and component flags.

## Table of Contents

1. [UI Options (Component Level)](#ui-options-component-level)
2. [Component Flags](#component-flags)
3. [Field Formats](#field-formats)
4. [Options Keys](#options-keys)
5. [Code Editor Modes](#code-editor-modes)

## UI Options (Component Level)

UI options control how the component configuration is rendered in the Keboola UI.

### Available UI Options

| Option | Description |
|--------|-------------|
| `genericUI` | Enable generic UI (base flag) |
| `genericDockerUI` | Enable generic Docker UI |
| `genericDockerUI-authorization` | Enable authorization section |
| `genericDockerUI-processors` | Enable processors section |
| `genericDockerUI-resetState` | Enable reset state button |
| `genericDockerUI-tableInput` | Enable table input mapping |
| `genericDockerUI-tableOutput` | Enable table output mapping |
| `genericDockerUI-fileInput` | Enable file input mapping |
| `genericDockerUI-fileOutput` | Enable file output mapping |
| `genericDockerUI-rows` | Enable row-based configuration |
| `genericDockerUI-simpleTableInput` | Shows table selector when creating rows, auto-fills input mapping, provides table metadata via `_metadata_.table` (requires `genericDockerUI-rows`) |
| `genericTemplatesUI` | Enable templates UI |
| `genericPackagesUI` | Enable packages UI |
| `genericCodeBlocksUI` | Enable code blocks UI |
| `excludeRun` | Exclude from run button |
| `excludeFromNewList` | Hide from new component list |
| `tableInputMapping` | Legacy table input mapping |
| `tableOutputMapping` | Legacy table output mapping |
| `fileInputMapping` | Legacy file input mapping |
| `fileOutputMapping` | Legacy file output mapping |

### Using genericDockerUI-simpleTableInput

When enabled, this flag provides a simplified table input workflow for row-based components.

**What it does:**
- Displays a table selector in the "Add Row" dialog
- Automatically creates input mapping with the selected table
- Injects table metadata into the JSON schema context via `_metadata_.table`

**Available metadata in schema:**
- `_metadata_.table.id` - Full table ID (e.g., `in.c-bucket.tablename`)
- `_metadata_.table.name` - Display name of the table
- `_metadata_.table.columns` - Array of column names (respects column selection from mapping)
- `_metadata_.table.primaryKey` - Array of primary key column names

**Requirements:**
- Must be used with `genericDockerUI-rows` because the table selector appears in the row creation modal

**Example - Column selector using table metadata:**
```json
{
  "column": {
    "type": "string",
    "title": "Select Column",
    "format": "select",
    "enum": [],
    "options": {
      "async": {
        "action": "getColumns"
      }
    }
  }
}
```

The component can then use `_metadata_.table.columns` to populate the dropdown dynamically.

### Default UI Options by Component Type

**Extractor:**
```json
["genericDockerUI", "genericDockerUI-authorization", "genericDockerUI-tableOutput"]
```

**Writer:**
```json
["genericDockerUI", "genericDockerUI-authorization", "genericDockerUI-tableInput"]
```

**Application:**
```json
["genericDockerUI", "genericDockerUI-authorization", "genericDockerUI-tableInput", "genericDockerUI-tableOutput"]
```

**Transformation:**
```json
["genericDockerUI", "genericDockerUI-tableInput", "genericDockerUI-tableOutput"]
```

## Component Flags

Flags control component behavior and visibility.

### Available Flags

| Flag | Description |
|------|-------------|
| `3rdParty` | Third-party component (not developed by Keboola) |
| `appInfo.alpha` | Alpha version component |
| `appInfo.beta` | Beta version component |
| `appInfo.experimental` | Experimental version component |
| `appInfo.fee` | Component requires additional fee |
| `appInfo.licenseUrl` | URL to license information |
| `appInfo.dataIn` | Component reads data |
| `appInfo.dataOut` | Component writes data |
| `deprecated` | Component is deprecated |
| `excludeFromNewList` | Hide from new component list |
| `excludeRun` | Exclude from run button |
| `genericUI` | Enable generic UI |
| `genericCodeBlocksUI` | Enable code blocks UI |
| `genericDockerUI` | Enable generic Docker UI |
| `genericDockerUI-authorization` | Enable authorization section |
| `genericDockerUI-fileInput` | Enable file input mapping |
| `genericDockerUI-fileOutput` | Enable file output mapping |
| `genericDockerUI-processors` | Enable processors section |
| `genericDockerUI-resetState` | Enable reset state button |
| `genericDockerUI-rows` | Enable row-based configuration |
| `genericDockerUI-simpleTableInput` | Shows table selector when creating rows, auto-fills input mapping, provides table metadata via `_metadata_.table` |
| `genericDockerUI-tableInput` | Enable table input mapping |
| `genericDockerUI-tableOutput` | Enable table output mapping |
| `genericPackagesUI` | Enable packages UI |
| `genericTemplatesUI` | Enable templates UI |
| `hasUI` | Component has custom UI |
| `dbtCloud` | DBT Cloud integration |
| `hubspotTemplates` | Hubspot templates support |

## Field Formats

Formats control how fields are rendered in the UI.

### String Formats

| Format | Description | Example |
|--------|-------------|---------|
| `password` | Masked input for secrets | `"format": "password"` |
| `textarea` | Multi-line text input | `"format": "textarea"` |
| `editor` | Code editor (use with `options.editor.mode`) | `"format": "editor"` |
| `select` | Dropdown selection | `"format": "select"` |
| `trim` | Auto-trim whitespace | `"format": "trim"` |
| `date` | Date picker | `"format": "date"` |
| `date-time` | Date and time picker | `"format": "date-time"` |
| `time` | Time picker | `"format": "time"` |
| `timestamp` | Unix timestamp input | `"format": "timestamp"` |
| `uri` | URL input with validation | `"format": "uri"` |
| `email` | Email input with validation | `"format": "email"` |
| `radio` | Radio button group | `"format": "radio"` |
| `color` | Color picker | `"format": "color"` |
| `hidden` | Hidden field | `"format": "hidden"` |

### Integer/Number Formats

| Format | Description | Example |
|--------|-------------|---------|
| `range` | Slider input | `"format": "range"` |
| `int32` | 32-bit integer | `"format": "int32"` |

### Boolean Formats

| Format | Description | Example |
|--------|-------------|---------|
| `checkbox` | Standard checkbox | `"format": "checkbox"` |

**Note:** `chekbox` (typo) appears in some legacy components - use `checkbox` instead.

### Array Formats

| Format | Description | Example |
|--------|-------------|---------|
| `select` | Multi-select dropdown | `"format": "select"` |
| `checkbox` | Checkbox group | `"format": "checkbox"` |
| `table` | Table editor | `"format": "table"` |
| `tabs` | Tabbed interface | `"format": "tabs"` |
| `tabs-top` | Tabs at top | `"format": "tabs-top"` |

### Button Formats

| Format | Description | Example |
|--------|-------------|---------|
| `test-connection` | Test connection button | `"format": "test-connection"` |
| `sync-action` | Generic sync action button | `"format": "sync-action"` |

### Object Formats

| Format | Description | Example |
|--------|-------------|---------|
| `ssh-editor` | SSH tunnel/key pair form | `"format": "ssh-editor"` |

### Special Formats

| Format | Description | Example |
|--------|-------------|---------|
| `alt-date` | Alternative date picker | `"format": "alt-date"` |
| `Personal access token` | GitHub PAT input (rare) | `"format": "Personal access token"` |

### Format Examples

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

**Textarea:**
```json
{
  "description": {
    "type": "string",
    "title": "Description",
    "format": "textarea",
    "propertyOrder": 2
  }
}
```

**Date Picker:**
```json
{
  "start_date": {
    "type": "string",
    "title": "Start Date",
    "format": "date",
    "description": "Select the start date for data extraction",
    "propertyOrder": 3
  }
}
```

**Date-Time Picker:**
```json
{
  "scheduled_at": {
    "type": "string",
    "title": "Scheduled At",
    "format": "date-time",
    "description": "Select date and time",
    "propertyOrder": 4
  }
}
```

**Email Field:**
```json
{
  "email": {
    "type": "string",
    "title": "Email Address",
    "format": "email",
    "description": "Enter a valid email address",
    "propertyOrder": 5
  }
}
```

**Radio Buttons:**
```json
{
  "output_format": {
    "type": "string",
    "title": "Output Format",
    "format": "radio",
    "enum": ["csv", "json", "parquet"],
    "enum_titles": ["CSV", "JSON", "Parquet"],
    "default": "csv",
    "propertyOrder": 6
  }
}
```

**URI Field:**
```json
{
  "endpoint": {
    "type": "string",
    "title": "API Endpoint",
    "format": "uri",
    "description": "Enter the full API URL",
    "propertyOrder": 7
  }
}
```

**SSH Editor:**
```json
{
  "ssh": {
    "type": "object",
    "title": "SSH Configuration",
    "format": "ssh-editor",
    "propertyOrder": 8
  }
}
```

**SSH Editor (Keys Only):**
```json
{
  "ssh": {
    "type": "object",
    "title": "SSH Keys",
    "format": "ssh-editor",
    "options": {
      "only_keys": true
    },
    "propertyOrder": 9
  }
}
```

## Options Keys

Options control field behavior and appearance.

### Display Options

| Option | Type | Description |
|--------|------|-------------|
| `propertyOrder` | integer | Field display order (lower = higher) |
| `hidden` | boolean | Hide field from UI |
| `collapsed` | boolean | Collapse object by default |
| `compact` | boolean | Use compact display mode |
| `grid_columns` | integer | Number of grid columns (1-12) |
| `object_layout` | string | Object layout style (`"grid"`, `"table"`) |

### Input Options

| Option | Type | Description |
|--------|------|-------------|
| `inputAttributes` | object | HTML input attributes |
| `inputAttributes.placeholder` | string | Placeholder text |
| `inputAttributes.readonly` | boolean | Make field read-only |
| `input_width` | string | Input width (`"100px"`, `"50%"`) |
| `expand_height` | boolean | Expand textarea height |

### Editor Options

| Option | Type | Description |
|--------|------|-------------|
| `editor` | object | Code editor configuration |
| `editor.mode` | string | Editor language mode |
| `editor.theme` | string | Editor theme |
| `editor.lineNumbers` | boolean | Show line numbers |
| `editor.readOnly` | boolean | Make editor read-only |
| `editor.placeholder` | string | Placeholder text for empty editor |
| `editor.autofocus` | boolean | Auto-focus editor on load |
| `editor.lint` | boolean | Enable linting (for JSON mode) |
| `only_keys` | boolean | SSH form: show only keys (not full tunnel) |

### Behavior Options

| Option | Type | Description |
|--------|------|-------------|
| `disable_collapse` | boolean | Prevent collapsing |
| `disable_edit_json` | boolean | Disable JSON editing |
| `disable_properties` | boolean | Disable property editing |
| `keep_oneof_values` | boolean | Keep values when switching oneOf |
| `remove_empty_properties` | boolean | Remove empty properties on save |

### Array Options

| Option | Type | Description |
|--------|------|-------------|
| `minItems` | integer | Minimum array items |
| `maxItems` | integer | Maximum array items |

### Date Options

| Option | Type | Description |
|--------|------|-------------|
| `flatpickr` | object | Flatpickr date picker options |
| `flatpickr.enableTime` | boolean | Enable time selection |
| `flatpickr.dateFormat` | string | Date format string |

### Async/Sync Action Options

| Option | Type | Description |
|--------|------|-------------|
| `async` | object | Async action configuration |
| `async.label` | string | Button label |
| `async.action` | string | Action name |
| `async.autoload` | boolean | Auto-load on form open |
| `async.cache` | boolean | Cache results |

### Options Examples

**Placeholder Text:**
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

**Read-Only Field:**
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

**Collapsed Object:**
```json
{
  "advanced_settings": {
    "type": "object",
    "title": "Advanced Settings",
    "options": {
      "collapsed": true
    },
    "properties": {
      "timeout": { "type": "integer" },
      "retries": { "type": "integer" }
    }
  }
}
```

**Grid Layout:**
```json
{
  "type": "object",
  "options": {
    "grid_columns": 2
  },
  "properties": {
    "first_name": { "type": "string", "propertyOrder": 1 },
    "last_name": { "type": "string", "propertyOrder": 2 }
  }
}
```

**Flatpickr Date Picker:**
```json
{
  "start_date": {
    "type": "string",
    "title": "Start Date",
    "format": "date",
    "options": {
      "flatpickr": {
        "enableTime": false,
        "dateFormat": "Y-m-d"
      }
    }
  }
}
```

**Disable JSON Editing:**
```json
{
  "config": {
    "type": "object",
    "title": "Configuration",
    "options": {
      "disable_edit_json": true
    }
  }
}
```

**Input Width:**
```json
{
  "port": {
    "type": "integer",
    "title": "Port",
    "options": {
      "input_width": "100px"
    }
  }
}
```

## Code Editor Modes

Use with `format: "editor"` and `options.editor.mode`.

### Available Modes

| Mode | Language | Example |
|------|----------|---------|
| `text/x-sql` | SQL | Database queries |
| `text/x-python` | Python | Python scripts |
| `text/x-rsrc` | R | R scripts |
| `text/x-julia` | Julia | Julia scripts |
| `application/json` | JSON | JSON configuration |
| `application/xml` | XML | XML documents |
| `text/x-toml` | TOML | TOML configuration |
| `text/x-yaml` | YAML | YAML configuration |
| `text/javascript` | JavaScript | JavaScript code |
| `text/html` | HTML | HTML markup |
| `text/css` | CSS | CSS styles |
| `text/x-markdown` | Markdown | Markdown text |

### Editor Examples

**SQL Editor:**
```json
{
  "query": {
    "type": "string",
    "title": "SQL Query",
    "format": "editor",
    "options": {
      "editor": {
        "mode": "text/x-sql",
        "lineNumbers": true
      }
    },
    "propertyOrder": 1
  }
}
```

**Python Editor:**
```json
{
  "script": {
    "type": "string",
    "title": "Python Script",
    "format": "editor",
    "options": {
      "editor": {
        "mode": "text/x-python",
        "lineNumbers": true
      }
    },
    "propertyOrder": 1
  }
}
```

**JSON Editor:**
```json
{
  "config": {
    "type": "string",
    "title": "JSON Configuration",
    "format": "editor",
    "options": {
      "editor": {
        "mode": "application/json",
        "lineNumbers": true
      }
    },
    "propertyOrder": 1
  }
}
```

**XML Editor:**
```json
{
  "xml_template": {
    "type": "string",
    "title": "XML Template",
    "format": "editor",
    "options": {
      "editor": {
        "mode": "application/xml",
        "lineNumbers": true
      }
    },
    "propertyOrder": 1
  }
}
```

**TOML Editor:**
```json
{
  "toml_config": {
    "type": "string",
    "title": "TOML Configuration",
    "format": "editor",
    "options": {
      "editor": {
        "mode": "text/x-toml",
        "lineNumbers": true
      }
    },
    "propertyOrder": 1
  }
}
```

**YAML Editor:**
```json
{
  "yaml_config": {
    "type": "string",
    "title": "YAML Configuration",
    "format": "editor",
    "options": {
      "editor": {
        "mode": "text/x-yaml",
        "lineNumbers": true
      }
    },
    "propertyOrder": 1
  }
}
```

## Related Documentation

- [Overview](configuration-schema-overview.md) - Introduction and basics
- [Sync Actions](configuration-schema-sync-actions.md) - Dynamic dropdowns and validation
- [Advanced Patterns](configuration-schema-advanced.md) - Confluence best practices
- [Examples](configuration-schema-examples.md) - Real production examples
