# Code Quality Patterns

Detailed patterns for reviewing Keboola Python components. These supplement the SKILL.md — the main skill has the structure, this has the specifics.

## Architecture

### run() as orchestrator

`run()` should read like a table of contents. Aim for < 30 lines. If it's longer, logic is leaking in that should be in private methods.

Anti-pattern:
```python
def run(self):
    params = self.configuration.parameters
    client = ApiClient(params.get("api_key"))
    results = []
    for page in range(100):  # 80 lines of mixed concerns
        ...
```

Good pattern:
```python
def run(self):
    self._validate_inputs()
    records = self._fetch_all_records()
    self._write_output(records)
```

### __init__ initialization

Initialize clients and config in `__init__`, not `run()`. Sync actions are separate entrypoints — they need `self.client` to already exist.

Anti-pattern: `self.client = ApiClient(...)` anywhere in `run()` or other methods.

Good pattern:
```python
def __init__(self):
    super().__init__()
    params = self.configuration.parameters
    self.config = MyConfig(**params)
    self.client = ApiClient(self.config.api_key, self.config.base_url)
```

### Config-as-model

When multiple config fields are used together, encapsulate them in a Pydantic BaseModel or dataclass. Raw `self.configuration.parameters.get("key")` calls scattered through the code are a red flag.

```python
class ClientConfig(BaseModel):
    base_id: str
    api_token: str = Field(alias="#api_token")
    page_size: int = 100
```

Structuring config this way helps the code, future maintainers, and LLM assistants alike.

## Typing

Modern Python 3.13 syntax only:
- `list[str]` not `List[str]`
- `dict[str, Any]` not `Dict[str, Any]`
- `str | None` not `Optional[str]`
- `collections.abc.Iterator` not `typing.Iterator`

Flag any `from typing import List, Dict, Optional` import as an Important improvement (ruff's `UP` rule will fix it with `--fix`).

Type hints on all public methods. `@staticmethod` when the method doesn't use `self`.

## Safety

### Guard indexing and popping

Any `list[0]`, `dict.pop("key")`, or similar that could raise on empty input needs a precondition check. Use `.pop(key, None)` with a dummy variable when you need to discard:

```python
_ = d.pop("unwanted_key", None)
```

### Pagination

Explicit stopping conditions, not giant safety limits. "Limit to 100k iterations" is hiding a logic problem. If the API returns a `next` cursor, stop when it's absent — respect what the API says.

### API response handling

Respect what the remote API gives — don't silently reinterpret or mutate URLs/cursors from responses.

## Simplifications worth flagging

Only suggest simplifications when they improve clarity and don't change behavior:

- `x or None` instead of `x if x != '' else None`
- `.get(key)` with a single fallback instead of chained `.get()` calls
- `match/case` for multiple conditions (Python 3.10+, check pyproject.toml)

Call these "Nice-to-Have" unless they fix a real bug.

## Repository hygiene

- Dependencies: avoid over-locking. `>=x.y` not `==x.y.z` unless there's a specific reason.
- Python version: should be 3.13 in pyproject.toml and Dockerfile.
- Stray files: question extra pyproject.toml, uv.lock, or local scripts that shouldn't be committed.

## Confidence threshold

Only report issues with confidence ≥ 60:
- 60-75: real quality issue, clearly flag it
- 76-100: architecture violation or blocking issue

When in doubt, skip it or frame it as "I'd personally..." rather than a TODO.
