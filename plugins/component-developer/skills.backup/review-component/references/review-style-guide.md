# Review Style Guide

Guidelines for tone, phrasing, and output format when providing code reviews. The goal is to be direct but kind, giving authors agency to make decisions.

## Overall Tone

Use a constructive, calibrated tone that acknowledges effort and what's already good:

- "This is a great effort, just a couple of sections to clarify"
- "A couple of remarks, but nothing that important"
- "Well, I could imagine improving a couple of sections, but all in all, this is a great effort!"
- "Everything is awesome!"
- "No real problems, just a couple of omissions or strange code constructions"
- "The component.py file is nice and clean"

## Phrasing That Gives Authors Agency

Use characteristic phrasing that empowers authors to make decisions:

- "I'd personally make the client an instance variable"
- "As for me, I'd just use..."
- "Please consider yourself whether you find them worth implementing or not"
- "Feel free to leave it as is"
- "Just one little remark to this..."
- "One more thing to address..."
- "Great catch, just update X as well"
- "A couple of remarks, but nothing blocking"
- "Please reconsider yourself"

## Approval Phrases

For clean code or after fixes are applied:

- "LGTM"
- "Looks good now"
- "Seems OK"
- "Everything seems OK now"
- "Thanks for the changes!"

## Minor Issue Phrases

For non-blocking suggestions:

- "Just a couple of glitches (some of them could be found using Pylance/MyPy/ruff though)"
- "Kindly asking for tiny changes"
- "Consider changing this one little thing..."

## Blocking Issue Phrases

Still kind but clear about severity:

- "Not happy with X; please fix before merging"
- "Please do not resolve my comments without me" (for non-trivial changes that need discussion)

## Emoji Usage

Use emojis sparingly to soften tone. Don't overdo it - a small number of relevant emojis when appropriate to match a friendly style.

## Output Format Structure

### 1. Start with Brief Overall Assessment

Acknowledge effort and what's already good (see "Overall Tone" above).

### 2. Group Findings by Severity

Organize into three clear categories:

**Blocking Issues** (must fix before merge)

**Important Improvements** (strongly recommended)

**Nice-to-Have / Nits**

### 3. Format Each Finding as a Specific TODO

Each issue MUST be formatted as a concrete, actionable TODO with 2-3 sentences. Include:

1. **File path and line number** (e.g., `src/component.py:45`)
2. **The specific pattern or code** that needs to change
3. **What to change it to** with concrete guidance

### Example TODO Format

```
## Blocking Issues

### TODO 1: Move client initialization to __init__
**Location:** `src/component.py:45-52`
**Pattern:** `self.client = ApiClient(...)` is created inside `run()` method.
**Fix:** Move this initialization to `__init__` and store as `self.client`. This allows sync_actions to reuse the client without duplicating logic. The `run()` method should just call `self.client.fetch_data()`.

### TODO 2: Encapsulate configuration in typed object
**Location:** `src/component.py:23-35`
**Pattern:** Multiple `self.configuration.parameters.get("api_key")` calls scattered throughout.
**Fix:** Create a `ClientConfig` dataclass or Pydantic model in `configuration.py` that groups these fields. Initialize it once in `__init__` as `self.config = ClientConfig.from_parameters(params)`.

## Important Improvements

### TODO 3: Use modern typing syntax
**Location:** `src/client.py:12`
**Pattern:** `from typing import List, Dict, Optional`
**Fix:** Remove this import. Use built-in generics: `list[str]` instead of `List[str]`, `dict[str, Any]` instead of `Dict[str, Any]`, `str | None` instead of `Optional[str]`.

## Nice-to-Have

### TODO 4: Organize imports
**Location:** `src/component.py:1-15`
**Pattern:** Imports are not sorted according to ruff conventions.
**Fix:** Run `ruff check --select I --fix src/component.py` to auto-organize imports.
```

## Key Requirements for TODOs

- Be specific about line numbers and the exact code pattern
- Provide the concrete fix, not just "consider changing"
- Reference the relevant guide if applicable (e.g., "See architecture.md section on initialization")
- Keep each TODO to 2-3 sentences max

## Complete Example Review

```
## Overall Assessment

The component.py file is nice and clean, with good separation of concerns. A couple of remarks, but nothing that important.

## Blocking Issues

### TODO 1: Move client initialization to __init__
**Location:** `src/component.py:45-52`
**Pattern:** `self.client = ApiClient(...)` is created inside `run()` method.
**Fix:** Move this initialization to `__init__` and store as `self.client`. This allows sync_actions to reuse the client without duplicating logic.

## Important Improvements

### TODO 2: Use modern typing syntax
**Location:** `src/configuration.py:12`
**Pattern:** `from typing import List, Dict, Optional`
**Fix:** Remove this import. Use built-in generics: `list[str]` instead of `List[str]`, `str | None` instead of `Optional[str]`.

## Nice-to-Have

### TODO 3: Organize imports
**Location:** `src/component.py:1-15`
**Pattern:** Imports are not sorted according to ruff conventions.
**Fix:** Run `ruff check --select I --fix src/component.py` to auto-organize imports.

---
LGTM with the above changes!
```
