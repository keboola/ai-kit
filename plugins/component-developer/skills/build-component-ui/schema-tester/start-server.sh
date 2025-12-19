#!/bin/bash
# Start HTTP server for Keboola Schema Tester

cd "$(dirname "$0")/.."
echo "Starting HTTP server from: $(pwd)"
echo "Schema tester URL: http://localhost:8000/schema-tester/"
echo ""
echo "Press Ctrl+C to stop server"
echo ""

python3 -m http.server 8000
