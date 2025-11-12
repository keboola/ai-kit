# Self-Documenting Workflow Pattern

**CRITICAL**: The `run()` method should be a clear, readable "table of contents" that orchestrates the component workflow. Extract complex logic into well-named private methods.

## Anti-Pattern vs Best Practice

### ❌ ANTI-PATTERN - Monolithic run() Method

```python
def run(self):
    """Main execution code"""
    try:
        # Everything mixed together in 200+ lines
        self.validate_configuration(['api_key', 'endpoint'])
        params = self.configuration.parameters

        # Authentication logic inline
        import requests
        session = requests.Session()
        auth_response = session.post(
            f"{params['endpoint']}/auth",
            json={'api_key': params['api_key']}
        )
        if auth_response.status_code != 200:
            raise ValueError("Auth failed")
        token = auth_response.json()['token']
        session.headers.update({'Authorization': f'Bearer {token}'})

        # Load state inline
        state = self.get_state_file()
        last_id = state.get('last_id', 0)

        # Fetch data with pagination - all inline
        all_records = []
        page = 1
        while True:
            response = session.get(
                f"{params['endpoint']}/data",
                params={'page': page, 'since_id': last_id}
            )
            if response.status_code != 200:
                logging.error(f"Failed page {page}")
                break
            data = response.json()
            if not data['records']:
                break

            # Transform data inline
            for record in data['records']:
                transformed = {
                    'id': record['id'],
                    'name': record['name'].upper(),
                    'value': float(record['value']) * 1.2,
                    'date': datetime.strptime(record['date'], '%Y-%m-%d').isoformat(),
                    'category': record.get('category', 'unknown'),
                }
                all_records.append(transformed)

            page += 1
            if page > 100:  # Safety limit
                break

        # Save output inline
        import csv
        out_path = f"{self.data_folder_path}/out/tables/output.csv"
        with open(out_path, 'w', newline='') as f:
            if all_records:
                writer = csv.DictWriter(f, fieldnames=all_records[0].keys())
                writer.writeheader()
                writer.writerows(all_records)

        # Write manifest inline
        manifest = {
            'destination': 'out.c-main.data',
            'incremental': True,
        }
        import json
        with open(f"{out_path}.manifest", 'w') as f:
            json.dump(manifest, f)

        # Update state inline
        if all_records:
            max_id = max(r['id'] for r in all_records)
            self.write_state_file({'last_id': max_id})

    except Exception as err:
        logging.error(str(err))
        sys.exit(2)
```

**Problems:**
- ❌ 80+ lines of mixed concerns in one method
- ❌ Impossible to understand the workflow at a glance
- ❌ Cannot test authentication, pagination, or transformation separately
- ❌ Hard to debug which step failed
- ❌ Difficult to modify one part without affecting others
- ❌ No clear indication of what the component does

### ✅ BEST PRACTICE - Self-Documenting Workflow

```python
def run(self):
    """Main execution - orchestrates the component workflow."""
    try:
        # Clear, readable workflow - acts as "table of contents"
        params = self._validate_and_get_configuration()
        state = self._load_previous_state()

        input_data = self._process_input_tables()
        results = self._perform_business_logic(input_data, params, state)

        self._save_output_tables(results)
        self._update_state(results)

    except ValueError as err:
        logging.error(str(err))
        print(err, file=sys.stderr)
        sys.exit(1)
    except Exception as err:
        logging.exception("Unhandled error occurred")
        traceback.print_exc(file=sys.stderr)
        sys.exit(2)

def _validate_and_get_configuration(self) -> Configuration:
    """Validate configuration and return typed parameters."""
    self.validate_configuration(REQUIRED_PARAMETERS)
    return Configuration(**self.configuration.parameters)

def _load_previous_state(self) -> Dict[str, Any]:
    """Load state from previous run for incremental processing."""
    return self.get_state_file()

def _process_input_tables(self) -> List[Dict[str, Any]]:
    """Process all input tables with proper CSV handling."""
    input_tables = self.get_input_tables_definitions()
    all_data = []

    for table in input_tables:
        table_data = self._process_single_table(table)
        all_data.extend(table_data)

    return all_data

def _process_single_table(self, table_def) -> List[Dict[str, Any]]:
    """Process individual table with null character handling."""
    with open(table_def.full_path, 'r', encoding='utf-8') as f:
        lazy_lines = (line.replace('\0', '') for line in f)
        reader = csv.DictReader(lazy_lines, dialect='kbc')
        return [self._transform_row(row) for row in reader]

@staticmethod
def _transform_row(row: Dict[str, str]) -> Dict[str, Any]:
    """Transform single row of data."""
    # Transformation logic here
    return transformed_row

def _perform_business_logic(
    self,
    data: List[Dict[str, Any]],
    params: Configuration,
    state: Dict[str, Any]
) -> ProcessedResults:
    """Core business logic - extract/transform/process data."""
    # Main processing logic here
    return results

def _save_output_tables(self, results: ProcessedResults):
    """Write results to output tables with manifests."""
    out_table = self.create_out_table_definition(
        name="output.csv",
        destination="out.c-data.output",
        schema=self._get_output_schema(),
        incremental=True
    )

    with open(out_table.full_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=out_table.column_names)
        writer.writeheader()
        writer.writerows(results.data)

    self.write_manifest(out_table)

def _update_state(self, results: ProcessedResults):
    """Save state for next incremental run."""
    self.write_state_file({
        'last_timestamp': results.last_timestamp,
        'records_processed': results.count,
        'last_run_stats': results.stats
    })

@staticmethod
def _get_output_schema() -> OrderedDict:
    """Define output table schema."""
    from collections import OrderedDict
    from keboola.component.dao import ColumnDefinition, BaseType

    return OrderedDict({
        "id": ColumnDefinition(data_types=BaseType.integer(), primary_key=True),
        "name": ColumnDefinition(),
        "value": ColumnDefinition(data_types=BaseType.numeric(length="10,2"))
    })
```

**Benefits:**
- ✅ `run()` reads like a story - clear workflow at a glance
- ✅ Each method has single responsibility
- ✅ Easy to test individual steps
- ✅ Method names eliminate need for comments
- ✅ Proper type hints on each method
- ✅ Reusable helper methods (e.g., `_transform_row`)
- ✅ `@staticmethod` for utility functions
- ✅ Easy to maintain and extend

## Key Principles

1. **run() as Orchestrator**: Coordinates workflow, delegates to specialized methods
2. **One Method, One Purpose**: Each private method does exactly one thing
3. **Self-Documenting Names**: Method names clearly describe what they do
4. **Progressive Complexity**: Start high-level, drill down into details as needed
5. **Type Hints Everywhere**: Clear contracts between methods
6. **Static When Possible**: Mark utility methods as `@staticmethod`

## When to Extract Methods

### Extract to Separate Method If:

- ✅ Logic block is > 10-15 lines
- ✅ Block has clear single purpose
- ✅ You need a comment to explain what it does
- ✅ Logic could be reused elsewhere
- ✅ Logic could be tested independently

### Keep Inline If:

- ❌ Only 2-3 lines of simple code
- ❌ Used only once and tightly coupled
- ❌ Would create method with too many parameters

## Real-World Example

Here's a complete example of a well-structured component:

```python
from typing import Dict, List, Any
from pathlib import Path
from dataclasses import dataclass

@dataclass
class ProcessedResults:
    """Container for processing results."""
    data: List[Dict[str, Any]]
    count: int
    last_timestamp: str
    stats: Dict[str, Any]

class Component(CommonInterface):
    """Well-structured component with self-documenting workflow."""

    def run(self):
        """Main execution - orchestrates the component workflow."""
        try:
            params = self._validate_and_get_configuration()
            state = self._load_previous_state()

            input_data = self._process_input_tables()
            results = self._perform_business_logic(input_data, params, state)

            self._save_output_tables(results)
            self._update_state(results)

            logging.info(f"Successfully processed {results.count} records")

        except ValueError as err:
            logging.error(str(err))
            print(err, file=sys.stderr)
            sys.exit(1)
        except Exception as err:
            logging.exception("Unhandled error occurred")
            traceback.print_exc(file=sys.stderr)
            sys.exit(2)

    def _validate_and_get_configuration(self) -> Configuration:
        """Validate configuration and return typed parameters."""
        self.validate_configuration(['api_key', 'endpoint'])
        return Configuration(**self.configuration.parameters)

    def _load_previous_state(self) -> Dict[str, Any]:
        """Load state from previous run for incremental processing."""
        state = self.get_state_file()
        logging.info(f"Last run: {state.get('last_timestamp', 'never')}")
        return state

    def _process_input_tables(self) -> List[Dict[str, Any]]:
        """Process all input tables with proper CSV handling."""
        tables = self.get_input_tables_definitions()
        return [row for table in tables for row in self._process_single_table(table)]

    def _process_single_table(self, table_def) -> List[Dict[str, Any]]:
        """Process individual table with null character handling."""
        with open(table_def.full_path, 'r', encoding='utf-8') as f:
            lazy_lines = (line.replace('\0', '') for line in f)
            reader = csv.DictReader(lazy_lines, dialect='kbc')
            return [self._transform_row(row) for row in reader]

    @staticmethod
    def _transform_row(row: Dict[str, str]) -> Dict[str, Any]:
        """Transform single row of data."""
        return {
            'id': int(row['id']),
            'name': row['name'].strip(),
            'value': float(row['value']) if row['value'] else 0.0
        }

    def _perform_business_logic(
        self,
        data: List[Dict[str, Any]],
        params: Configuration,
        state: Dict[str, Any]
    ) -> ProcessedResults:
        """Core business logic - extract/transform/process data."""
        # Your main processing logic here
        processed = [self._enrich_record(record, params) for record in data]

        return ProcessedResults(
            data=processed,
            count=len(processed),
            last_timestamp=datetime.now(timezone.utc).isoformat(),
            stats={'total': len(processed)}
        )

    @staticmethod
    def _enrich_record(record: Dict[str, Any], params: Configuration) -> Dict[str, Any]:
        """Enrich individual record with additional data."""
        # Enrichment logic here
        return record

    def _save_output_tables(self, results: ProcessedResults):
        """Write results to output tables with manifests."""
        out_table = self.create_out_table_definition(
            name="output.csv",
            destination="out.c-data.output",
            schema=self._get_output_schema(),
            incremental=True
        )

        with open(out_table.full_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=out_table.column_names)
            writer.writeheader()
            writer.writerows(results.data)

        self.write_manifest(out_table)
        logging.info(f"Wrote {results.count} records to {out_table.name}")

    def _update_state(self, results: ProcessedResults):
        """Save state for next incremental run."""
        self.write_state_file({
            'last_timestamp': results.last_timestamp,
            'records_processed': results.count,
            'last_run_stats': results.stats
        })

    @staticmethod
    def _get_output_schema() -> OrderedDict:
        """Define output table schema."""
        from collections import OrderedDict
        from keboola.component.dao import ColumnDefinition, BaseType

        return OrderedDict({
            "id": ColumnDefinition(data_types=BaseType.integer(), primary_key=True),
            "name": ColumnDefinition(),
            "value": ColumnDefinition(data_types=BaseType.numeric(length="10,2"))
        })
```

## Summary

The self-documenting workflow pattern makes your code:
- **Readable**: Anyone can understand the flow in seconds
- **Testable**: Each method can be tested independently
- **Maintainable**: Easy to modify individual steps
- **Professional**: Follows industry best practices

## Related Documentation

- [Code Quality Guidelines](code-quality.md)
- [Architecture Guide](architecture.md)
- [Best Practices](best-practices.md)
