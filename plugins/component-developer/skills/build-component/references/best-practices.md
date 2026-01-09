# Best Practices Reference

Quick reference guide for common patterns and anti-patterns in Keboola component development.

## ✅ DO

### General Development
- Use `CommonInterface` class for all Keboola interactions
- Validate configuration early with `validate_configuration()`
- Process CSV files with generators for memory efficiency
- Always specify `encoding='utf-8'` for file operations
- Use proper exit codes (1 for user errors, 2 for system errors)
- Define explicit schemas for output tables
- Implement state management for incremental processing
- Write comprehensive tests
- Use service account credentials for CI/CD
- Follow semantic versioning for releases

### Data Directory Management
- **Remove cookiecutter example files and create component-specific `data/config.json`**
- **Include realistic example parameters in `data/config.json` for local testing**
- **Trust that Keboola platform creates all data directories**

### Code Organization
- **Keep `run()` method as orchestrator - extract complex logic to private methods**
- **Use self-documenting method names that eliminate need for comments**
- **Extract logic blocks > 10-15 lines into separate methods**

### Code Quality
- **Format all code with `ruff format .` before committing**
- **Run `ruff check --fix .` to catch linting issues**
- **Add proper type hints to all functions and variables**
- **Import library-specific types (e.g., `MessageParam` from anthropic)**
- **Check IDE for type warnings and fix them**
- **Use `@staticmethod` decorator when method doesn't use `self`**

## ❌ DON'T

### General Development
- Load entire CSV files into memory
- Use personal credentials for deployment
- Include 'extractor', 'writer', or 'application' in component names
- Skip configuration validation
- Forget to write manifests for output tables
- Use exit code 0 for errors
- Hard-code configuration values
- Skip state file management for incremental loads
- Forget to handle null characters in CSV files
- Deploy without proper testing

### Data Directory Management
- **Leave cookiecutter example files (test.csv, order1.xml, .gitkeep) in `data/` directory**
- **Forget to create `data/config.json` with example parameters for local testing**
- **Delete the entire `data/` directory structure (keep empty folders + config.json)**
- **Call `mkdir()` for platform-managed directories (in/, out/, tables/, files/)**

### Code Organization
- **Write monolithic `run()` methods with 100+ lines**
- **Mix business logic with I/O operations in same method**
- **Use comments to explain what code does (use method names instead)**

### Code Quality
- **Ignore IDE type warnings (red squiggles)**
- **Use plain `dict` for API calls without type annotations**
- **Skip type hints on function parameters**
- **Ignore "may be static" warnings from IDE**

## Common Patterns

### CSV Processing Pattern
```python
# ✅ DO: Use generator for memory efficiency
with open(table.full_path, 'r', encoding='utf-8') as f:
    lazy_lines = (line.replace('\0', '') for line in f)
    reader = csv.DictReader(lazy_lines, dialect='kbc')
    for row in reader:
        yield process_row(row)

# ❌ DON'T: Load entire file into memory
with open(table.full_path, 'r') as f:
    all_data = f.read()  # Bad!
    rows = list(csv.reader(all_data.split('\n')))
```

### Error Handling Pattern
```python
# ✅ DO: Use appropriate exit codes
except ValueError as err:
    logging.error(str(err))
    sys.exit(1)  # User error
except Exception as err:
    logging.exception("Unhandled error")
    sys.exit(2)  # System error

# ❌ DON'T: Use sys.exit(0) for errors
except Exception as err:
    print(f"Error: {err}")
    sys.exit(0)  # Wrong! Indicates success
```

### Configuration Pattern
```python
# ✅ DO: Validate early
def run(self):
    self.validate_configuration(['api_key', 'endpoint'])
    params = self.configuration.parameters

# ❌ DON'T: Skip validation
def run(self):
    params = self.configuration.parameters  # No validation!
```

### Output Paths Pattern
```python
# ✅ DO: Use correct ComponentBase attributes
def _save_results(self, data: dict):
    # For files (JSON, text, images, etc.)
    output_path = self.files_out_path / "data.json"
    with open(output_path, 'w') as f:
        json.dump(data, f)

    # For CSV tables
    table = self.create_out_table_definition("output.csv")
    with open(table.full_path, 'w') as f:
        writer = csv.writer(f)
        writer.writerows(data)

# ❌ DON'T: Use non-existent data_path_out
def _save_results(self, data: dict):
    output_path = self.data_path_out / "data.json"  # AttributeError!
```

### State Management Pattern
```python
# ✅ DO: Use state for incremental loads
state = self.get_state_file()
last_run = state.get('last_timestamp')
# ... fetch only new data ...
self.write_state_file({'last_timestamp': current_time})

# ❌ DON'T: Forget state management
# Always fetches all data, even for incremental loads
```

### Type Hints Pattern
```python
# ✅ DO: Use proper type hints
from anthropic.types import MessageParam

def create_message(prompt: str) -> MessageParam:
    message: MessageParam = {"role": "user", "content": prompt}
    return message

# ❌ DON'T: Skip type hints
def create_message(prompt):
    return {"role": "user", "content": prompt}
```

### Method Organization Pattern
```python
# ✅ DO: Clear orchestration in run()
def run(self):
    params = self._validate_configuration()
    data = self._fetch_data(params)
    results = self._transform_data(data)
    self._save_results(results)

# ❌ DON'T: Everything in run()
def run(self):
    # 100+ lines of mixed concerns
    # Hard to read, test, maintain
```

## Quick Checklist

Before committing code, verify:

- [ ] All Python files formatted with `ruff format .`
- [ ] All linting issues fixed with `ruff check --fix .`
- [ ] Type hints added to all functions
- [ ] No IDE type warnings (red squiggles)
- [ ] `@staticmethod` added where appropriate
- [ ] `run()` method is clean orchestrator (< 30 lines)
- [ ] Complex logic extracted to private methods
- [ ] CSV processing uses generators
- [ ] Error handling uses proper exit codes
- [ ] Configuration validated early
- [ ] Output paths use `files_out_path` or `tables_out_path` (not `data_path_out`)
- [ ] State management implemented (if incremental)
- [ ] Tests written and passing
- [ ] Documentation updated

## Related Documentation

- [Initialization Guide](initialization-guide.md) - Setting up new components
- [Architecture Guide](architecture.md) - Component structure and patterns
- [Code Quality](code-quality.md) - Ruff, type hints, @staticmethod
- [Workflow Patterns](workflow-patterns.md) - Self-documenting code
