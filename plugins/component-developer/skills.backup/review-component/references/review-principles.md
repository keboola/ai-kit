# Review Principles

Detailed principles for reviewing Keboola Python components. These rules are applied by the reviewer agent to ensure code quality, maintainable architecture, and adherence to best practices.

## 1. Architecture and Responsibilities First

Focus first on the design, not nits. Care deeply about "who should own what" in the design.

### Separation of Concerns

- **Component class orchestrates** the work (the `run()` method should be a clear "table of contents")
- **Client classes handle HTTP or external APIs** (separate files for complex integrations)
- **Configuration** (API keys, endpoints, limits, etc.) should be encapsulated in a dedicated config object (e.g., `ApiConfig` in `configuration.py`), not scattered through the code

### Instance Attributes Over Parameter Threading

- Clients and configuration should be stored on `self`, not re-created or threaded through every method
- "I'd personally make the client an instance variable, so it won't be passed to the _fetch_data method either"

### Watch for Anti-Patterns

- Monolithic `run()` methods with 100+ lines of mixed concerns
- Business logic mixed with I/O operations in the same method
- API configuration scattered throughout the codebase instead of encapsulated

## 2. Configuration and Client Initialization

This is critical. Proper initialization patterns are essential.

### Initialize in Constructor, Not in run()

- Load configuration and initialize clients in `__init__`, not in `run()`
- This allows sync_actions and other entrypoints to reuse them without duplicating logic
- "Please take care of any configuration loading and client initialization on the constructor method, not in the run (as there might be other methods than run using these, defined by the action parameter in config.json file)"

### Check For

- Configuration loaded once and encapsulated (e.g., an `ApiConfig` or similar object)
- Clients created once and stored on `self`, not passed around everywhere
- Component's public methods (`run` and any action-specific handlers) rely on pre-initialized `self.config`, `self.client`, etc.
- Single, consistent place for configuration parsing and validation

### Flag These Patterns

- Each method reloads config or creates a new client
- Clients initialized inside `run()` instead of `__init__`
- Configuration values accessed directly from `self.configuration.parameters` throughout the code instead of through a typed config object

## 3. Documentation and Example Consistency

Notice when examples and recommendations don't line up.

### Cross-Check Everything

- If a snippet is presented as an anti-pattern in one place and as a recommended example in another, call that out
- "This code highlighted as an anti-pattern here is exactly the same code we are giving Claude in the architecture.md file as an example"
- "Two code examples directly contradict each other"

### When Fixing One Example, Update Related Ones

- "Please update the PlaywrightClient example too, your proposal looks great and clean"
- When an inconsistency is fixed in one example, suggest scanning and updating similar examples

## 4. Tooling and Workflows

Prefer modern, non-archived tools and realistic commands.

### Use Current Templates

- Recommend `keboola/cookiecutter-python-component` instead of any archived Bitbucket cookiecutters
- "Please do not use the bitbucket archived cookiecutter, use this one: https://github.com/keboola/cookiecutter-python-component"

### Local Development Commands

- Encourage `uv sync` before running components
- Encourage examples like: `KBC_DATADIR=data uv run src/component.py`
- "I'd strongly encourage Claude Code or any other agent to use `uv sync` before running the component"

### When You See Outdated Commands

- Propose precise, updated alternatives
- Don't just flag the issue, provide the correct modern approach

## 5. Pythonic Style and Formatting

Be opinionated but proportionate. Style matters, but it's secondary to architecture and correctness.

### Code Formatting

- Expect examples to be black/ruff-compliant
- "Please make sure all code examples comply with black/ruff formatting (I hate looking at mixed quotes)"
- "My eyes hurt when reading a line mixing single and double quotes"
- Point out obvious violations: mixed quoting style, formatting that wouldn't survive `ruff format`
- Use `ruff check --select I --fix` to organize imports automatically

### Modern Typing (Python 3.9+)

- Always prefer built-in generics (`list[str]`, `dict[str, Any]`) over `typing.List`, `typing.Dict`
- Use `X | None` instead of `typing.Optional[X]`
- Prefer `collections.abc.Iterator`, `Iterable`, etc. over deprecated counterparts in `typing`
- "Please do not use this deprecated class for typing" - flag deprecated typing classes as non-blocking but clear "please fix this"
- Import library-specific types (e.g., `MessageParam` from anthropic)
- Check the project's Python version before suggesting newer syntax (match/case requires 3.10+)

### Pythonic Patterns

- Use `@staticmethod` decorator when method doesn't use `self`
- Proper type hints on all functions and variables
- Clear, self-documenting method names that eliminate need for comments
- Extract logic blocks > 10-15 lines into separate methods

### Run Method as Orchestrator

- Keep `run()` method clean (< 30 lines ideally)
- Should read like a "table of contents" of the component workflow
- Extract complex logic to well-named private methods

## 6. Config as Model / Dataclass Patterns

When multiple related config fields are used together, suggest a dedicated config class.

### When to Suggest Config Classes

- Multiple parameters repeatedly accessed from `self.configuration.parameters`
- Related fields for a client (API keys, endpoints, limits)
- Destination or source configurations with multiple fields

### Example Pattern

```python
class AirtableClientConfiguration(BaseModel):
    base_id: str = Field(alias="base_id", default="")
    api_token: str = Field(alias="#api_token")
    destination: Destination = Field(default_factory=Destination)
```

"Structuring the configuration like this will help you, your future you, your colleagues and your LLM partner to handle the code more efficiently"

## 7. Simplification Without Being Clever

Prefer common, well-understood idioms to bespoke code where they improve readability.

### Common Simplifications

- `x or None` instead of `x if x != '' else None`
- Single `.get()` with `elif` chain instead of multiple `.get()` calls
- Simple `==` instead of membership test with single-item tuple (avoid `"x" in ("x")` pitfall)
- `match/case` for multiple conditions (if Python version supports it)
- `.pop(key, None)` with dummy variable to avoid KeyError: `_ = d.pop("key", None)`

### Before Suggesting Simplification

- Double-check it does not change behavior (truthiness, default values, edge cases)
- Call these out as "Nice-to-have / readability improvements" unless they fix a real bug

## 8. Safety and Robustness

Nudge people to think about edge cases and invariants.

### Guard Against Common Issues

- Verify indexing, popping, and unwrapping operations are guarded by clear preconditions
- "Is the storage_input_tables variable checked before so we know there will be at least one item inside?"
- Use `.pop(key, None)` instead of `.pop(key)` to avoid KeyError

### Pagination and Loop Safety

- Prefer narrow, explicit stopping conditions for loops over giant "safety limits"
- "Limiting max iterations to 100k repetitions seems really excessive" - either it doesn't happen or we should terminate on first invalid response
- Question the last page edge case: "How about cases when the last page has exactly the same size as PAGE_SIZE?"

### API Response Handling

- Respect what the remote API gives us: "I'd just respect what the remote API gives us in the `.paging.next` field, the API knows what it is doing"
- Don't silently change URL parsing or response handling without clear justification

## 9. Reference Architecture

Based on analysis of well-structured Keboola components, here's the typical shape of a clean class:

```python
from __future__ import annotations  # For Python 3.8/3.9 compatibility

class ApiClient:
    """Client for interacting with the API."""

    def __init__(
        self,
        base_url: str,
        api_token: str,
        max_retries: int = 3,
        timeout: float | None = None,
        default_headers: dict[str, str] | None = None,
    ):
        """Initialize client with all configuration in constructor."""
        self.base_url = base_url if base_url.endswith("/") else base_url + "/"
        self._api_token = api_token
        self.max_retries = max_retries
        self.timeout = timeout
        self._default_headers = default_headers or {}

    def _build_url(self, endpoint: str | None = None) -> str:
        """Private helper for URL construction."""
        # Implementation details...

    def _request(self, method: str, endpoint: str, **kwargs) -> Response:
        """Private method handling actual HTTP calls with retries."""
        # Implementation details...

    def get(self, endpoint: str, **kwargs) -> dict:
        """Public method - clean interface for consumers."""
        response = self._request("GET", endpoint, **kwargs)
        return response.json()
```

### Key Patterns

- `from __future__ import annotations` at the top for backward compatibility
- All configuration stored as instance attributes in `__init__`
- Modern typing syntax (`str | None`, `dict[str, str]`)
- Private methods prefixed with `_` for internal logic
- Public methods are thin wrappers with clean interfaces
- Sensible defaults with `or {}` pattern for optional dicts

## 10. Repository Hygiene and Dependencies

### Stray Files

- Flag extra config/lock files whose purpose isn't obvious (e.g., extra `pyproject.toml` or `uv.lock` in root)
- Question local scripts in docs/examples folders that shouldn't be there
- Watch for `.gitignore` patterns that might hide legitimate files

### Dependency Management

- "Please unlock the http client, csvwriter and utils version" - avoid over-locking dependencies
- Call out suspiciously old versions: "Is there a good reason why this particular package is locked here? The 0.3.1 release is almost 2 years old"
- Encourage sensible pinning: pin only what must be pinned

### Python Version

- "How about upgrading to Python 3.12 at least?" - gently suggest upgrades when appropriate
- But respect project constraints: some components still support older Python versions

### Line Endings and Tooling

- Watch for CRLF issues on Windows: "please update your git settings to `git config --global core.autocrlf true`"
- Suggest working in WSL for Windows users to avoid line ending problems
