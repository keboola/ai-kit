# Real-World Schema Examples

Complete, production-ready configuration schema examples.

## Example 1: SAP OData Extractor

### Component Schema

```json
{
  "type": "object",
  "title": "SAP OData Connection",
  "required": ["base_url", "service_path", "auth_type"],
  "properties": {
    "base_url": {
      "type": "string",
      "title": "Base URL",
      "description": "Base URL of your SAP system",
      "propertyOrder": 1,
      "format": "url"
    },
    "service_path": {
      "type": "string",
      "title": "Service Path",
      "description": "OData service path",
      "propertyOrder": 2
    },
    "odata_version": {
      "type": "string",
      "title": "OData Version",
      "enum": ["auto", "v2", "v4"],
      "default": "auto",
      "propertyOrder": 3
    },
    "auth_type": {
      "type": "string",
      "title": "Authentication Type",
      "enum": ["basic", "oauth", "apiKey"],
      "enum_titles": ["Username & Password", "OAuth 2.0", "API Key"],
      "default": "basic",
      "propertyOrder": 10
    },
    "username": {
      "type": "string",
      "title": "Username",
      "propertyOrder": 11,
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
      "propertyOrder": 12,
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
      "propertyOrder": 13,
      "options": {
        "dependencies": {
          "auth_type": "apiKey"
        }
      }
    },
    "api_key_header_name": {
      "type": "string",
      "title": "API Key Header Name",
      "default": "APIKey",
      "description": "HTTP header name for the API key",
      "propertyOrder": 14,
      "options": {
        "dependencies": {
          "auth_type": "apiKey"
        }
      }
    },
    "timeout": {
      "type": "integer",
      "title": "Request Timeout (seconds)",
      "default": 60,
      "propertyOrder": 20
    },
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
}
```

### Row Schema

```json
{
  "type": "object",
  "title": "Entity Extraction",
  "required": ["entity_set"],
  "properties": {
    "entity_set": {
      "type": "string",
      "title": "Entity Set",
      "description": "Select the entity set to extract",
      "format": "select",
      "propertyOrder": 1,
      "options": {
        "async": {
          "label": "Load Entity Sets",
          "action": "loadEntities",
          "autoload": true,
          "cache": true
        }
      }
    },
    "output_table_name": {
      "type": "string",
      "title": "Output Table Name",
      "description": "Name of the output table in Keboola Storage",
      "propertyOrder": 2
    },
    "select_fields": {
      "type": "array",
      "title": "Select Fields",
      "description": "Select specific fields to extract",
      "format": "select",
      "propertyOrder": 10,
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
    "filter_expression": {
      "type": "string",
      "title": "Filter Expression",
      "description": "OData $filter expression",
      "format": "textarea",
      "propertyOrder": 11
    },
    "sync_type": {
      "type": "string",
      "title": "Sync Type",
      "enum": ["full", "incremental"],
      "enum_titles": ["Full Sync", "Incremental Sync"],
      "default": "full",
      "description": "Full sync loads all data, incremental sync loads only new/changed records",
      "propertyOrder": 20
    },
    "incremental_field": {
      "type": "string",
      "title": "Incremental Field",
      "description": "Field used for incremental sync",
      "format": "select",
      "propertyOrder": 21,
      "options": {
        "dependencies": {
          "sync_type": "incremental"
        },
        "async": {
          "label": "Load Incremental Fields",
          "action": "loadIncrementalFields"
        }
      }
    },
    "primary_key": {
      "type": "array",
      "title": "Primary Key",
      "description": "Fields that form the primary key",
      "format": "select",
      "propertyOrder": 22,
      "items": {
        "type": "string"
      },
      "options": {
        "dependencies": {
          "sync_type": "incremental"
        },
        "async": {
          "label": "Load Primary Keys",
          "action": "loadPossiblePrimaryKeys"
        }
      }
    },
    "preview_data": {
      "type": "button",
      "title": "Preview Data",
      "format": "sync-action",
      "propertyOrder": 100,
      "options": {
        "async": {
          "label": "Preview Data (10 records)",
          "action": "previewData"
        }
      }
    }
  }
}
```

## Example 2: Database Extractor

### Component Schema

```json
{
  "type": "object",
  "title": "Database Connection",
  "required": ["host", "port", "database", "username"],
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
    "database": {
      "type": "string",
      "title": "Database",
      "propertyOrder": 3
    },
    "username": {
      "type": "string",
      "title": "Username",
      "propertyOrder": 4
    },
    "#password": {
      "type": "string",
      "title": "Password",
      "format": "password",
      "propertyOrder": 5
    },
    "use_ssl": {
      "type": "boolean",
      "title": "Use SSL",
      "default": true,
      "propertyOrder": 10
    },
    "ssl_cert": {
      "type": "string",
      "title": "SSL Certificate",
      "format": "textarea",
      "propertyOrder": 11,
      "options": {
        "dependencies": {
          "use_ssl": true
        }
      }
    }
  }
}
```

### Row Schema

```json
{
  "type": "object",
  "title": "Table Query",
  "required": ["query_type"],
  "properties": {
    "query_type": {
      "type": "string",
      "title": "Query Type",
      "enum": ["table", "custom"],
      "enum_titles": ["Select Table", "Custom SQL"],
      "default": "table",
      "propertyOrder": 1
    },
    "table_name": {
      "type": "string",
      "title": "Table Name",
      "format": "select",
      "propertyOrder": 2,
      "options": {
        "dependencies": {
          "query_type": "table"
        },
        "async": {
          "label": "Load Tables",
          "action": "loadTables"
        }
      }
    },
    "custom_sql": {
      "type": "string",
      "title": "Custom SQL",
      "format": "textarea",
      "propertyOrder": 3,
      "options": {
        "dependencies": {
          "query_type": "custom"
        }
      }
    },
    "incremental": {
      "type": "boolean",
      "title": "Incremental Load",
      "default": false,
      "propertyOrder": 10
    },
    "incremental_column": {
      "type": "string",
      "title": "Incremental Column",
      "format": "select",
      "propertyOrder": 11,
      "options": {
        "dependencies": {
          "incremental": true
        },
        "async": {
          "label": "Load Columns",
          "action": "loadColumns"
        }
      }
    }
  }
}
```

## Example 3: REST API Extractor

### Component Schema

```json
{
  "type": "object",
  "title": "API Configuration",
  "required": ["base_url"],
  "properties": {
    "base_url": {
      "type": "string",
      "title": "Base URL",
      "format": "url",
      "propertyOrder": 1
    },
    "auth_method": {
      "type": "string",
      "title": "Authentication Method",
      "enum": ["none", "basic", "bearer", "oauth2"],
      "enum_titles": ["No Authentication", "Basic Auth", "Bearer Token", "OAuth 2.0"],
      "default": "none",
      "propertyOrder": 10
    },
    "username": {
      "type": "string",
      "title": "Username",
      "propertyOrder": 11,
      "options": {
        "dependencies": {
          "auth_method": "basic"
        }
      }
    },
    "#password": {
      "type": "string",
      "title": "Password",
      "format": "password",
      "propertyOrder": 12,
      "options": {
        "dependencies": {
          "auth_method": "basic"
        }
      }
    },
    "#bearer_token": {
      "type": "string",
      "title": "Bearer Token",
      "format": "password",
      "propertyOrder": 13,
      "options": {
        "dependencies": {
          "auth_method": "bearer"
        }
      }
    },
    "#client_id": {
      "type": "string",
      "title": "Client ID",
      "propertyOrder": 14,
      "options": {
        "dependencies": {
          "auth_method": "oauth2"
        }
      }
    },
    "#client_secret": {
      "type": "string",
      "title": "Client Secret",
      "format": "password",
      "propertyOrder": 15,
      "options": {
        "dependencies": {
          "auth_method": "oauth2"
        }
      }
    },
    "oauth_token_url": {
      "type": "string",
      "title": "OAuth Token URL",
      "format": "url",
      "propertyOrder": 16,
      "options": {
        "dependencies": {
          "auth_method": "oauth2"
        }
      }
    }
  }
}
```

## Example 4: Advanced with Multiple Dependencies

```json
{
  "type": "object",
  "title": "Report Configuration",
  "properties": {
    "report_type": {
      "type": "string",
      "title": "Report Type",
      "enum": ["simple", "detailed", "custom"],
      "default": "simple",
      "propertyOrder": 1
    },
    "include_charts": {
      "type": "boolean",
      "title": "Include Charts",
      "default": false,
      "propertyOrder": 2,
      "options": {
        "dependencies": {
          "report_type": ["detailed", "custom"]
        }
      }
    },
    "chart_type": {
      "type": "string",
      "title": "Chart Type",
      "enum": ["bar", "line", "pie"],
      "propertyOrder": 3,
      "options": {
        "dependencies": {
          "report_type": ["detailed", "custom"],
          "include_charts": true
        }
      }
    },
    "custom_template": {
      "type": "string",
      "title": "Custom Template",
      "format": "textarea",
      "propertyOrder": 10,
      "options": {
        "dependencies": {
          "report_type": "custom"
        }
      }
    }
  }
}
```

## Key Patterns

### Pattern 1: Authentication Variants

Use conditional fields for different auth types:
- Basic auth → username + password
- API key → key + header name
- OAuth → client ID + client secret + token URL

### Pattern 2: Sync Type

Toggle between full and incremental:
- Full → no extra fields
- Incremental → incremental field + primary key

### Pattern 3: Query Type

Different input methods:
- Table → dropdown of tables
- Custom → SQL textarea

### Pattern 4: Advanced Options

Show advanced settings conditionally:
- Simple mode → basic fields only
- Advanced mode → additional configuration

## Testing Examples

Use `schema-tester` to test these examples:

1. Copy schema to your project's `component_config/`
2. Start schema-tester
3. Test all conditional paths
4. Verify JSON output

## See Also

- `conditional-fields.md` - Conditional field patterns
- `ui-elements.md` - All UI elements
- `sync-actions.md` - Dynamic field loading
- [Keboola Examples](https://developers.keboola.com/extend/component/ui-options/configuration-schema/examples/)
