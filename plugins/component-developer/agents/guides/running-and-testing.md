# Running and Testing Keboola Components

This guide covers all methods for running, testing, and debugging Keboola components locally and in production environments.

## Table of Contents

1. [Component Execution Model](#component-execution-model)
2. [Local Development Setup](#local-development-setup)
3. [Running Components Locally](#running-components-locally)
4. [Testing Strategies](#testing-strategies)
5. [Data Folder Structure](#data-folder-structure)
6. [Docker Execution](#docker-execution)
7. [Debugging Techniques](#debugging-techniques)
8. [Production Deployment](#production-deployment)

---

## Component Execution Model

### How Keboola Executes Components

When a user runs a component in Keboola Connection:

```
User clicks "Run" in UI
    ↓
Keboola creates JOB in queue
    ↓
Job Runner pulls Docker image from ECR
    ↓
Prepares data folder structure:
  - /data/config.json         (user configuration)
  - /data/in/tables/          (input CSV files + manifests)
  - /data/in/files/           (input files)
  - /data/in/state.json       (previous state for incremental)
    ↓
Starts isolated Docker container with mounted /data
    ↓
Component reads from /data, processes, writes to /data/out
    ↓
Keboola imports outputs from /data/out to Storage
    ↓
Job completes (success/error/timeout)
```

### Data Folder Contract

Components communicate with Keboola **exclusively** through the filesystem at `/data`:

**INPUT** (read-only):
- `config.json` - Component configuration from UI
- `in/tables/*.csv` - Input tables with `.manifest` files
- `in/files/*` - Input files
- `in/state.json` - Previous run state (for incremental processing)

**OUTPUT** (write):
- `out/tables/*.csv` - Output tables with `.manifest` files
- `out/files/*` - Output files
- `out/state.json` - New state for next run

---

## Local Development Setup

### 1. Project Structure

```
my-component/
├── src/
│   ├── component.py          # Main logic
│   └── configuration.py      # Config validation
├── data/                     # Local data folder (gitignored)
│   ├── config.json
│   ├── in/
│   └── out/
├── tests/
├── Dockerfile
├── docker-compose.yml
└── pyproject.toml
```

### 2. Create Data Folder Structure

```bash
# Create required directories
mkdir -p data/in/tables data/in/files data/out/tables data/out/files

# Gitignore data folder (except structure)
cat > data/.gitignore <<EOF
*
!.gitignore
EOF
```

### 3. Prepare Configuration

Create `data/config.json` with your component's parameters:

```json
{
  "parameters": {
    "api_key": "your_key_here",
    "#password": "encrypted_password",
    "from_date": "2024-01-01",
    "tables": ["users", "orders"],
    "incremental": false,
    "debug": true
  }
}
```

**Note**: Parameters starting with `#` are encrypted in Keboola but work as plain text locally.

---

## Running Components Locally

### Method 1: Direct Python Execution (Fastest for Development)

```bash
# Set up virtual environment
python -m venv .venv
source .venv/bin/activate  # or `.venv\Scripts\activate` on Windows
pip install -e .

# Set data directory environment variable
export KBC_DATADIR=./data

# Run component
python src/component.py
```

**Pros**: Fast iteration, easy debugging with IDE
**Cons**: Requires local Python environment, may behave differently than Docker

### Method 2: Docker Compose (Recommended)

Add `docker-compose.yml`:

```yaml
services:
  dev:
    build: .
    volumes:
      - ./:/code
      - ./data:/data
    environment:
      - KBC_DATADIR=/data
    command: python -u src/component.py

  test:
    build: .
    volumes:
      - ./:/code
    command: /bin/sh /code/scripts/build_n_test.sh
```

Run:

```bash
# Build and run component
docker-compose run --rm dev

# Run tests
docker-compose run --rm test
```

**Pros**: Matches production environment, isolated
**Cons**: Slower rebuild times

### Method 3: Docker CLI (Production-like)

```bash
# Build image
docker build -t my-component:latest .

# Run with mounted data folder
docker run --rm \
  -v $(pwd)/data:/data \
  -e KBC_DATADIR=/data \
  my-component:latest
```

### Method 4: Using Keboola CLI (Official Tool)

```bash
# Install Keboola CLI
curl -L https://cli.keboola.com/install.sh | bash

# Initialize component
kbc init my-component

# Run locally
kbc run

# Test configuration
kbc validate config.json
```

---

## Testing Strategies

### 1. Unit Tests

Test individual functions in isolation:

```python
# tests/test_configuration.py
import unittest
from src.configuration import Configuration

class TestConfiguration(unittest.TestCase):
    def test_valid_config(self):
        config = Configuration(
            api_key="test_key",
            from_date="2024-01-01"
        )
        self.assertEqual(config.api_key, "test_key")

    def test_date_parsing(self):
        config = Configuration(from_date="-7")
        self.assertTrue(config.get_date_from() < datetime.now())
```

Run tests:

```bash
# Using unittest
python -m unittest discover -s tests

# Using pytest
pytest tests/ -v

# With coverage
pytest --cov=src tests/
```

### 2. Integration Tests

Test complete component execution with sample data:

```python
# tests/test_integration.py
import os
import tempfile
from pathlib import Path
from src.component import Component

class TestIntegration(unittest.TestCase):
    def setUp(self):
        # Create temporary data folder
        self.temp_dir = tempfile.mkdtemp()
        os.environ['KBC_DATADIR'] = self.temp_dir

        # Create config
        config_path = Path(self.temp_dir) / 'config.json'
        config_path.write_text(json.dumps({
            "parameters": {"api_key": "test_key"}
        }))

    def test_full_extraction(self):
        component = Component()
        component.run()

        # Verify output files exist
        output_file = Path(self.temp_dir) / 'out' / 'tables' / 'users.csv'
        self.assertTrue(output_file.exists())
```

### 3. Docker Testing

Test with actual Docker container:

```bash
# Create test script
cat > scripts/build_n_test.sh <<'EOF'
#!/bin/sh
set -e

# Run code quality checks
flake8 --config=flake8.cfg src/
ruff check src/

# Run unit tests
python -m unittest discover -s tests

# Run integration tests
pytest tests/integration/ -v

echo "✅ All tests passed!"
EOF

chmod +x scripts/build_n_test.sh

# Run in Docker
docker-compose run --rm test
```

### 4. End-to-End Testing with Sample Data

```bash
# Prepare sample data
mkdir -p data/in/tables
cat > data/in/tables/input.csv <<EOF
id,name,email
1,John Doe,john@example.com
2,Jane Smith,jane@example.com
EOF

# Create manifest
cat > data/in/tables/input.csv.manifest <<EOF
{
  "columns": ["id", "name", "email"],
  "primary_key": ["id"]
}
EOF

# Run component
export KBC_DATADIR=./data
python src/component.py

# Verify output
cat data/out/tables/output.csv
cat data/out/tables/output.csv.manifest
```

---

## Data Folder Structure

### Complete Example

```
data/
├── config.json                    # Component configuration
├── in/
│   ├── state.json                 # Previous state (for incremental)
│   ├── tables/
│   │   ├── users.csv              # Input table data
│   │   └── users.csv.manifest     # Input table metadata
│   └── files/
│       └── import.xml             # Input file
└── out/
    ├── state.json                 # New state to save
    ├── tables/
    │   ├── output.csv             # Output table data
    │   └── output.csv.manifest    # Output table metadata
    └── files/
        └── report.pdf             # Output file
```

### config.json Structure

```json
{
  "parameters": {
    "api_key": "abc123",
    "#password": "secret",
    "tables": ["users", "orders"],
    "incremental": true
  },
  "image_parameters": {
    "custom_field": "value"
  },
  "authorization": {
    "oauth_api": {
      "id": "12345",
      "credentials": {
        "access_token": "token123"
      }
    }
  },
  "action": "run"
}
```

### Table Manifest Format

**Output manifest** (`out/tables/users.csv.manifest`):

```json
{
  "columns": ["id", "name", "email", "created_at"],
  "primary_key": ["id"],
  "incremental": true,
  "delimiter": ",",
  "enclosure": "\""
}
```

### State File Format

**For incremental loading** (`out/state.json`):

```json
{
  "lastRunTimestamp": "2024-11-28T15:00:00+00:00",
  "lastProcessedId": "12345",
  "component_state": {
    "users_table": {
      "last_sync": "2024-11-28"
    }
  }
}
```

---

## Docker Execution

### Dockerfile Best Practices

```dockerfile
FROM python:3.13-slim

# Copy uv for fast dependency installation
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /code/

# Install dependencies first (better caching)
COPY pyproject.toml uv.lock ./
ENV UV_PROJECT_ENVIRONMENT="/usr/local/"
RUN uv sync --frozen

# Copy source code
COPY src/ src/
COPY tests/ tests/

# Set entrypoint
CMD ["python", "-u", "src/component.py"]
```

### Build and Tag

```bash
# Build with version tag
docker build -t keboola/my-component:1.0.0 .
docker build -t keboola/my-component:latest .

# Multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t my-component .
```

### Test Docker Image

```bash
# Run with test data
docker run --rm \
  -v $(pwd)/data:/data \
  -e KBC_DATADIR=/data \
  -e KBC_PROJECTID=12345 \
  -e KBC_STACKID=connection.keboola.com \
  my-component:latest

# Interactive debugging
docker run --rm -it \
  -v $(pwd)/data:/data \
  -e KBC_DATADIR=/data \
  --entrypoint /bin/bash \
  my-component:latest
```

---

## Debugging Techniques

### 1. Enable Debug Logging

```python
# src/component.py
import logging

class Component(ComponentBase):
    def __init__(self):
        super().__init__()
        if self.configuration.parameters.get('debug', False):
            logging.getLogger().setLevel(logging.DEBUG)

    def run(self):
        logging.info("Starting extraction")
        logging.debug(f"Config: {self.configuration.parameters}")
```

### 2. Interactive Debugging with IDE

**VS Code** (`launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Component",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/src/component.py",
      "env": {
        "KBC_DATADIR": "${workspaceFolder}/data"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

**PyCharm**:
1. Right-click `src/component.py` → Debug
2. Add environment variable: `KBC_DATADIR=./data`

### 3. Docker Debugging

```bash
# Run with live code reload
docker run --rm -it \
  -v $(pwd):/code \
  -v $(pwd)/data:/data \
  -e KBC_DATADIR=/data \
  --entrypoint python \
  my-component:latest -u src/component.py

# Attach to running container
docker ps  # Get container ID
docker exec -it <container_id> /bin/bash
```

### 4. Remote Debugging in Docker

```python
# Add to component.py for remote debugging
import debugpy
if os.getenv('DEBUG_ENABLED'):
    debugpy.listen(("0.0.0.0", 5678))
    debugpy.wait_for_client()
```

```bash
# Run with debug port exposed
docker run --rm \
  -p 5678:5678 \
  -v $(pwd)/data:/data \
  -e KBC_DATADIR=/data \
  -e DEBUG_ENABLED=1 \
  my-component:latest
```

### 5. Logging Best Practices

```python
# Log important events
logging.info(f"Processing table {table_name}")
logging.info(f"Extracted {len(data)} rows")

# Log errors with context
try:
    result = api.fetch_data()
except Exception as e:
    logging.error(f"Failed to fetch data: {e}", exc_info=True)
    raise UserException(f"API request failed: {e}")

# Debug verbose information
logging.debug(f"API response: {response.text[:500]}")
```

---

## Production Deployment

### 1. Deployment Workflow

```bash
# 1. Build and test locally
docker build -t my-component:1.0.0 .
docker-compose run --rm test

# 2. Push to Keboola ECR (via deploy script)
./deploy.sh

# 3. Update version in Developer Portal
# This is done automatically by deploy.sh
```

### 2. Deploy Script Example

```bash
#!/bin/sh
# deploy.sh
set -e

# Get version tag
TAG=${GITHUB_TAG:-$TRAVIS_TAG}
echo "Deploying version: $TAG"

# Get ECR repository
REPOSITORY=$(docker run --rm \
  -e KBC_DEVELOPERPORTAL_USERNAME \
  -e KBC_DEVELOPERPORTAL_PASSWORD \
  quay.io/keboola/developer-portal-cli-v2:latest \
  ecr:get-repository ${VENDOR} ${APP})

# Login to ECR
eval $(docker run --rm \
  -e KBC_DEVELOPERPORTAL_USERNAME \
  -e KBC_DEVELOPERPORTAL_PASSWORD \
  quay.io/keboola/developer-portal-cli-v2:latest \
  ecr:get-login ${VENDOR} ${APP})

# Push image
docker tag my-component:latest ${REPOSITORY}:${TAG}
docker push ${REPOSITORY}:${TAG}

# Update Developer Portal
docker run --rm \
  -e KBC_DEVELOPERPORTAL_USERNAME \
  -e KBC_DEVELOPERPORTAL_PASSWORD \
  quay.io/keboola/developer-portal-cli-v2:latest \
  update-app-repository ${VENDOR} ${APP} ${TAG} ecr ${REPOSITORY}
```

### 3. CI/CD with GitHub Actions

```yaml
# .github/workflows/push.yml
name: Build and Deploy

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t my-component:${{ github.ref_name }} .

      - name: Run tests
        run: docker-compose run --rm test

      - name: Deploy to Keboola
        env:
          KBC_DEVELOPERPORTAL_USERNAME: ${{ secrets.KBC_USERNAME }}
          KBC_DEVELOPERPORTAL_PASSWORD: ${{ secrets.KBC_PASSWORD }}
        run: ./deploy.sh
```

### 4. Version Management

Follow semantic versioning:

- **v1.0.0** - Major release (breaking changes)
- **v1.1.0** - Minor release (new features)
- **v1.0.1** - Patch release (bug fixes)

```bash
# Tag and push
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

---

## Troubleshooting Common Issues

### Issue: Component runs locally but fails in Keboola

**Causes**:
- Path issues (absolute vs relative)
- Environment variables missing
- Different Python/package versions

**Solution**:
```bash
# Test with exact Keboola environment
docker run --rm \
  -v $(pwd)/data:/data \
  -e KBC_DATADIR=/data \
  -e KBC_PROJECTID=12345 \
  my-component:latest
```

### Issue: "No such file or directory" errors

**Solution**: Always use `Path` from `pathlib`:

```python
from pathlib import Path

# Wrong
with open('data/config.json') as f:

# Correct
config_path = Path(os.getenv('KBC_DATADIR', './data')) / 'config.json'
with open(config_path) as f:
```

### Issue: Memory errors with large datasets

**Solution**: Process in chunks:

```python
# Don't load entire file into memory
for chunk in pd.read_csv(input_file, chunksize=10000):
    process_chunk(chunk)
    chunk.to_csv(output_file, mode='a', header=False, index=False)
```

### Issue: Timeout in Keboola

**Solution**:
- Optimize data processing
- Add progress logging
- Request timeout extension in Developer Portal

---

## Quick Reference

### Environment Variables

```bash
KBC_DATADIR        # Path to data folder (required)
KBC_PROJECTID      # Keboola project ID
KBC_STACKID        # Keboola stack (e.g., connection.keboola.com)
KBC_CONFIGID       # Configuration ID
KBC_RUNID          # Job run ID
```

### Common Commands

```bash
# Local development
export KBC_DATADIR=./data
python src/component.py

# Docker
docker-compose run --rm dev
docker-compose run --rm test

# Testing
python -m unittest discover -s tests
pytest tests/ -v --cov=src

# Build & Deploy
docker build -t my-component .
./deploy.sh
```

---

## Additional Resources

- [Keboola Component Specification](https://developers.keboola.com/extend/component/)
- [Python Component Template](https://github.com/keboola/python-component-template)
- [Developer Portal Documentation](https://developers.keboola.com/extend/developer-portal/)
- [Common Interface Specification](https://developers.keboola.com/extend/common-interface/)

---

**Last Updated**: 2024-11-28
