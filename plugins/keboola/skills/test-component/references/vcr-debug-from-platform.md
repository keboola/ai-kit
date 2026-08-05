# Debugging with Platform Output

Two workflows for testing from real Keboola platform runs — no live API needed.

---

## Quick Local Debug from stage_output.zip

When given a `stage_output.zip` from a Keboola debug job, run the component against the cassette directly — no datadirtest setup required.

`ComponentBase.execute_action()` auto-detects `{KBC_DATADIR}/cassettes/requests.json` and switches to VCR replay mode automatically.

```bash
# 1. Unzip into data/
unzip path/to/40176890.stage_output.zip -d data/

# 2. Move the cassette to the expected location
mkdir -p data/cassettes
mv data/out/files/vcr_debug_*.json data/cassettes/requests.json

# 3. Fix [hidden] in config.json
python3 - <<'EOF'
import re, json

with open("data/config.json") as f:
    content = f.read()

content = re.sub(r'(?<!")\[hidden\](?!")', '"FAKE_REDACTED_VALUE"', content)
config = json.loads(content)
config["authorization"]["oauth_api"]["credentials"]["#data"] = \
    '{"access_token": "FAKE_ACCESS_TOKEN_FOR_VCR_REPLAY"}'

with open("data/config.json", "w") as f:
    json.dump(config, f, indent=2)
print("config.json fixed")
EOF

# 4. Run — auto-detects the cassette and replays
KBC_DATADIR=$(pwd)/data uv run python src/component.py
```

Output tables are written to `data/out/tables/` as usual. Time is frozen automatically to the cassette's `_metadata.freeze_time`.

> `data/` is gitignored — this is local debugging only. Use the workflow below to create a permanent regression test.

---

## Permanent Test from Platform Debug Job Output

When a user reports a bug from a real production run, create a permanent regression test from the debug job output — no live API access needed.

### Prerequisites

The component must use `VCRRecorder.record_debug_run()` in `component.py`. This causes the component to write a VCR cassette to `out/files/vcr_debug_*.json` when run as a debug job. If missing, add it first.

### What's in the stage_output.zip

```
config.json                        ← Job config (may have [hidden] placeholders)
out/
  tables/
    accounts.csv                   ← Output tables and manifests
    accounts.csv.manifest
  files/
    vcr_debug_{component}_{id}_{timestamp}.json   ← THE VCR CASSETTE
in/
  state.json
```

### Step 1: Choose a test name

Use `{component_type}_{description}` in snake_case, e.g. `facebook_pages_keboola_accounts`.

### Step 2: Create the directory structure

```bash
mkdir -p tests/functional/{TEST_NAME}/source/data/cassettes
mkdir -p tests/functional/{TEST_NAME}/expected/data/out/tables
```

### Step 3: Extract and fix config.json

```python
import re, json, zipfile

with zipfile.ZipFile("path/to/stage_output.zip") as z:
    content = z.read("config.json").decode()

# Fix bare [hidden] values (not quoted in JSON) → valid JSON string
content = re.sub(r'(?<!")\[hidden\](?!")', '"FAKE_REDACTED_VALUE"', content)
config = json.loads(content)

# OAuth components: #data must be a JSON-encoded string
config["authorization"]["oauth_api"]["credentials"]["#data"] = \
    '{"access_token": "FAKE_ACCESS_TOKEN_FOR_VCR_REPLAY"}'

# Set explicit bucket-id to match expected manifest destinations.
# Without this, the component generates a timestamp-based bucket name locally
# that won't match the expected manifests from the platform.
# Read the correct bucket from any manifest file: "destination" field = "in.c-{bucket}.{table}"
config["parameters"]["bucket-id"] = "in.c-{component-id-dashes}-{config-id}"

with open(f"tests/functional/{TEST_NAME}/source/data/config.json", "w") as f:
    json.dump(config, f, indent=2)
```

**Note on `[hidden]` fields:** Only `#data` is typically bare unquoted `[hidden]`. Fields like `#appSecret` are already quoted strings — leave them as-is (they won't be used during VCR replay).

### Step 4: Copy the VCR cassette

```python
import zipfile

with zipfile.ZipFile("path/to/stage_output.zip") as z:
    vcr_files = [n for n in z.namelist() if "vcr_debug" in n]
    with z.open(vcr_files[0]) as src:
        with open(f"tests/functional/{TEST_NAME}/source/data/cassettes/requests.json", "wb") as dst:
            dst.write(src.read())
```

### Step 5: Extract expected outputs

```python
import zipfile, os

with zipfile.ZipFile("path/to/stage_output.zip") as z:
    for name in z.namelist():
        if name.startswith("out/tables/") and not name.endswith("/"):
            filename = os.path.basename(name)
            dest = f"tests/functional/{TEST_NAME}/expected/data/out/tables/{filename}"
            with z.open(name) as src, open(dest, "wb") as dst:
                dst.write(src.read())
```

### Step 6: Update tests/setup/configs.json

Add the new test to `tests/setup/configs.json` (create if it doesn't exist). Use dummy credentials — real ones go in `secrets.json`. Remove `bucket-id` from parameters (it's VCR-test-specific).

```json
[
  {
    "name": "facebook_pages_keboola_accounts",
    "config": {
      "parameters": { "...": "full parameters block without bucket-id" },
      "authorization": {
        "oauth_api": {
          "credentials": {
            "#data": "{\"access_token\": \"DUMMY_ACCESS_TOKEN\"}",
            "appKey": "178012768920721",
            "#appSecret": "DUMMY_APP_SECRET"
          }
        }
      }
    }
  }
]
```

### Step 7: Run the test

```bash
uv run pytest tests/test_functional.py -k "{TEST_NAME}" -v
```

---

## Troubleshooting Debug-Job Tests

**Bucket name mismatch in manifests** — most common failure. Add `bucket-id` to `config["parameters"]` as in Step 3. Read the correct value from any `.manifest` file's `"destination"` field.

**`[hidden]` JSON parse error** — `config.json` has `"#data": [hidden]` (unquoted). Use `re.sub(r'(?<!")\[hidden\](?!")', '"FAKE"', content)` before parsing.

**"No match for request" during replay** — the component is making a request not in the cassette. May need a custom matcher if date-range parameters are dynamic. See `test_functional.py` in the project for examples with `since`/`until` parameters.

**Some queries missing from expected output** — expected when some API calls returned 4xx during the original job. The component logs errors and continues; the cassette replays them.
