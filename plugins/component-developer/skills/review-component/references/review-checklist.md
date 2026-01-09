# Review Checklist

Quick reference checklist for reviewing Keboola Python components. Use this to systematically verify code quality.

## Architecture

- [ ] Configuration and clients initialized in `__init__`, not `run()`
- [ ] `run()` method is clean orchestrator (< 30 lines)
- [ ] Complex logic extracted to private methods
- [ ] Clients stored as instance attributes (`self.client`)
- [ ] Configuration encapsulated in typed config object (Pydantic BaseModel or dataclass)

## Code Quality

- [ ] All Python files formatted with `ruff format .`
- [ ] Imports organized with `ruff check --select I --fix`
- [ ] Type hints on all functions using modern syntax (`list[str]`, not `List[str]`)
- [ ] No deprecated typing classes (`typing.List`, `typing.Dict`, `typing.Optional`)
- [ ] `@staticmethod` added where appropriate
- [ ] CSV processing uses generators for memory efficiency
- [ ] Error handling uses proper exit codes (1 for user, 2 for system)

## Safety

- [ ] Indexing/popping operations guarded by preconditions
- [ ] Pagination has explicit stopping conditions (not giant safety limits)
- [ ] API response handling respects what the remote API provides

## Tooling

- [ ] Examples use `uv sync` and `KBC_DATADIR=data uv run src/component.py`
- [ ] Using `keboola/cookiecutter-python-component` (not archived templates)
- [ ] Dependencies not over-locked; old versions questioned

## Documentation

- [ ] No contradictions between documentation and code examples
- [ ] Redundant comments removed; confusing conditions have clarifying comments
- [ ] No typos or misleading variable names

## Severity Guidelines

### Blocking Issues (must fix before merge)

- Architecture/ownership violations (config/client patterns, contradictions with guides)
- Contradictory or misleading examples
- Initialization done in `run()` instead of `__init__`
- Changes that alter data selection, pagination behavior, or error handling in ways that likely change component output

### Important Improvements (strongly recommended)

- Moving config/client initialization to `__init__`
- Using proper config/client classes
- Up-to-date tooling/commands
- Missing type hints on public methods
- Deprecated typing classes (`typing.List`, `typing.Dict`, `typing.Optional`)

### Nice-to-Have / Nits

- Quote style consistency
- Minor formatting tweaks
- Tiny readability improvements
- Typos and grammar fixes
- Import organization

## Confidence Scoring

Rate each potential issue on a scale from 0-100:

- **0-25**: Low confidence. Might be a false positive or stylistic preference not explicitly in guidelines.
- **26-50**: Moderate confidence. Real issue but might be a nitpick.
- **51-75**: High confidence. Verified issue that impacts code quality or contradicts guidelines.
- **76-100**: Critical. Architecture violation, contradictory examples, or blocking issue.

**Only report issues with confidence ≥ 60.** Focus on issues that truly matter.
