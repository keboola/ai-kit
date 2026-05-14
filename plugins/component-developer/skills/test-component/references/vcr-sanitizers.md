# VCR Sanitizers

`VCR_SANITIZERS` is a module-level list defined in `component.py`. The datadirtest scaffolder picks it up automatically during recording — no other wiring needed.

```python
from keboola.vcr import DefaultSanitizer, ResponseUrlSanitizer, QueryParamSanitizer
```

---

## DefaultSanitizer

Always include this as the first sanitizer. Redacts sensitive fields in URLs, request/response bodies, and headers.

**Redacted by default:** `access_token`, `refresh_token`, `id_token`, `client_id`, `client_secret`, `client_assertion`, `code`, `password`, `token`

**Allowed headers by default:** `content-type`, `content-length`, `accept` (everything else is stripped)

Extend with component-specific field names:

```python
VCR_SANITIZERS = [
    DefaultSanitizer(additional_sensitive_fields=["page_token", "cursor", "session_id"]),
]
```

Check `configuration.py` — any field you'd prefix with `#` in configSchema is a candidate for `additional_sensitive_fields`.

You can also pass `additional_safe_headers` if your component relies on headers that would otherwise be stripped.

---

## ResponseUrlSanitizer

Use when the API returns URLs with dynamic or expiring parameters — CDN links, media URLs, signed download links. Without this, cassette replay fails because response body URLs differ between runs.

```python
VCR_SANITIZERS = [
    DefaultSanitizer(additional_sensitive_fields=["page_token"]),
    ResponseUrlSanitizer(
        dynamic_params=["_nc_gid", "_nc_tpa", "_nc_oc", "_nc_ohc", "oh", "oe"],
        url_domains=["fbcdn.net", "facebook.com", "cdninstagram.com"],
    ),
]
```

Strips `dynamic_params` from any URL in response bodies whose host contains one of `url_domains`.

**When to use:** Social platform APIs (Meta, Instagram), media-heavy APIs, anything returning image/video/file URLs with expiry params.

**How to spot:** After scaffolding, look for long URLs with many query params like `_nc_*`, `oh=`, `oe=` in cassette response bodies.

---

## QueryParamSanitizer

Use when outgoing *requests* contain dynamic query parameters that change between runs — runtime-acquired tokens, pre-signed cloud storage URLs.

Unlike `DefaultSanitizer` (which needs to know the exact secret value), this replaces **any value** of the specified parameter names.

```python
VCR_SANITIZERS = [
    QueryParamSanitizer(
        parameters=["GoogleAccessId", "Expires", "Signature"],
        replacement="REDACTED",
    )
]
```

Default `replacement` is `"token"`, default `parameters` is `["access_token"]`.

**When to use:** Components that upload files or interact with cloud storage (GCS, S3, Azure Blob). Signed URL params (`Signature`, `X-Amz-Signature`, `GoogleAccessId`, `Expires`) change every run.

**How to spot:** Look for request URIs in cassettes with params like `Signature=`, `X-Amz-Signature=`, `GoogleAccessId=`, `Expires=`.

---

## Other available sanitizers

- **`TokenSanitizer(tokens=[...])`** — exact-value replacement across URI, headers, and body. Use when you know the exact token string and want to strip it everywhere.
- **`BodyFieldSanitizer(fields=[...], nested=True)`** — redacts specific field names in JSON request/response bodies. Supports nested traversal.
- **`HeaderSanitizer(additional_safe_headers=[...], headers_to_remove=[...])`** — fine-grained control over header filtering beyond what DefaultSanitizer allows.
- **`UrlPatternSanitizer(patterns=[(regex, replacement), ...])`** — regex-based URL sanitization for custom patterns.
- **`IPv4UrlSanitizer()`** — replaces IPv4 addresses in URLs. Factory function, returns a `UrlPatternSanitizer`.
- **`CallbackSanitizer(before_request=fn, before_response=fn)`** — wraps custom functions for one-off sanitization logic.

---

## When to check for sanitizers

After scaffold, before committing cassettes:

```bash
# Spot dynamic URL params and potential leaks
grep -r "Expires\|Signature\|GoogleAccessId\|X-Amz\|_nc_gid\|page_token" \
  tests/functional/*/source/data/cassettes/requests.json
```

If you find hits, add the appropriate sanitizer(s) to `component.py` and re-scaffold:

```bash
uv run python -m keboola.datadirtest scaffold --secrets secrets.json --regenerate
```

---

## Placement in component.py

Add at module level, after imports, before the component class:

```python
from keboola.component import CommonInterface
from keboola.vcr import DefaultSanitizer, ResponseUrlSanitizer

from client import MyApiClient
from configuration import Configuration

VCR_SANITIZERS = [
    DefaultSanitizer(additional_sensitive_fields=["refresh_token"]),
]


class Component(CommonInterface):
    ...
```
