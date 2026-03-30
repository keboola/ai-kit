# VCR Troubleshooting

## Non-deterministic column ordering

Component uses `set()` for column names, producing different orders between scaffold and replay. Fix: change `set()` to `list()` and re-scaffold.

## "No match for request" during replay

Component is making a request not in the cassette. Re-record, or add a custom matcher if date parameters are dynamic (e.g., `since`/`until` fields that change with wall-clock time — see `test_functional.py` in the project for examples).

## CI shows "Ran 0 tests"

CI uses `python -m unittest discover` which can't find parametrized pytest functions. Change to `python -m pytest` (Step 7 in the setup workflow).

## uv.lock out of date

```bash
uv lock --upgrade-package keboola-datadirtest && uv sync
```

## SOAP/WSDL APIs (Zeep)

The scaffolder's `decode_compressed_response=True` default handles this automatically. Both the WSDL fetch and subsequent SOAP requests are recorded in the cassette. Zeep's XML parser needs raw (uncompressed) XML — the decompression happens automatically during recording.

## Scaffold stops on first error

Processes tests sequentially; stops on the first fatal error (e.g., endpoint doesn't exist). Workaround: put likely-to-fail tests last, or run batches with separate config files.

## Tests pass locally but fail in Docker

Run `docker build && docker run` locally to simulate CI. Common causes:
- `uv.lock` pointing to old version — run `uv lock --upgrade-package keboola-datadirtest`
- Missing `COPY tests/ tests` in Dockerfile
