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

## Backend Implementation (Python)

### ✅ CORRECT: Using @sync_action Decorator

Sync actions in Python components **MUST** be implemented using the `@sync_action` decorator from `keboola.component.base`.

#### Required Import

```python
from keboola.component.base import ComponentBase, sync_action
from keboola.component.exceptions import UserException
```

#### Basic Implementation

```python
class Component(ComponentBase):
    def run(self) -> None:
        """Main execution - runs when action='run' or no action specified."""
        # Your main component logic
        pass

    @sync_action("testConnection")
    def test_connection(self) -> dict:
        """
        Test connection - executed when action='testConnection'.

        Returns:
            dict: Response in format {"status": "success", "message": "..."}
        """
        try:
            # Get parameters directly (no need for full configuration validation)
            uri = self.configuration.parameters.get("authentication", {}).get("#uri")
            if not uri:
                raise UserException("URI is required")

            # Test connection logic here
            # ... your connection test code ...

            return {"status": "success", "message": "Connection successful"}
        except Exception as e:
            raise UserException(f"Connection failed: {e}") from e

    @sync_action("listDatabases")
    def list_databases(self) -> dict:
        """
        List databases for dropdown - executed when action='listDatabases'.

        Returns:
            dict: Response in format {"status": "success", "data": [{"value": "...", "label": "..."}]}
        """
        try:
            uri = self.configuration.parameters.get("authentication", {}).get("#uri")
            if not uri:
                raise UserException("URI is required")

            # Get list of databases
            databases = ["db1", "db2", "db3"]  # Your logic here

            # Format for Keboola UI dropdown
            dropdown_data = [{"value": db, "label": db} for db in databases]

            return {"status": "success", "data": dropdown_data}
        except Exception as e:
            raise UserException(f"Failed to list databases: {e}") from e

    @sync_action("listTables")
    def list_tables(self) -> dict:
        """
        List tables for dropdown - executed when action='listTables'.
        Receives current form values including selected database.

        Returns:
            dict: Response in format {"status": "success", "data": [{"value": "...", "label": "..."}]}
        """
        try:
            uri = self.configuration.parameters.get("authentication", {}).get("#uri")
            database = self.configuration.parameters.get("destination", {}).get("database")

            if not uri or not database:
                raise UserException("URI and database are required")

            # Get list of tables in the selected database
            tables = ["table1", "table2", "table3"]  # Your logic here

            # Format for Keboola UI dropdown
            dropdown_data = [{"value": tbl, "label": tbl} for tbl in tables]

            return {"status": "success", "data": dropdown_data}
        except Exception as e:
            raise UserException(f"Failed to list tables: {e}") from e
```

#### How the Decorator Works

The `@sync_action` decorator automatically:
1. **Routes the action** - Maps `action` parameter in config.json to the decorated method
2. **Handles output** - Writes JSON response to stdout
3. **Catches exceptions** - Converts exceptions to error responses
4. **Exits cleanly** - Exits after sync action completes
5. **Mutes logging** - Sets log level to FATAL during sync actions
6. **Serializes JSON** - Converts return dict to JSON automatically

#### Complete Example

```python
import csv
import logging

from keboola.component.base import ComponentBase, sync_action
from keboola.component.exceptions import UserException

from your_client import YourClient


class Component(ComponentBase):
    def __init__(self):
        self._configuration = None
        self.client = None
        super().__init__()

    def run(self) -> None:
        """Main execution - runs when action='run' or no action specified."""
        self._init_configuration()
        self._init_client()
        self.process_data()

    @sync_action("testConnection")
    def test_connection(self) -> dict:
        """Test connection to the service."""
        uri = self.configuration.parameters.get("authentication", {}).get("#uri")
        if not uri:
            raise UserException("URI is required")

        client = YourClient(uri)
        client.test_connection()

        return {"status": "success", "message": "Connection successful"}

    @sync_action("listDatabases")
    def list_databases(self) -> dict:
        """List available databases."""
        uri = self.configuration.parameters.get("authentication", {}).get("#uri")
        if not uri:
            raise UserException("URI is required")

        client = YourClient(uri)
        databases = client.list_databases()

        dropdown_data = [{"value": db, "label": db} for db in databases]
        return {"status": "success", "data": dropdown_data}

    @sync_action("listCollections")
    def list_collections(self) -> dict:
        """List collections in selected database (dependent dropdown)."""
        uri = self.configuration.parameters.get("authentication", {}).get("#uri")
        database = self.configuration.parameters.get("destination", {}).get("database")

        if not uri:
            raise UserException("URI is required")
        if not database:
            raise UserException("Database is required to list collections")

        client = YourClient(uri, database)
        collections = client.list_collections()

        dropdown_data = [{"value": col, "label": col} for col in collections]
        return {"status": "success", "data": dropdown_data}

    def _init_configuration(self):
        # Your configuration initialization
        pass

    def _init_client(self):
        # Your client initialization
        pass

    def process_data(self):
        # Your main logic
        pass


if __name__ == "__main__":
    try:
        comp = Component()
        # execute_action() automatically routes to the correct method
        comp.execute_action()
    except UserException as exc:
        logging.exception(exc)
        exit(1)
    except Exception as exc:
        logging.exception(exc)
        exit(2)
```

### Key Points

1. **Use `@sync_action` decorator** - Standard way to implement sync actions in Keboola components
2. **Access parameters via `self.configuration.parameters`** - Configuration validation not required for sync actions
3. **Return dict with response** - Decorator handles JSON serialization automatically
4. **Raise `UserException` for errors** - Decorator converts exceptions to proper error responses
5. **Method names are flexible** - Decorator uses the action name from `@sync_action("actionName")`
6. **Dependent dropdowns receive form values** - Current form state is automatically passed to the action

## Related Documentation

- [Overview](configuration-schema-overview.md) - Introduction and basics
- [UI Elements](configuration-schema-ui-elements.md) - Field formats and options
- [Advanced Patterns](configuration-schema-advanced.md) - Confluence best practices
- [Examples](configuration-schema-examples.md) - Real production examples
