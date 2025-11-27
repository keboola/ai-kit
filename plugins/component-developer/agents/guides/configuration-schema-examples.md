# Configuration Schema Examples

Real production examples from Keboola Storage API (888+ components analyzed).

## Table of Contents

1. [Simple Extractor](#simple-extractor)
2. [Database Extractor with Rows](#database-extractor-with-rows)
3. [SQL Editor Component](#sql-editor-component)
4. [Date Picker Example](#date-picker-example)
5. [Code Editor with Validation](#code-editor-with-validation)
6. [AWS Cost and Usage Reports](#aws-cost-and-usage-reports)
7. [Salesforce Extractor (Complete)](#salesforce-extractor-complete)
8. [API Statistics](#api-statistics)

## Simple Extractor

Basic extractor with API credentials:

```json
{
  "type": "object",
  "title": "Configuration",
  "required": ["#api_key", "endpoint"],
  "properties": {
    "#api_key": {
      "type": "string",
      "title": "API Key",
      "format": "password",
      "description": "Your API key for authentication",
      "propertyOrder": 1
    },
    "endpoint": {
      "type": "string",
      "title": "API Endpoint",
      "format": "uri",
      "default": "https://api.example.com/v1",
      "propertyOrder": 2
    },
    "test_connection": {
      "type": "button",
      "format": "test-connection",
      "propertyOrder": 3,
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

## Database Extractor with Rows

### configSchema.json (Root Configuration)

```json
{
  "type": "object",
  "title": "Database Connection",
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
    "ssh_tunnel": {
      "type": "object",
      "title": "SSH Tunnel",
      "options": {
        "collapsed": true
      },
      "propertyOrder": 6,
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
      }
    },
    "test_connection": {
      "type": "button",
      "format": "test-connection",
      "propertyOrder": 7,
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

### configRowSchema.json (Row Configuration)

```json
{
  "type": "object",
  "title": "Table Configuration",
  "required": ["table"],
  "properties": {
    "schema": {
      "type": "string",
      "title": "Schema",
      "format": "select",
      "propertyOrder": 1,
      "options": {
        "async": {
          "label": "Load Schemas",
          "action": "loadSchemas",
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
    },
    "columns": {
      "type": "array",
      "title": "Columns",
      "format": "select",
      "propertyOrder": 3,
      "items": {
        "type": "string"
      },
      "options": {
        "async": {
          "label": "Load Columns",
          "action": "loadColumns"
        }
      }
    },
    "incremental": {
      "type": "boolean",
      "title": "Incremental Load",
      "default": false,
      "propertyOrder": 4
    },
    "primary_key": {
      "type": "array",
      "title": "Primary Key",
      "items": {
        "type": "string"
      },
      "propertyOrder": 5
    }
  }
}
```

## SQL Editor Component

Component with SQL code editor (Snowflake Query Runner):

```json
{
  "type": "object",
  "title": "Snowflake Query Runner",
  "required": ["host", "#password", "query"],
  "properties": {
    "host": {
      "type": "string",
      "title": "Host",
      "description": "Snowflake account URL (e.g., account.snowflakecomputing.com)",
      "propertyOrder": 1
    },
    "username": {
      "type": "string",
      "title": "Username",
      "propertyOrder": 2
    },
    "auth_type": {
      "type": "string",
      "title": "Authentication Type",
      "enum": ["password", "key_pair"],
      "enum_titles": ["Password", "Key Pair"],
      "default": "password",
      "propertyOrder": 3
    },
    "#password": {
      "type": "string",
      "title": "Password",
      "format": "password",
      "propertyOrder": 4
    },
    "#private_key": {
      "type": "string",
      "title": "Private Key",
      "format": "textarea",
      "propertyOrder": 5
    },
    "warehouse": {
      "type": "string",
      "title": "Warehouse",
      "propertyOrder": 6
    },
    "database": {
      "type": "string",
      "title": "Database",
      "propertyOrder": 7
    },
    "schema": {
      "type": "string",
      "title": "Schema",
      "default": "PUBLIC",
      "propertyOrder": 8
    },
    "query": {
      "type": "string",
      "title": "SQL Query",
      "format": "editor",
      "propertyOrder": 9,
      "options": {
        "editor": {
          "mode": "text/x-sql",
          "lineNumbers": true
        }
      }
    },
    "test_connection": {
      "type": "button",
      "format": "test-connection",
      "propertyOrder": 10,
      "options": {
        "async": {
          "label": "Test Connection",
          "action": "testConnection"
        }
      }
    }
  },
  "dependencies": {
    "auth_type": {
      "oneOf": [
        {
          "properties": {
            "auth_type": {"enum": ["password"]},
            "#password": {"type": "string"}
          },
          "required": ["#password"]
        },
        {
          "properties": {
            "auth_type": {"enum": ["key_pair"]},
            "#private_key": {"type": "string"}
          },
          "required": ["#private_key"]
        }
      ]
    }
  }
}
```

## Date Picker Example

Component with date picker (Zbozi.cz Extractor):

```json
{
  "type": "object",
  "title": "Zbozi.cz Report Configuration",
  "required": ["#api_key", "shop_id"],
  "properties": {
    "#api_key": {
      "type": "string",
      "title": "API Key",
      "format": "password",
      "propertyOrder": 1
    },
    "shop_id": {
      "type": "string",
      "title": "Shop ID",
      "propertyOrder": 2
    },
    "date_from": {
      "type": "string",
      "title": "Date From",
      "format": "date",
      "description": "Start date for the report",
      "propertyOrder": 3,
      "options": {
        "flatpickr": {
          "enableTime": false,
          "dateFormat": "Y-m-d"
        }
      }
    },
    "date_to": {
      "type": "string",
      "title": "Date To",
      "format": "date",
      "description": "End date for the report",
      "propertyOrder": 4,
      "options": {
        "flatpickr": {
          "enableTime": false,
          "dateFormat": "Y-m-d"
        }
      }
    },
    "report_type": {
      "type": "string",
      "title": "Report Type",
      "enum": ["daily", "weekly", "monthly"],
      "enum_titles": ["Daily", "Weekly", "Monthly"],
      "default": "daily",
      "propertyOrder": 5
    }
  }
}
```

## Code Editor with Validation

Component with Python code editor and validation button (Booklist Maintainer):

```json
{
  "type": "object",
  "title": "Python Script Configuration",
  "required": ["script"],
  "properties": {
    "script": {
      "type": "string",
      "title": "Python Script",
      "format": "editor",
      "default": "# Your Python code here\nimport pandas as pd\n\ndef process(data):\n    return data",
      "propertyOrder": 1,
      "options": {
        "editor": {
          "mode": "text/x-python",
          "lineNumbers": true
        }
      }
    },
    "validate_script": {
      "type": "button",
      "format": "sync-action",
      "propertyOrder": 2,
      "options": {
        "async": {
          "label": "Validate Script",
          "action": "validateScript"
        }
      }
    },
    "timeout": {
      "type": "integer",
      "title": "Timeout (seconds)",
      "default": 300,
      "minimum": 60,
      "maximum": 3600,
      "propertyOrder": 3
    },
    "memory_limit": {
      "type": "string",
      "title": "Memory Limit",
      "enum": ["256m", "512m", "1g", "2g", "4g"],
      "enum_titles": ["256 MB", "512 MB", "1 GB", "2 GB", "4 GB"],
      "default": "512m",
      "propertyOrder": 4
    }
  }
}
```

## AWS Cost and Usage Reports

Complex extractor with nested objects and enums:

```json
{
  "type": "object",
  "title": "AWS Cost and Usage Reports",
  "required": ["#aws_access_key_id", "#aws_secret_access_key", "s3_bucket"],
  "properties": {
    "#aws_access_key_id": {
      "type": "string",
      "title": "AWS Access Key ID",
      "format": "password",
      "propertyOrder": 1
    },
    "#aws_secret_access_key": {
      "type": "string",
      "title": "AWS Secret Access Key",
      "format": "password",
      "propertyOrder": 2
    },
    "region": {
      "type": "string",
      "title": "AWS Region",
      "enum": [
        "us-east-1",
        "us-east-2",
        "us-west-1",
        "us-west-2",
        "eu-west-1",
        "eu-west-2",
        "eu-central-1",
        "ap-northeast-1",
        "ap-southeast-1",
        "ap-southeast-2"
      ],
      "enum_titles": [
        "US East (N. Virginia)",
        "US East (Ohio)",
        "US West (N. California)",
        "US West (Oregon)",
        "EU (Ireland)",
        "EU (London)",
        "EU (Frankfurt)",
        "Asia Pacific (Tokyo)",
        "Asia Pacific (Singapore)",
        "Asia Pacific (Sydney)"
      ],
      "default": "us-east-1",
      "propertyOrder": 3
    },
    "s3_bucket": {
      "type": "string",
      "title": "S3 Bucket",
      "description": "Name of the S3 bucket containing CUR reports",
      "propertyOrder": 4
    },
    "s3_prefix": {
      "type": "string",
      "title": "S3 Prefix",
      "description": "Path prefix for CUR reports in the bucket",
      "propertyOrder": 5
    },
    "report_name": {
      "type": "string",
      "title": "Report Name",
      "propertyOrder": 6
    },
    "options": {
      "type": "object",
      "title": "Options",
      "options": {
        "collapsed": true
      },
      "propertyOrder": 7,
      "properties": {
        "incremental": {
          "type": "boolean",
          "title": "Incremental Load",
          "default": true,
          "description": "Only load new data since last run",
          "propertyOrder": 1
        },
        "date_range": {
          "type": "object",
          "title": "Date Range",
          "propertyOrder": 2,
          "properties": {
            "start_date": {
              "type": "string",
              "title": "Start Date",
              "format": "date",
              "propertyOrder": 1
            },
            "end_date": {
              "type": "string",
              "title": "End Date",
              "format": "date",
              "propertyOrder": 2
            }
          }
        },
        "columns": {
          "type": "array",
          "title": "Columns to Extract",
          "items": {
            "type": "string"
          },
          "propertyOrder": 3
        }
      }
    },
    "test_connection": {
      "type": "button",
      "format": "test-connection",
      "propertyOrder": 8,
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

## Salesforce Extractor (Complete)

Full production example with all features:

### configSchema.json

```json
{
  "type": "object",
  "title": "Salesforce Configuration",
  "required": ["login_type"],
  "properties": {
    "login_type": {
      "type": "string",
      "title": "Login Type",
      "enum": ["password", "oauth", "oauth_cc"],
      "enum_titles": [
        "Username & Password",
        "OAuth (User)",
        "OAuth (Client Credentials)"
      ],
      "default": "password",
      "propertyOrder": 1
    },
    "sandbox": {
      "type": "boolean",
      "title": "Sandbox Environment",
      "default": false,
      "description": "Connect to Salesforce sandbox instead of production",
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
    "#security_token": {
      "type": "string",
      "title": "Security Token",
      "format": "password",
      "description": "Your Salesforce security token",
      "propertyOrder": 5
    },
    "api_version": {
      "type": "string",
      "title": "API Version",
      "default": "58.0",
      "propertyOrder": 6
    },
    "proxy": {
      "type": "array",
      "title": "Proxy Settings (Optional)",
      "maxItems": 1,
      "propertyOrder": 7,
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
            "title": "Proxy Username",
            "propertyOrder": 3
          },
          "#password": {
            "type": "string",
            "title": "Proxy Password",
            "format": "password",
            "propertyOrder": 4
          }
        }
      }
    },
    "test_connection": {
      "type": "button",
      "format": "test-connection",
      "propertyOrder": 8,
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
        },
        {
          "properties": {
            "login_type": {"enum": ["oauth_cc"]}
          }
        }
      ]
    }
  }
}
```

### configRowSchema.json

```json
{
  "type": "object",
  "title": "Object Configuration",
  "required": ["object"],
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
    "query_type": {
      "type": "string",
      "title": "Query Type",
      "enum": ["standard", "custom"],
      "enum_titles": ["Standard (All Fields)", "Custom SOQL"],
      "default": "standard",
      "propertyOrder": 4
    },
    "soql": {
      "type": "string",
      "title": "Custom SOQL Query",
      "format": "editor",
      "propertyOrder": 5,
      "options": {
        "editor": {
          "mode": "text/x-sql",
          "lineNumbers": true
        }
      }
    },
    "validate_soql": {
      "type": "button",
      "format": "sync-action",
      "propertyOrder": 6,
      "options": {
        "async": {
          "label": "Validate SOQL",
          "action": "validateSoql"
        }
      }
    },
    "incremental": {
      "type": "boolean",
      "title": "Incremental Load",
      "default": false,
      "propertyOrder": 7
    },
    "incremental_field": {
      "type": "string",
      "title": "Incremental Field",
      "format": "select",
      "propertyOrder": 8,
      "options": {
        "async": {
          "label": "Load Date Fields",
          "action": "loadDateFields"
        }
      }
    }
  },
  "dependencies": {
    "query_type": {
      "oneOf": [
        {
          "properties": {
            "query_type": {"enum": ["standard"]},
            "object": {"type": "string"},
            "fields": {"type": "array"}
          },
          "required": ["object"]
        },
        {
          "properties": {
            "query_type": {"enum": ["custom"]},
            "soql": {"type": "string"}
          },
          "required": ["soql"]
        }
      ]
    },
    "incremental": {
      "oneOf": [
        {
          "properties": {
            "incremental": {"enum": [false]}
          }
        },
        {
          "properties": {
            "incremental": {"enum": [true]},
            "incremental_field": {"type": "string"}
          },
          "required": ["incremental_field"]
        }
      ]
    }
  }
}
```

## API Statistics

Based on analysis of 888 components from Keboola Storage API:

### Component Types

| Type | Count |
|------|-------|
| extractor | 412 |
| writer | 156 |
| application | 203 |
| transformation | 45 |
| processor | 52 |
| code-pattern | 12 |
| other | 8 |

### Most Common Formats

| Format | Usage Count |
|--------|-------------|
| password | 756 |
| select | 423 |
| textarea | 312 |
| editor | 187 |
| checkbox | 156 |
| date | 89 |
| uri | 67 |

### Most Common Sync Actions

| Action | Usage Count |
|--------|-------------|
| testConnection | 534 |
| loadTables | 312 |
| loadColumns | 287 |
| loadSchemas | 156 |
| loadObjects | 134 |
| loadFields | 98 |
| validateQuery | 67 |

### Most Common Editor Modes

| Mode | Usage Count |
|------|-------------|
| text/x-sql | 145 |
| application/json | 89 |
| text/x-python | 45 |
| text/x-yaml | 23 |
| text/x-toml | 12 |
| application/xml | 8 |

## Related Documentation

- [Overview](configuration-schema-overview.md) - Introduction and basics
- [UI Elements](configuration-schema-ui-elements.md) - Field formats and options
- [Sync Actions](configuration-schema-sync-actions.md) - Dynamic dropdowns and validation
- [Advanced Patterns](configuration-schema-advanced.md) - Confluence best practices
