# Sync Actions - Dynamic Field Loading

Sync actions allow fields to be populated dynamically by calling your component's sync action handler.

## What are Sync Actions?

Sync actions enable:
- **Dynamic dropdowns** - Load options from API (e.g., list of tables, entities)
- **Field validation** - Validate user input before submission
- **Data preview** - Show sample data
- **Test connections** - Verify credentials work

## Basic Syntax

```json
{
  "field_name": {
    "type": "string",
    "format": "select",
    "options": {
      "async": {
        "label": "Load Options",
        "action": "actionName",
        "autoload": true,
        "cache": true
      }
    }
  }
}
```

## Common Patterns

### 1. Load Entity List

```json
{
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
  }
}
```

**Implementation** (`src/sync_actions.py`):
```python
def load_entities(params: dict, state: dict) -> dict:
    """Load available entity sets from OData service."""
    client = create_client(params)
    entity_sets = client.get_entity_sets()

    return {
        "options": [
            {"label": name, "value": name}
            for name in entity_sets
        ]
    }
```

### 2. Load Fields for Selected Entity

```json
{
  "select_fields": {
    "type": "array",
    "title": "Select Fields",
    "description": "Select specific fields to extract",
    "format": "select",
    "items": {
      "type": "string"
    },
    "options": {
      "async": {
        "label": "Load Fields",
        "action": "loadFields"
      }
    }
  }
}
```

**Implementation:**
```python
def load_fields(params: dict, state: dict) -> dict:
    """Load fields for selected entity."""
    entity_set = params.get("entity_set")
    if not entity_set:
        return {"options": []}

    client = create_client(params)
    fields = client.get_entity_fields(entity_set)

    return {
        "options": [
            {"label": field, "value": field}
            for field in fields
        ]
    }
```

### 3. Test Connection Button

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

**Implementation:**
```python
def test_connection(params: dict, state: dict) -> dict:
    """Test connection to API."""
    try:
        client = create_client(params)
        client.test_connection()
        return {
            "status": "success",
            "message": "Connection successful!"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Connection failed: {str(e)}"
        }
```

### 4. Validate Input

```json
{
  "filter_expression": {
    "type": "string",
    "title": "Filter Expression",
    "format": "textarea"
  },
  "validate_filter": {
    "type": "button",
    "format": "sync-action",
    "options": {
      "async": {
        "label": "Validate Filter",
        "action": "validateFilter"
      }
    }
  }
}
```

**Implementation:**
```python
def validate_filter(params: dict, state: dict) -> dict:
    """Validate OData filter expression."""
    filter_expr = params.get("filter_expression", "")
    if not filter_expr:
        return {
            "status": "error",
            "message": "Filter expression is empty"
        }

    try:
        # Parse and validate filter
        validate_odata_filter(filter_expr)
        return {
            "status": "success",
            "message": "Filter expression is valid"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Invalid filter: {str(e)}"
        }
```

### 5. Preview Data

```json
{
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
```

**Implementation:**
```python
def preview_data(params: dict, state: dict) -> dict:
    """Preview sample data."""
    entity_set = params.get("entity_set")
    if not entity_set:
        return {
            "status": "error",
            "message": "Please select an entity first"
        }

    client = create_client(params)
    records = client.fetch_records(entity_set, limit=10)

    return {
        "status": "success",
        "preview": records,
        "message": f"Loaded {len(records)} sample records"
    }
```

## Sync Action Options

### `label`
Button text shown to user:
```json
"label": "Load Entity Sets"
```

### `action`
Name of sync action handler function:
```json
"action": "loadEntities"
```

### `autoload`
Load options automatically when field becomes visible:
```json
"autoload": true
```

### `cache`
Cache results to avoid repeated API calls:
```json
"cache": true
```

## Implementation Structure

### Sync Actions Handler (`src/sync_actions.py`)

```python
from keboola.component import SyncActionHandler

class ComponentSyncActions(SyncActionHandler):
    def __init__(self):
        self.actions = {
            'testConnection': self.test_connection,
            'loadEntities': self.load_entities,
            'loadFields': self.load_fields,
            'validateFilter': self.validate_filter,
            'previewData': self.preview_data,
        }

    def handle_action(self, action: str, params: dict, state: dict) -> dict:
        """Route action to appropriate handler."""
        if action not in self.actions:
            return {
                "status": "error",
                "message": f"Unknown action: {action}"
            }

        return self.actions[action](params, state)

    def test_connection(self, params, state):
        # Implementation
        pass

    def load_entities(self, params, state):
        # Implementation
        pass

    # ... other handlers
```

## Response Format

### Success Response

```python
return {
    "status": "success",
    "message": "Operation completed",
    "options": [  # For select fields
        {"label": "Option 1", "value": "option1"},
        {"label": "Option 2", "value": "option2"}
    ]
}
```

### Error Response

```python
return {
    "status": "error",
    "message": "Error description"
}
```

### Preview Response

```python
return {
    "status": "success",
    "preview": [
        {"field1": "value1", "field2": "value2"},
        {"field1": "value3", "field2": "value4"}
    ],
    "message": "Loaded 2 records"
}
```

## Dependencies Between Sync Actions

Load fields only for selected entity:

```json
{
  "entity_set": {
    "type": "string",
    "format": "select",
    "options": {
      "async": {
        "action": "loadEntities",
        "autoload": true
      }
    }
  },
  "select_fields": {
    "type": "array",
    "format": "select",
    "options": {
      "async": {
        "action": "loadFields"  // Uses entity_set from params
      }
    }
  }
}
```

Handler accesses dependent field:
```python
def load_fields(params, state):
    entity_set = params.get("entity_set")  # Get selected entity
    if not entity_set:
        return {"options": []}
    # ... load fields for this entity
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:
```python
def load_entities(params, state):
    try:
        client = create_client(params)
        entities = client.get_entities()
        return {"status": "success", "options": entities}
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to load entities: {str(e)}"
        }
```

### 2. Empty State Handling

Handle cases where dependent fields are empty:
```python
def load_fields(params, state):
    entity = params.get("entity_set")
    if not entity:
        return {
            "status": "error",
            "message": "Please select an entity first"
        }
    # ... continue
```

### 3. Caching

Use cache for expensive operations:
```json
{
  "options": {
    "async": {
      "action": "loadEntities",
      "cache": true  // Cache results
    }
  }
}
```

### 4. Autoload

Use autoload for fields that should populate immediately:
```json
{
  "options": {
    "async": {
      "action": "loadEntities",
      "autoload": true  // Load on page load
    }
  }
}
```

### 5. Clear Labels

Use descriptive button labels:
```json
{
  "async": {
    "label": "Load Available Tables",  // Clear, actionable
    "action": "loadTables"
  }
}
```

## Testing Sync Actions

### Local Testing

1. Start component with sync action mode:
   ```bash
   docker run -e KBC_DATADIR=./data -e KBC_SYNCACTION=loadEntities ...
   ```

2. Use Keboola Developer Portal sync action tester

3. Use `schema-tester` with mock responses

### Example Test

```python
def test_load_entities():
    params = {
        "base_url": "https://api.example.com",
        "#api_key": "test-key"
    }
    state = {}

    result = load_entities(params, state)

    assert result["status"] == "success"
    assert "options" in result
    assert len(result["options"]) > 0
```

## See Also

- `ui-elements.md` - All UI elements
- `conditional-fields.md` - Dynamic show/hide
- `examples.md` - Real-world examples
- [Keboola Sync Actions](https://developers.keboola.com/extend/component/ui-options/sync-actions/)
