# Code Quality & Formatting

Complete guide for code quality standards in Keboola Python components.

## Using Ruff for Code Formatting

All Keboola components should use **Ruff** as the standard code formatter and linter. Ruff is included in the cookiecutter template by default.

### Basic Usage

**After writing or modifying code, always run:**

```bash
# Format code with ruff
ruff format .

# Check and fix linting issues
ruff check --fix .
```

### Ruff Configuration

Configuration is included in `pyproject.toml`:

```toml
[tool.ruff]
line-length = 120
target-version = "py313"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP"]
ignore = []
```

### Key Benefits

- Consistent code style across all components
- Automatic import sorting
- Catches common errors before runtime
- 10-100x faster than flake8 + black + isort combined

### Integration with CI/CD

The cookiecutter template includes ruff checks in the CI/CD pipeline. Code must pass ruff formatting and linting before deployment.

### Your Workflow

1. Write/modify code
2. Run `ruff format .` to format
3. Run `ruff check --fix .` to lint
4. Test your changes
5. Commit formatted code

**IMPORTANT**: Always format code with ruff before creating commits or pull requests. Unformatted code will fail CI/CD checks.

## Type Hints and Type Safety

All Keboola components should use **proper type hints** to catch errors early and improve IDE support.

### Critical Type Safety Rules

#### 1. Import Correct Types from Libraries

```python
# ✅ CORRECT - Import proper types (Python 3.9+)
from anthropic.types import MessageParam
from keboola.component.dao import ColumnDefinition, BaseType
from typing import Any  # Only import what's not available as built-in

# ✅ Use proper type annotations with built-in generics
user_message: MessageParam = {
    "role": "user",
    "content": "Your message here"
}

messages: list[MessageParam] = [user_message]
```

#### 2. Always Annotate Function Parameters and Return Types

```python
# ✅ CORRECT - Properly typed function (Python 3.9+ built-in generics)
def process_data(
    input_file: Path,
    config: dict[str, Any]
) -> list[dict[str, str]]:
    """Process input file and return structured data."""
    results: list[dict[str, str]] = []
    # ... implementation
    return results

# ❌ WRONG - No type hints
def process_data(input_file, config):
    results = []
    return results
```

#### 3. Use Library-Provided Types Instead of Generic Dicts

```python
# ✅ CORRECT - Using MessageParam type
from anthropic.types import MessageParam

def create_message(prompt: str) -> MessageParam:
    message: MessageParam = {
        "role": "user",
        "content": prompt
    }
    return message

# ❌ WRONG - Plain dict without type annotation
def create_message(prompt):
    return {"role": "user", "content": prompt}
```

### Common IDE Warnings and Fixes

#### Warning: Type Mismatch

**Problem:**
```
Expected type 'Iterable[MessageParam]', got 'list[dict[str, str]]' instead
```

**Solution:**
```python
# ❌ WRONG - IDE warning about type mismatch
messages = [{"role": "user", "content": "hello"}]
client.messages.create(messages=messages)

# ✅ CORRECT - Explicit type annotation
user_msg: MessageParam = {"role": "user", "content": "hello"}
messages: list[MessageParam] = [user_msg]
client.messages.create(messages=messages)
```

### Optional Type Checking with mypy

Add to development workflow:

```bash
# Install mypy
pip install mypy

# Run type checking
mypy src/ --ignore-missing-imports
```

Add to `pyproject.toml`:
```toml
[tool.mypy]
python_version = "3.13"
warn_return_any = true
warn_unused_configs = true
ignore_missing_imports = true
```

### Type Hints Best Practices (Python 3.9+)

- ✅ Import types from source libraries (e.g., `anthropic.types`, `keboola.component.dao`)
- ✅ Annotate all function signatures
- ✅ Use `T | None` for nullable values (not `Optional[T]`)
- ✅ Use built-in generics: `list[T]`, `dict[K, V]` (not `List[T]`, `Dict[K, V]`)
- ✅ Define types for API request/response objects
- ❌ Don't use deprecated `typing.List`, `typing.Dict`, `typing.Optional`
- ❌ Don't ignore type errors without understanding them
- ❌ Don't use `Any` everywhere (defeats the purpose)

## Using @staticmethod Decorator

When IDE warns: `Method '_save_recommendations' may be 'static'`

### When to Use @staticmethod

```python
# ❌ WRONG - Method doesn't use self but not marked static
class Component:
    def _save_recommendations(self, data: dict[str, Any], path: Path):
        """Save recommendations - doesn't use self!"""
        with open(path, "w") as f:
            json.dump(data, f)

# ✅ CORRECT - Mark as @staticmethod
class Component:
    @staticmethod
    def _save_recommendations(data: dict[str, Any], path: Path):
        """Save recommendations."""
        with open(path, "w") as f:
            json.dump(data, f)
```

### When to Use @staticmethod

Use `@staticmethod` when:
- Method doesn't access `self` or `cls`
- Method is a utility function that belongs to the class conceptually
- IDE shows "Method may be 'static'" warning

### When NOT to Use @staticmethod

Don't use `@staticmethod` when:
- Method needs access to instance attributes (`self.something`)
- Method needs to call other instance methods
- Method modifies instance state

## Complete Code Quality Workflow

After implementing any Python code:

1. **Add proper type hints** to all functions and variables
2. **Check IDE for type warnings** (red squiggles) and fix them
3. **Import library-specific types** where needed (e.g., `MessageParam`)
4. **Add `@staticmethod` decorator** for methods that don't use `self`
5. Run `ruff format .` to ensure consistent formatting
6. Run `ruff check --fix .` to catch and fix linting issues
7. Optionally run `mypy src/` for additional type checking
8. Review the changes to ensure quality
9. Test the component functionality

## Critical Reminders

**CRITICAL**: Always check IDE warnings and fix them before committing:
- Type warnings often indicate real bugs
- "May be static" warnings improve code clarity and testability
- Unformatted code will fail CI/CD checks

## Related Documentation

- [Architecture Guide](architecture.md)
- [Workflow Patterns](workflow-patterns.md)
- [Best Practices](best-practices.md)
