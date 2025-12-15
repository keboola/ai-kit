#!/usr/bin/env python3
"""
Keboola Component Schema Tester
================================

A unified Flask-based testing server for Keboola component schemas.

Features:
- Auto-discovers component_config/ folder and schemas
- Loads existing config.json and pre-fills forms
- Serves embedded HTML schema tester UI
- Handles all sync actions with automatic component integration
- Flexible component path configuration

Usage:
    # Auto-discovery (searches for component_config/ in current or parent dirs)
    python component_schema_tester.py

    # Specify component path
    python component_schema_tester.py /path/to/component

    # Specify component_config path directly
    python component_schema_tester.py /path/to/component_config

    Then open: http://localhost:8000
"""

import os
import sys
import json
import argparse
from pathlib import Path
from flask import Flask, jsonify, request, Response
from flask_cors import CORS

# ============================================================================
# AUTO-DISCOVERY FUNCTIONS
# ============================================================================

def find_project_root(start_path=None):
    """
    Find project root by looking for component_config/ folder.

    Searches upward from the start path (or script location) until it finds
    a directory containing a component_config/ folder.

    Args:
        start_path (str): Optional starting path for search

    Returns:
        str: Path to project root, or None if not found
    """
    if start_path:
        current = os.path.abspath(start_path)
    else:
        current = os.path.dirname(os.path.abspath(__file__))

    max_depth = 10  # Prevent infinite loops
    depth = 0

    while current != '/' and depth < max_depth:
        if os.path.exists(os.path.join(current, 'component_config')):
            return current
        current = os.path.dirname(current)
        depth += 1

    return None


def resolve_component_path(path_arg):
    """
    Resolve component path from command-line argument.

    Handles three cases:
    1. Path to component_config/ folder -> returns parent directory
    2. Path to component root (contains component_config/) -> returns as-is
    3. Invalid path -> returns None

    Args:
        path_arg (str): Path argument from command line

    Returns:
        str: Resolved project root path, or None if invalid
    """
    if not path_arg:
        return None

    abs_path = os.path.abspath(path_arg)

    # Case 1: Path is component_config folder itself
    if os.path.basename(abs_path) == 'component_config' and os.path.isdir(abs_path):
        return os.path.dirname(abs_path)

    # Case 2: Path contains component_config folder
    if os.path.exists(os.path.join(abs_path, 'component_config')):
        return abs_path

    # Case 3: Try to find component_config in parent directories
    return find_project_root(abs_path)


def find_component_config(project_root):
    """
    Return path to component_config folder.

    Args:
        project_root (str): Path to project root

    Returns:
        str: Path to component_config directory
    """
    return os.path.join(project_root, 'component_config')


def find_config_json(project_root):
    """
    Return path to data/config.json if exists, else None.

    Args:
        project_root (str): Path to project root

    Returns:
        str: Path to config.json if it exists, None otherwise
    """
    path = os.path.join(project_root, 'data', 'config.json')
    return path if os.path.exists(path) else None


def write_config(project_root, parameters):
    """
    Write configuration to data/config.json for component sync actions.

    Args:
        project_root (str): Path to project root
        parameters (dict): Configuration parameters to write
    """
    data_dir = os.path.join(project_root, 'data')
    os.makedirs(data_dir, exist_ok=True)

    config_path = os.path.join(data_dir, 'config.json')
    config = {
        'parameters': parameters
    }

    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)


# ============================================================================
# FLASK APP SETUP
# ============================================================================

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global variables set during initialization
project_root = None
component_config_path = None
config_json_path = None

# Global variables for browser-uploaded schemas
loaded_component_schema = None
loaded_row_schema = None
loaded_component_name = None


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/')
def index():
    """Serve the embedded HTML schema tester."""
    return Response(HTML_CONTENT, mimetype='text/html')


@app.route('/api/discovery-info', methods=['GET'])
def get_discovery_info():
    """
    Return auto-discovered paths for manual input pre-fill.

    Returns:
        JSON response with componentConfig and configJson paths
    """
    return jsonify({
        'componentConfig': component_config_path if component_config_path else None,
        'configJson': config_json_path if config_json_path else None
    })


@app.route('/api/load-schemas', methods=['POST'])
def load_schemas():
    """
    Load schemas uploaded from browser.

    Request JSON:
        {
            "componentSchema": {...},
            "rowSchema": {...},
            "componentName": "component-name"
        }

    Returns:
        JSON response with success status
    """
    global loaded_component_schema, loaded_row_schema, loaded_component_name

    try:
        data = request.json
        loaded_component_schema = data.get('componentSchema')
        loaded_row_schema = data.get('rowSchema')
        loaded_component_name = data.get('componentName', 'Unknown')

        if not loaded_component_schema or not loaded_row_schema:
            return jsonify({'error': 'Missing componentSchema or rowSchema'}), 400

        return jsonify({
            'status': 'success',
            'message': f'Schemas loaded for {loaded_component_name}'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/schemas', methods=['GET'])
def get_schemas():
    """
    Return both component and row schemas.

    Priority:
    1. Return loaded schemas from browser (if available)
    2. Fall back to schemas from disk (auto-discovered or manual path)

    Query Parameters:
        path: Optional manual path to component_config folder

    Returns:
        JSON response with componentSchema and rowSchema objects
    """
    global loaded_component_schema, loaded_row_schema

    try:
        # Priority 1: Return browser-uploaded schemas if available
        if loaded_component_schema and loaded_row_schema:
            return jsonify({
                'componentSchema': loaded_component_schema,
                'rowSchema': loaded_row_schema
            })

        # Priority 2: Load from disk (auto-discovered or manual path)
        manual_path = request.args.get('path')
        config_path = manual_path if manual_path else component_config_path

        if not config_path or not os.path.exists(config_path):
            return jsonify({'error': f'Component config folder not found: {config_path}'}), 404

        config_schema_path = os.path.join(config_path, 'configSchema.json')
        row_schema_path = os.path.join(config_path, 'configRowSchema.json')

        with open(config_schema_path) as f:
            component_schema = json.load(f)

        with open(row_schema_path) as f:
            row_schema = json.load(f)

        return jsonify({
            'componentSchema': component_schema,
            'rowSchema': row_schema
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/config', methods=['GET'])
def get_config():
    """
    Return config.json parameters if exists.

    Query Parameters:
        path: Optional manual path to config.json file

    Returns:
        JSON response with parameters object (empty if no config)
    """
    # Use manual path if provided, otherwise use auto-discovered path
    manual_path = request.args.get('path')
    config_path = manual_path if manual_path else config_json_path

    if config_path and os.path.exists(config_path):
        try:
            with open(config_path) as f:
                config = json.load(f)
                return jsonify(config.get('parameters', {}))
        except Exception as e:
            print(f"Warning: Could not read config.json: {e}")
            return jsonify({})

    return jsonify({})


@app.route('/sync-action', methods=['POST'])
def sync_action():
    """
    Handle ALL sync actions by calling the Component class.

    Request JSON:
        {
            "action": "actionName",
            "parameters": {...},
            "componentPath": "/path/to/component" (optional)
        }

    Returns:
        JSON response from the sync action
    """
    try:
        data = request.json
        action = data.get('action')
        parameters = data.get('parameters', {})
        component_path = data.get('componentPath')

        # Determine which project root to use
        current_project_root = project_root
        if component_path:
            # User provided a custom component path
            # Find project root from this path
            if os.path.isdir(component_path):
                # If it's a directory, check if it's component_config or project root
                if os.path.basename(component_path) == 'component_config':
                    current_project_root = os.path.dirname(component_path)
                elif os.path.exists(os.path.join(component_path, 'component_config')):
                    current_project_root = component_path
                else:
                    current_project_root = component_path

        # Write config for Component to read
        write_config(current_project_root, parameters)

        # Dynamically import Component from the correct path
        src_path = os.path.join(current_project_root, 'src')
        if not os.path.exists(src_path):
            return jsonify({
                'status': 'error',
                'message': f'src/ directory not found in {current_project_root}'
            }), 500

        # Import and create component instance with dynamic path
        import importlib.util
        component_file = os.path.join(src_path, 'component.py')

        if not os.path.exists(component_file):
            return jsonify({
                'status': 'error',
                'message': f'component.py not found in {src_path}'
            }), 500

        try:
            # Temporarily add src path to sys.path
            if src_path not in sys.path:
                sys.path.insert(0, src_path)

            # Import Component class
            from component import Component
        except ImportError as e:
            return jsonify({
                'status': 'error',
                'message': f'Could not import Component: {str(e)}'
            }), 500

        comp = Component()

        # Convert camelCase action name to snake_case method name
        def camel_to_snake(name):
            import re
            s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
            return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

        # Try to find the method on the component
        method_name = camel_to_snake(action)

        # Try various naming patterns
        possible_names = [
            action,  # Original (could be snake_case already)
            method_name,  # Converted to snake_case
            action.replace('-', '_'),  # kebab-case to snake_case
        ]

        method = None
        for name in possible_names:
            if hasattr(comp, name):
                method = getattr(comp, name)
                break

        if not method or not callable(method):
            return jsonify({
                'status': 'error',
                'message': f'Unknown action: {action} (tried: {", ".join(possible_names)})'
            }), 400

        # Call the action and return result
        result = method()
        return jsonify(result)

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in sync action: {error_trace}")

        return jsonify({
            'status': 'error',
            'message': str(e),
            'traceback': error_trace
        }), 500


# ============================================================================
# EMBEDDED HTML CONTENT
# ============================================================================

HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Keboola Component Schema Tester</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@json-editor/json-editor@latest/dist/css/jsoneditor.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css">
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@json-editor/json-editor@latest/dist/jsoneditor.min.js"></script>
    <style>
        body {
            padding: 20px;
            background: linear-gradient(135deg, #1BC98E 0%, #0097A7 100%);
            min-height: 100vh;
        }
        .main-container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #1BC98E 0%, #0097A7 100%);
            color: white;
            padding: 30px;
            text-align: center;
            position: relative;
        }
        .logo {
            font-size: 3rem;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
        }
        .logo-icon {
            font-size: 2.5rem;
        }
        .logo-text {
            font-size: 1.8rem;
            font-weight: 700;
            letter-spacing: 1px;
        }
        .header h1 {
            margin: 10px 0 0 0;
            font-size: 1.5rem;
            font-weight: 600;
        }
        .header .credits {
            margin-top: 15px;
            font-size: 0.9rem;
            opacity: 0.9;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .sidebar .reload-button {
            width: 100%;
            background: #1BC98E;
            border: none;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
            margin-bottom: 25px;
            font-size: 1rem;
        }
        .sidebar .reload-button:hover {
            background: #0097A7;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(27, 201, 142, 0.3);
        }
        .content {
            display: flex;
            gap: 0;
            min-height: calc(100vh - 200px);
        }
        .sidebar {
            width: 320px;
            background: #f8f9fa;
            padding: 25px;
            border-right: 2px solid #dee2e6;
            overflow-y: auto;
        }
        .sidebar h3 {
            font-size: 1rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .main-content {
            flex: 1;
            padding: 30px;
            overflow-y: auto;
        }
        .nav-tabs {
            border-bottom: 2px solid #dee2e6;
            margin-bottom: 30px;
        }
        .nav-tabs .nav-link {
            border: none;
            color: #6c757d;
            font-weight: 600;
            padding: 15px 30px;
            transition: all 0.3s;
        }
        .nav-tabs .nav-link:hover {
            color: #1BC98E;
            background: #f8f9fa;
        }
        .nav-tabs .nav-link.active {
            color: #1BC98E;
            border-bottom: 3px solid #1BC98E;
            background: transparent;
        }
        .tab-content {
            min-height: 400px;
        }
        .schema-section {
            margin-bottom: 40px;
            padding: 25px;
            border: 2px solid #dee2e6;
            border-radius: 8px;
            background-color: #f8f9fa;
        }
        .schema-section h2 {
            font-size: 1.5rem;
            margin-bottom: 20px;
            color: #0097A7;
            padding-bottom: 10px;
            border-bottom: 2px solid #dee2e6;
        }
        .form-container {
            background: white;
            padding: 20px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .output-section {
            margin-top: 20px;
            padding: 15px;
            background-color: #e9ecef;
            border-radius: 4px;
            border-left: 4px solid #1BC98E;
        }
        .output-section h3 {
            font-size: 1rem;
            margin-bottom: 10px;
            color: #1BC98E;
        }
        .output-section pre {
            background-color: #fff;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            max-height: 400px;
        }
        .je-object__container {
            padding: 15px;
            background: white;
            border-radius: 4px;
        }
        .btn-primary {
            background: #1BC98E;
            border: none;
            padding: 12px 30px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            margin-top: 10px;
        }
        .btn-primary:hover {
            background: #15B67D;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(27, 201, 142, 0.3);
        }
        .btn-success {
            background: #0097A7;
            border: none;
            padding: 12px 30px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        .btn-success:hover {
            background: #00838F;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0, 151, 167, 0.3);
        }
        .badge {
            font-size: 0.75rem;
            padding: 4px 8px;
            margin-left: 8px;
            vertical-align: middle;
        }
        .combined-config {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
        }
        .combined-config h3 {
            color: #0097A7;
            margin-bottom: 15px;
        }
        .combined-config .help-text {
            color: #6c757d;
            margin-bottom: 20px;
            padding: 15px;
            background: white;
            border-left: 4px solid #1BC98E;
            border-radius: 4px;
        }
        .alert {
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .alert-info {
            background: white;
            border: 1px solid #dee2e6;
            color: #495057;
        }
        .alert-info strong {
            color: #1BC98E;
            display: block;
            margin-bottom: 10px;
        }
        .alert-info ul {
            margin: 0;
            padding-left: 20px;
            font-size: 0.9rem;
            line-height: 1.8;
        }
        .alert-success {
            background: #d4edda;
            border: 1px solid #1BC98E;
            color: #155724;
            font-size: 0.9rem;
        }
        .alert-danger {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            font-size: 0.9rem;
        }
        .status-box {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid #dee2e6;
        }
        .status-box h4 {
            font-size: 0.9rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 10px;
        }
        .status-box .path-item {
            font-size: 0.85rem;
            margin-bottom: 8px;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 4px;
            font-family: monospace;
            word-break: break-all;
        }
        .status-box .path-label {
            color: #1BC98E;
            font-weight: 600;
            margin-right: 8px;
        }
        .field-group-section {
            margin-bottom: 30px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
        }
        .field-group-title {
            font-size: 1.1rem;
            font-weight: 700;
            color: #495057;
            margin: 0 0 20px 0;
            padding-bottom: 12px;
            border-bottom: 2px solid #dee2e6;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .field-group-content {
            background: white;
            padding: 15px;
            border-radius: 4px;
        }
        .field-group-content > div {
            margin-bottom: 15px;
        }
        .field-group-content > div:last-child {
            margin-bottom: 0;
        }
    </style>
</head>
<body>
    <div class="main-container">
        <div class="header">
            <div class="logo">
                <span class="logo-icon">🏭</span>
                <span class="logo-text">COMPONENT FACTORY</span>
            </div>
            <h1>Schema Tester</h1>
            <div class="credits">
                <span>by Component Factory Team</span>
                <span style="opacity: 0.7;">•</span>
                <span style="opacity: 0.7;">Keboola Platform</span>
            </div>
        </div>

        <div class="content">
            <!-- Sidebar -->
            <div class="sidebar">
                <button class="reload-button" onclick="reloadSchemas()">🔄 Reload Schemas</button>

                <h3>Component</h3>
                <div style="margin-bottom: 25px;">
                    <div style="background: white; padding: 15px; border-radius: 6px; border: 2px solid #dee2e6; margin-bottom: 12px;">
                        <div style="font-size: 0.75rem; color: #6c757d; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Current:</div>
                        <div id="current-component" style="font-size: 0.95rem; font-weight: 600; color: #1BC98E; font-family: monospace;">
                            Auto-discovered
                        </div>
                    </div>

                    <input type="file" id="folder-picker" webkitdirectory directory style="display: none;" onchange="handleFolderSelection(event)" />
                    <button
                        onclick="document.getElementById('folder-picker').click()"
                        style="width: 100%; padding: 12px; background: #0097A7; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.95rem; transition: all 0.3s;"
                        onmouseover="this.style.background='#00838F'"
                        onmouseout="this.style.background='#0097A7'"
                    >
                        📁 Browse component_config
                    </button>
                </div>

                <div id="status" style="margin-bottom: 20px;"></div>

                <h3>Quick Start</h3>
                <div class="alert alert-info">
                    <ol style="margin: 0; padding-left: 20px; font-size: 0.9rem; line-height: 1.8;">
                        <li>Click "📁 Browse component_config"</li>
                        <li>Select your component_config folder</li>
                        <li>Click "🔄 Reload Schemas"</li>
                    </ol>
                </div>
            </div>

            <!-- Main Content -->
            <div class="main-content">

                <!-- Tabs Navigation -->
                <ul class="nav nav-tabs" id="configTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="component-tab" data-bs-toggle="tab" data-bs-target="#component-pane" type="button" role="tab">
                            📋 Schema configuration
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="row-tab" data-bs-toggle="tab" data-bs-target="#row-pane" type="button" role="tab">
                            🔧 Row schema configuration
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="combined-tab" data-bs-toggle="tab" data-bs-target="#combined-pane" type="button" role="tab">
                            📦 Resulting configuration
                        </button>
                    </li>
                </ul>

            <!-- Tab Content -->
            <div class="tab-content" id="configTabContent">
                <!-- Component Configuration Tab -->
                <div class="tab-pane fade show active" id="component-pane" role="tabpanel">
                    <div class="schema-section">
                        <h2>Component Configuration</h2>
                        <small class="text-muted">Global settings shared across all configuration rows</small>
                        <div class="form-container">
                            <div id="component-editor"></div>
                            <button class="btn-primary" onclick="validateComponentForm()">Validate Form</button>
                        </div>
                        <div class="output-section">
                            <h3>✅ Generated Component Configuration:</h3>
                            <pre id="component-output">{}</pre>
                        </div>
                    </div>
                </div>

                <!-- Row Configuration Tab -->
                <div class="tab-pane fade" id="row-pane" role="tabpanel">
                    <div class="schema-section">
                        <h2>Row Configuration</h2>
                        <small class="text-muted">Row-specific settings for each data source/table</small>
                        <div class="form-container">
                            <div id="row-editor"></div>
                            <button class="btn-primary" onclick="validateRowForm()">Validate Form</button>
                        </div>
                        <div class="output-section">
                            <h3>✅ Generated Row Configuration:</h3>
                            <pre id="row-output">{}</pre>
                        </div>
                    </div>
                </div>

                <!-- Combined Configuration Tab -->
                <div class="tab-pane fade" id="combined-pane" role="tabpanel">
                    <div class="combined-config">
                        <h3>📦 Complete Component Configuration</h3>
                        <div class="help-text">
                            <strong>💡 How to use:</strong> This is a complete config.json ready to paste into Keboola platform.
                            All component and row parameters are merged into a single <code>parameters</code> object.
                        </div>
                        <button class="btn-success" onclick="copyToClipboard()">📋 Copy to Clipboard</button>
                        <div class="output-section">
                            <h3>✅ Complete config.json</h3>
                            <pre id="combined-output">{}</pre>
                        </div>
                    </div>
                </div>
            </div>
            </div> <!-- end main-content -->
        </div> <!-- end content -->
    </div> <!-- end main-container -->

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        let componentEditor, rowEditor;

        // Store for debounce timers
        const watchDebounceTimers = {};

        // ======================================
        // AUTO-LOAD ON PAGE LOAD
        // ======================================

        // Load schemas from /api/schemas on page load
        async function loadSchemas() {
            try {
                const response = await fetch('/api/schemas');
                if (!response.ok) {
                    throw new Error(`Failed to load schemas: ${response.statusText}`);
                }
                const data = await response.json();
                initializeEditors(data.componentSchema, data.rowSchema);

                showStatus('success', '✅ Schemas loaded successfully');
            } catch (error) {
                console.error('Error loading schemas:', error);
                showStatus('error', `❌ Error loading schemas: ${error.message}`);
            }
        }

        // Load config from /api/config and pre-fill editors
        async function loadConfig() {
            try {
                const response = await fetch('/api/config');
                const config = await response.json();

                if (Object.keys(config).length > 0) {
                    splitAndFillConfig(config);
                    showStatus('success', '✅ Loaded configuration from data/config.json', true);
                } else {
                    showStatus('info', 'ℹ️  No existing config.json found (starting with empty config)', true);
                }
            } catch (error) {
                console.error('Error loading config:', error);
                // Don't show error, just log it
            }
        }

        // Split combined config into component and row parts
        function splitAndFillConfig(config) {
            if (!componentEditor || !rowEditor) {
                console.warn('Editors not ready yet');
                return;
            }

            // Get property keys from both schemas
            const componentSchema = componentEditor.schema;
            const rowSchema = rowEditor.schema;

            const componentKeys = Object.keys(componentSchema.properties || {});
            const rowKeys = Object.keys(rowSchema.properties || {});

            // Split the parameters
            const componentParams = {};
            const rowParams = {};

            Object.keys(config).forEach(key => {
                if (componentKeys.includes(key)) {
                    componentParams[key] = config[key];
                }
                if (rowKeys.includes(key)) {
                    rowParams[key] = config[key];
                }
            });

            // Pre-fill editors with loaded values
            if (Object.keys(componentParams).length > 0) {
                componentEditor.setValue(componentParams);
                console.log('Pre-filled component config:', componentParams);
            }
            if (Object.keys(rowParams).length > 0) {
                rowEditor.setValue(rowParams);
                console.log('Pre-filled row config:', rowParams);
            }
        }

        // Show status message
        function showStatus(type, message, append = false) {
            const statusDiv = document.getElementById('status');
            const alertClass = type === 'success' ? 'alert-success' :
                              type === 'error' ? 'alert-danger' : 'alert-info';

            const html = `<div class="alert ${alertClass}">${message}</div>`;

            if (append) {
                statusDiv.innerHTML += html;
            } else {
                statusDiv.innerHTML = html;
            }
        }

        // ======================================
        // ASYNC ACTIONS AND WATCH SUPPORT
        // ======================================

        // Call sync action endpoint (hardcoded to /sync-action)
        async function callSyncAction(action, parameters) {
            // Merge component and row configs to create combined parameters
            const combinedParameters = {
                ...(componentEditor && componentEditor.ready ? componentEditor.getValue() : {}),
                ...parameters
            };

            // Get current component path from manual input (not implemented in UI yet)
            const componentPath = null;

            try {
                const response = await fetch('/sync-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action,
                        parameters: combinedParameters,
                        componentPath: componentPath || null
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                return await response.json();
            } catch (error) {
                console.error('Sync action failed:', error);
                throw error;
            }
        }

        // Setup async field (dropdown with load button or auto-load)
        function setupAsyncField(editor, fieldPath, schema, originalSchema) {
            const prop = originalSchema.properties[fieldPath];
            if (!prop || !prop.options?.async) return;

            const asyncOptions = prop.options.async;
            const action = asyncOptions.action;
            // autoload can be: true, false, or array of field paths to watch
            const autoloadConfig = asyncOptions.autoload;
            const watchFields = Array.isArray(autoloadConfig) ? autoloadConfig : [];
            const autoload = autoloadConfig === true || (Array.isArray(autoloadConfig) && autoloadConfig.length > 0);

            console.log(`Setting up async field: ${fieldPath}, action: ${action}, watch: ${watchFields.join(',')}`);

            // Find the select element
            const fieldEditor = editor.getEditor(`root.${fieldPath}`);
            if (!fieldEditor) {
                console.warn(`Field editor not found for: ${fieldPath}`);
                return;
            }

            // Create load function
            const loadOptions = async () => {
                try {
                    // Show loading state
                    const selectElement = fieldEditor.input;
                    if (selectElement) {
                        selectElement.disabled = true;
                        selectElement.style.opacity = '0.6';
                    }

                    // Get current form values
                    const parameters = editor.getValue();

                    console.log(`Loading options for ${fieldPath} with action ${action}`);
                    const result = await callSyncAction(action, parameters);

                    // Handle different response formats
                    let options = [];
                    if (result.options) {
                        options = result.options;
                    } else if (result.data) {
                        options = result.data;
                    } else if (Array.isArray(result)) {
                        options = result;
                    }

                    console.log(`Received ${options.length} options for ${fieldPath}`);

                    // Update the field's enum with loaded options
                    if (options.length > 0) {
                        // Extract values and labels from options
                        // Options can be either {value, label} objects or plain strings
                        const values = options.map(opt => typeof opt === 'object' ? opt.value : opt);
                        const labels = options.map(opt => typeof opt === 'object' ? opt.label : opt);

                        console.log(`Extracted values:`, values);

                        // Directly update the select element (simpler than JSONEditor API)
                        const selectElement = fieldEditor.input;
                        if (selectElement && selectElement.tagName === 'SELECT') {
                            // Clear existing options
                            selectElement.innerHTML = '';

                            // Add empty option if field is not required
                            if (!prop.required) {
                                const emptyOption = document.createElement('option');
                                emptyOption.value = '';
                                emptyOption.text = '-- Select --';
                                selectElement.appendChild(emptyOption);
                            }

                            // Add new options
                            values.forEach((value, index) => {
                                const option = document.createElement('option');
                                option.value = value;
                                option.text = labels[index];
                                selectElement.appendChild(option);
                            });

                            console.log(`✅ Populated dropdown with ${values.length} options`);
                        } else {
                            console.warn('Field is not a select element, cannot populate options');
                        }
                    }

                    // Restore UI
                    if (selectElement) {
                        selectElement.disabled = false;
                        selectElement.style.opacity = '1';
                    }

                } catch (error) {
                    console.error(`Error loading options for ${fieldPath}:`, error);
                    alert(`Failed to load options for ${prop.title || fieldPath}:\\n${error.message}`);

                    // Restore UI
                    const selectElement = fieldEditor.input;
                    if (selectElement) {
                        selectElement.disabled = false;
                        selectElement.style.opacity = '1';
                    }
                }
            };

            // Setup watch listeners if specified
            if (watchFields.length > 0) {
                watchFields.forEach(watchFieldRaw => {
                    // Keboola uses paths like "parameters.base_id"
                    // Convert to JSONEditor path: "root.base_id"
                    const watchField = watchFieldRaw.replace(/^parameters\./, '');
                    const watchFieldPath = `root.${watchField}`;

                    console.log(`Setting up watch: ${watchFieldRaw} -> ${watchFieldPath}`);

                    // Watch for changes on the watched field
                    editor.watch(watchFieldPath, () => {
                        // Clear existing debounce timer
                        const timerKey = `${fieldPath}_${watchField}`;
                        if (watchDebounceTimers[timerKey]) {
                            clearTimeout(watchDebounceTimers[timerKey]);
                        }

                        // Set new debounce timer (1 second)
                        watchDebounceTimers[timerKey] = setTimeout(() => {
                            console.log(`Watch triggered: ${watchField} changed, reloading ${fieldPath}`);
                            loadOptions();
                        }, 1000);
                    });
                });

                console.log(`Watch listeners setup for ${fieldPath} on fields: ${watchFields.join(', ')}`);
            }

            // Auto-load if specified
            if (autoload) {
                // Give the editor time to fully initialize
                setTimeout(() => {
                    console.log(`Auto-loading options for ${fieldPath}`);
                    loadOptions();
                }, 500);
            }

            // Add manual load button
            const container = fieldEditor.container;
            if (container) {
                // Check if button already exists
                if (!container.querySelector('.async-load-btn')) {
                    const loadButton = document.createElement('button');
                    loadButton.className = 'btn-primary async-load-btn';
                    loadButton.textContent = `🔄 ${asyncOptions.label || 'Load Options'}`;
                    loadButton.style.marginTop = '10px';
                    loadButton.style.fontSize = '0.9rem';
                    loadButton.style.padding = '8px 16px';

                    loadButton.onclick = async (e) => {
                        e.preventDefault();
                        await loadOptions();
                    };

                    container.appendChild(loadButton);
                }
            }
        }

        // Setup dependencies (conditional fields)
        function setupDependencies(editor, schema, originalSchema, parentPath = '') {
            if (!schema.properties) return;

            Object.keys(schema.properties).forEach(fieldName => {
                const fieldPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
                const prop = originalSchema.properties[fieldName];

                // Check if field has dependencies
                if (prop && prop.options?.dependencies) {
                    const dependencies = prop.options.dependencies;
                    console.log(`Setting up dependencies for ${fieldPath}:`, dependencies);

                    // Get the field editor
                    const fieldEditor = editor.getEditor(`root.${fieldPath}`);
                    if (!fieldEditor) {
                        console.warn(`Field editor not found for: ${fieldPath}`);
                        return;
                    }

                    // Function to check if dependencies are met
                    const checkDependencies = () => {
                        const values = editor.getValue();
                        let shouldShow = true;

                        // Check all dependency conditions
                        Object.keys(dependencies).forEach(depField => {
                            const expectedValue = dependencies[depField];
                            const actualValue = values[depField];

                            if (actualValue !== expectedValue) {
                                shouldShow = false;
                            }
                        });

                        // Show/hide the field
                        if (fieldEditor.container) {
                            fieldEditor.container.style.display = shouldShow ? '' : 'none';
                        }

                        return shouldShow;
                    };

                    // Setup watchers for all dependency fields
                    Object.keys(dependencies).forEach(depField => {
                        const depFieldPath = `root.${depField}`;
                        console.log(`Watching ${depFieldPath} for ${fieldPath}`);

                        editor.watch(depFieldPath, () => {
                            checkDependencies();
                        });
                    });

                    // Initial check
                    setTimeout(() => checkDependencies(), 100);
                }

                // Recursively handle nested objects
                if (prop && prop.type === 'object' && prop.properties) {
                    setupDependencies(editor, prop, prop, fieldPath);
                }
            });
        }

        // Setup watch listeners for all async fields in the schema
        function setupWatchListeners(editor, schema, originalSchema, parentPath = '') {
            if (!schema.properties) return;

            Object.keys(schema.properties).forEach(fieldName => {
                const fieldPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
                const prop = originalSchema.properties[fieldName];

                // Check if field has async options
                if (prop && prop.format === 'select' && prop.options?.async) {
                    setupAsyncField(editor, fieldPath, schema, originalSchema);
                }

                // Recursively handle nested objects
                if (prop && prop.type === 'object' && prop.properties) {
                    setupWatchListeners(editor, prop, prop, fieldPath);
                }
            });
        }

        // Setup action buttons (for button type fields)
        function setupActionButtons(editor, schema, originalSchema, parentPath = '') {
            if (!schema.properties) return;

            Object.keys(schema.properties).forEach(fieldName => {
                const fieldPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
                const processedProp = schema.properties[fieldName];
                const originalProp = originalSchema.properties[fieldName];

                // Check if this is a button field
                if (originalProp && originalProp.type === 'button' && processedProp.options?._isButton) {
                    const action = processedProp.options._action;
                    const label = processedProp.options._label;

                    console.log(`Setting up button: ${fieldPath}, action: ${action}, label: ${label}`);

                    // Find the field editor container
                    const fieldEditor = editor.getEditor(`root.${fieldPath}`);
                    if (fieldEditor && fieldEditor.container) {
                        console.log(`Found field editor for ${fieldPath}`);

                        // Hide the input element (it's already hidden via CSS but double-check)
                        const inputElement = fieldEditor.input;
                        if (inputElement) {
                            inputElement.style.display = 'none';
                        }

                        // Hide the label too (makes it cleaner)
                        const labelElement = fieldEditor.container.querySelector('label');
                        if (labelElement) {
                            labelElement.style.display = 'none';
                        }

                        // Create action button
                        if (!fieldEditor.container.querySelector('.sync-action-btn')) {
                            const button = document.createElement('button');
                            button.className = 'btn-primary sync-action-btn';
                            button.textContent = `🔘 ${label}`;
                            button.style.width = '100%';
                            button.style.marginTop = '10px';
                            button.style.padding = '12px';
                            button.style.fontSize = '0.95rem';
                            button.style.background = '#1BC98E';
                            button.style.border = 'none';
                            button.style.borderRadius = '4px';
                            button.style.color = 'white';
                            button.style.cursor = 'pointer';
                            button.style.fontWeight = '600';

                            button.onclick = async (e) => {
                                e.preventDefault();
                                await executeSyncAction(editor, action, label);
                            };

                            fieldEditor.container.appendChild(button);
                            console.log(`✅ Button created for ${fieldPath}`);
                        }
                    } else {
                        console.warn(`Could not find field editor for: ${fieldPath}`);
                    }
                }

                // Recursively handle nested objects
                if (originalProp && originalProp.type === 'object' && originalProp.properties) {
                    console.log(`Recursing into nested object: ${fieldPath}`);
                    setupActionButtons(editor, processedProp, originalProp, fieldPath);
                }
            });
        }

        // Execute a sync action and show results
        async function executeSyncAction(editor, action, label) {
            try {
                const button = event.target;
                button.disabled = true;
                button.style.opacity = '0.6';
                button.textContent = `⏳ ${label}...`;

                // Get current form values (combined config)
                const componentConfig = componentEditor ? componentEditor.getValue() : {};
                const rowConfig = editor.getValue();
                const parameters = {...componentConfig, ...rowConfig};

                // Call sync action
                const result = await callSyncAction(action, parameters);

                // Show result in alert/modal
                if (result.status === 'success' || !result.status) {
                    alert(`✅ ${label} succeeded!\\n\\n${JSON.stringify(result, null, 2)}`);
                } else {
                    alert(`❌ ${label} failed:\\n\\n${result.message || JSON.stringify(result, null, 2)}`);
                }

                button.disabled = false;
                button.style.opacity = '1';
                button.textContent = `🔘 ${label}`;
            } catch (error) {
                const button = event.target;
                button.disabled = false;
                button.style.opacity = '1';
                button.textContent = `🔘 ${label}`;

                alert(`❌ ${label} error:\\n\\n${error.message}`);
                console.error('Sync action error:', error);
            }
        }

        // ======================================
        // SCHEMA PREPROCESSING
        // ======================================

        // Detect field groups based on propertyOrder or custom x-kbc-group property
        function detectFieldGroups(schema) {
            const groups = {};

            if (!schema.properties) return groups;

            Object.keys(schema.properties).forEach(key => {
                const prop = schema.properties[key];

                // Check for custom x-kbc-group property
                let groupName = prop['x-kbc-group'] || null;

                // If no custom group, infer from propertyOrder
                if (!groupName && prop.propertyOrder !== undefined) {
                    const order = prop.propertyOrder;
                    if (order >= 1 && order <= 4) {
                        groupName = 'Connection';
                    } else if (order >= 5 && order <= 7) {
                        groupName = 'Data Selection';
                    } else if (order >= 8) {
                        groupName = 'Destination';
                    }
                }

                // Default group if none detected
                if (!groupName) {
                    groupName = 'Configuration';
                }

                if (!groups[groupName]) {
                    groups[groupName] = [];
                }
                groups[groupName].push(key);
            });

            return groups;
        }

        // Preprocess schema to handle Keboola-specific features
        function preprocessSchema(schema) {
            const processed = JSON.parse(JSON.stringify(schema)); // Deep clone

            if (processed.properties) {
                Object.keys(processed.properties).forEach(key => {
                    const prop = processed.properties[key];

                    // Handle button type (not standard JSON Schema)
                    if (prop.type === 'button') {
                        // Button can have async action or just be a visual button
                        let action = 'unknown';
                        let label = prop.title || 'Button';

                        // Check if button has async action
                        if (prop.options?.async?.action) {
                            action = prop.options.async.action;
                            if (prop.options.async.label) {
                                label = prop.options.async.label;
                            }
                        } else if (prop.format) {
                            // Use format as action name (e.g., "test-connection" -> "testConnection")
                            action = prop.format.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                            // Convert test-connection to testConnection
                            if (action === 'testConnection') {
                                label = 'Test Connection';
                            }
                        }

                        // Convert button to a string field (we'll hide input and add real button via DOM)
                        processed.properties[key] = {
                            type: 'string',
                            title: prop.title || '',
                            default: '',
                            options: {
                                _isButton: true,  // Mark for button creation
                                _action: action,
                                _label: label,
                                _format: prop.format,  // Store original format
                                inputAttributes: {
                                    style: 'display: none;'  // Hide the input
                                }
                            },
                            propertyOrder: prop.propertyOrder
                        };
                    }

                    // Handle async selects - keep them as selects (not readonly)
                    if (prop.format === 'select' && prop.options?.async) {
                        // Mark this field as having async loading
                        if (!prop.options) prop.options = {};
                        prop.options._hasAsync = true;
                    }

                    // Ensure multiselect arrays work properly
                    if (prop.type === 'array' && prop.format === 'select') {
                        // JSONEditor needs these options for multiselect
                        if (!prop.options) prop.options = {};
                        prop.uniqueItems = true;
                    }

                    // Handle enum_titles (custom labels for enum values)
                    if (prop.enum && prop.options?.enum_titles) {
                        // JSONEditor expects this format for custom enum labels
                        // No preprocessing needed - JSONEditor handles options.enum_titles natively
                        // Just ensure it's properly formatted
                        if (!Array.isArray(prop.options.enum_titles) ||
                            prop.options.enum_titles.length !== prop.enum.length) {
                            console.warn(`enum_titles length mismatch for ${key}`);
                        }
                    }

                    // Recursively process nested objects
                    if (prop.type === 'object' && prop.properties) {
                        Object.keys(prop.properties).forEach(nestedKey => {
                            const nestedProp = prop.properties[nestedKey];

                            // Apply same transformations to nested properties
                            if (nestedProp.type === 'button') {
                                // Handle nested buttons
                                let action = 'unknown';
                                let label = nestedProp.title || 'Button';

                                if (nestedProp.options?.async?.action) {
                                    action = nestedProp.options.async.action;
                                    if (nestedProp.options.async.label) {
                                        label = nestedProp.options.async.label;
                                    }
                                } else if (nestedProp.format) {
                                    action = nestedProp.format.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                                }

                                prop.properties[nestedKey] = {
                                    type: 'string',
                                    title: nestedProp.title || '',
                                    default: '',
                                    options: {
                                        _isButton: true,
                                        _action: action,
                                        _label: label,
                                        _format: nestedProp.format,
                                        inputAttributes: {
                                            style: 'display: none;'
                                        }
                                    },
                                    propertyOrder: nestedProp.propertyOrder
                                };
                            }
                        });
                    }
                });
            }

            return processed;
        }

        // Reorganize form fields into grouped sections
        function organizeFieldsIntoSections(editor, schema, editorElement) {
            const groups = detectFieldGroups(schema);
            const groupNames = Object.keys(groups);

            // If only one group or no groups, don't reorganize
            if (groupNames.length <= 1) return;

            console.log('Organizing fields into sections:', groups);

            // Create sections for each group
            const sections = {};
            const groupOrder = ['Connection', 'Data Selection', 'Destination', 'Configuration'];

            groupOrder.forEach(groupName => {
                if (groups[groupName]) {
                    const section = document.createElement('div');
                    section.className = 'field-group-section';
                    section.innerHTML = `<h3 class="field-group-title">${groupName}</h3><div class="field-group-content"></div>`;
                    sections[groupName] = section;
                }
            });

            // Move fields into their respective sections
            groupOrder.forEach(groupName => {
                if (!groups[groupName]) return;

                const fieldNames = groups[groupName];
                fieldNames.forEach(fieldName => {
                    // Find the field container - search globally in editorElement
                    const fieldContainer = editorElement.querySelector(`[data-schemapath="root.${fieldName}"]`);
                    if (fieldContainer) {
                        const sectionContent = sections[groupName].querySelector('.field-group-content');

                        // Get the parent row (Bootstrap row class)
                        let rowElement = fieldContainer;
                        while (rowElement && !rowElement.classList.contains('row')) {
                            rowElement = rowElement.parentElement;
                        }

                        if (rowElement) {
                            sectionContent.appendChild(rowElement);
                        } else {
                            console.warn(`Row element not found for field: ${fieldName}`);
                        }
                    } else {
                        console.warn(`Field not found: ${fieldName}`);
                    }
                });
            });

            // Find where to insert sections
            const editorRoot = editorElement.querySelector('[data-schemapath="root"]');
            if (!editorRoot) {
                console.error('Editor root not found');
                return;
            }

            // Find the card-body container (4th child of root)
            const objectContainer = editorRoot.querySelector('.card.card-body');
            if (!objectContainer) {
                console.error('Object container not found');
                return;
            }

            // Clear existing fields
            objectContainer.innerHTML = '';

            // Append sections in order
            groupOrder.forEach(groupName => {
                if (sections[groupName]) {
                    objectContainer.appendChild(sections[groupName]);
                }
            });

            console.log('Sections organized successfully');
        }

        // Store original schemas for async field setup
        let originalComponentSchema = null;
        let originalRowSchema = null;

        // Initialize editors with schemas
        function initializeEditors(componentSchema, rowSchema) {
            // Store original schemas
            originalComponentSchema = componentSchema;
            originalRowSchema = rowSchema;

            // Preprocess schemas to handle Keboola-specific features
            const processedComponentSchema = preprocessSchema(componentSchema);
            const processedRowSchema = preprocessSchema(rowSchema);

            // Initialize Component Editor
            if (componentEditor) componentEditor.destroy();
            const componentElement = document.getElementById('component-editor');
            componentEditor = new JSONEditor(componentElement, {
                schema: processedComponentSchema,
                theme: 'bootstrap5',
                iconlib: 'bootstrap',
                disable_collapse: false,
                disable_edit_json: false,
                disable_properties: false,
                show_errors: 'interaction',
                prompt_before_delete: false,
                no_additional_properties: false,
                required_by_default: false,
                keep_oneof_values: false,
                use_default_values: true,
                select2: {
                    tags: true,
                    width: '100%'
                }
            });

            componentEditor.on('ready', function() {
                componentEditor.on('change', function() {
                    updateComponentOutput();
                    updateCombinedOutput();
                });
                setTimeout(() => {
                    updateComponentOutput();
                    // Organize fields into sections
                    organizeFieldsIntoSections(componentEditor, originalComponentSchema, componentElement);
                    // Setup dependencies (conditional fields)
                    setupDependencies(componentEditor, processedComponentSchema, originalComponentSchema);
                    // Setup async fields and watch listeners
                    setupWatchListeners(componentEditor, processedComponentSchema, originalComponentSchema);
                    // Setup action buttons
                    setupActionButtons(componentEditor, processedComponentSchema, originalComponentSchema);
                }, 100);
            });

            // Initialize Row Editor
            if (rowEditor) rowEditor.destroy();
            const rowElement = document.getElementById('row-editor');
            rowEditor = new JSONEditor(rowElement, {
                schema: processedRowSchema,
                theme: 'bootstrap5',
                iconlib: 'bootstrap',
                disable_collapse: false,
                disable_edit_json: false,
                disable_properties: false,
                show_errors: 'interaction',
                prompt_before_delete: false,
                no_additional_properties: false,
                required_by_default: false,
                keep_oneof_values: false,
                use_default_values: true,
                select2: {
                    tags: true,
                    width: '100%'
                }
            });

            rowEditor.on('ready', function() {
                rowEditor.on('change', function() {
                    updateRowOutput();
                    updateCombinedOutput();
                });
                setTimeout(() => {
                    updateRowOutput();
                    updateCombinedOutput();
                    // Organize fields into sections
                    organizeFieldsIntoSections(rowEditor, originalRowSchema, rowElement);
                    // Setup dependencies (conditional fields)
                    setupDependencies(rowEditor, processedRowSchema, originalRowSchema);
                    // Setup async fields and watch listeners
                    setupWatchListeners(rowEditor, processedRowSchema, originalRowSchema);
                    // Setup action buttons
                    setupActionButtons(rowEditor, processedRowSchema, originalRowSchema);
                }, 100);
            });
        }


        // Reload schemas from server (either browser-uploaded or auto-discovered)
        async function reloadSchemas() {
            document.getElementById('status').innerHTML = '';

            try {
                // Load schemas from server
                const schemaResponse = await fetch('/api/schemas');
                if (!schemaResponse.ok) {
                    throw new Error(`Failed to load schemas: ${schemaResponse.statusText}`);
                }
                const schemaData = await schemaResponse.json();
                initializeEditors(schemaData.componentSchema, schemaData.rowSchema);

                showStatus('success', '✅ Schemas reloaded successfully');

                // Try to load config
                const configResponse = await fetch('/api/config');
                if (configResponse.ok) {
                    const config = await configResponse.json();
                    if (Object.keys(config).length > 0) {
                        setTimeout(() => {
                            splitAndFillConfig(config);
                            showStatus('success', '✅ Configuration loaded', true);
                        }, 500);
                    }
                }
            } catch (error) {
                console.error('Error reloading schemas:', error);
                showStatus('error', `❌ Error: ${error.message}`);
            }
        }

        // Update outputs
        function updateComponentOutput() {
            if (!componentEditor || !componentEditor.ready) return;

            const output = document.getElementById('component-output');
            const errors = componentEditor.validate();

            if (errors.length === 0) {
                output.textContent = JSON.stringify(componentEditor.getValue(), null, 2);
                output.style.borderColor = '#1BC98E';
            } else {
                output.textContent = JSON.stringify(componentEditor.getValue(), null, 2) +
                    '\\n\\n// ERRORS:\\n' + JSON.stringify(errors, null, 2);
                output.style.borderColor = '#dc3545';
            }
        }

        function updateRowOutput() {
            if (!rowEditor || !rowEditor.ready) return;

            const output = document.getElementById('row-output');
            const errors = rowEditor.validate();

            if (errors.length === 0) {
                output.textContent = JSON.stringify(rowEditor.getValue(), null, 2);
                output.style.borderColor = '#1BC98E';
            } else {
                output.textContent = JSON.stringify(rowEditor.getValue(), null, 2) +
                    '\\n\\n// ERRORS:\\n' + JSON.stringify(errors, null, 2);
                output.style.borderColor = '#dc3545';
            }
        }

        function updateCombinedOutput() {
            if (!componentEditor || !componentEditor.ready || !rowEditor || !rowEditor.ready) return;

            const combined = {
                parameters: {
                    ...componentEditor.getValue(),
                    ...rowEditor.getValue()
                }
            };

            document.getElementById('combined-output').textContent =
                JSON.stringify(combined, null, 2);
        }

        // Copy to clipboard
        function copyToClipboard() {
            const text = document.getElementById('combined-output').textContent;
            navigator.clipboard.writeText(text).then(() => {
                alert('✅ Copied to clipboard!');
            }).catch(err => {
                alert('❌ Failed to copy: ' + err);
            });
        }

        // Validate forms
        function validateComponentForm() {
            const errors = componentEditor.validate();
            if (errors.length === 0) {
                alert('✅ Component configuration is valid!');
            } else {
                alert('❌ Validation errors:\\n\\n' + errors.map(e => `${e.path}: ${e.message}`).join('\\n'));
            }
        }

        function validateRowForm() {
            const errors = rowEditor.validate();
            if (errors.length === 0) {
                alert('✅ Row configuration is valid!');
            } else {
                alert('❌ Validation errors:\\n\\n' + errors.map(e => `${e.path}: ${e.message}`).join('\\n'));
            }
        }

        // ======================================
        // FOLDER SELECTION AND SCHEMA UPLOAD
        // ======================================

        // Handle folder selection from webkitdirectory picker
        async function handleFolderSelection(event) {
            const files = event.target.files;
            if (!files || files.length === 0) {
                showStatus('error', '❌ No files selected');
                return;
            }

            showStatus('info', '📂 Reading schemas from selected folder...');

            try {
                // Find configSchema.json and configRowSchema.json in the FileList
                let configSchemaFile = null;
                let rowSchemaFile = null;
                let componentName = 'Unknown';
                let folderName = 'component_config';

                console.log(`Found ${files.length} files in selection`);

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const path = file.webkitRelativePath || file.name;
                    console.log(`File ${i}: ${path}`);

                    // Look for schema files by name (case-insensitive)
                    const fileName = path.split('/').pop().toLowerCase();

                    if (fileName === 'configschema.json') {
                        configSchemaFile = file;
                        console.log('Found configSchema.json');
                    } else if (fileName === 'configrowschema.json') {
                        rowSchemaFile = file;
                        console.log('Found configRowSchema.json');
                    }

                    // Extract folder name (first part of webkitRelativePath)
                    if (i === 0 && path.includes('/')) {
                        folderName = path.split('/')[0];
                    }
                }

                if (!configSchemaFile || !rowSchemaFile) {
                    const foundFiles = Array.from(files).map(f => f.webkitRelativePath || f.name).join(', ');
                    showStatus('error', `❌ Could not find required schema files. Found: ${foundFiles}`);
                    console.error('Missing schema files. Found:', foundFiles);
                    return;
                }

                componentName = folderName;

                // Read file contents
                const configSchemaText = await configSchemaFile.text();
                const rowSchemaText = await rowSchemaFile.text();

                console.log('Parsing schema files...');
                const componentSchema = JSON.parse(configSchemaText);
                const rowSchema = JSON.parse(rowSchemaText);

                console.log('Schemas parsed successfully, uploading...');

                // Upload schemas to server
                await uploadSchemas(componentSchema, rowSchema, componentName);

            } catch (error) {
                console.error('Error reading schemas:', error);
                showStatus('error', `❌ Error: ${error.message}`);
            }
        }

        // Upload schemas to server
        async function uploadSchemas(componentSchema, rowSchema, componentName) {
            try {
                const response = await fetch('/api/load-schemas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        componentSchema: componentSchema,
                        rowSchema: rowSchema,
                        componentName: componentName || 'Unknown'
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }

                const result = await response.json();

                // Update UI with component name
                document.getElementById('current-component').textContent = componentName || 'Loaded from browser';

                showStatus('success', '✅ Schemas uploaded successfully! Click "🔄 Reload Schemas" to apply.');

            } catch (error) {
                console.error('Error uploading schemas:', error);
                showStatus('error', `❌ Upload failed: ${error.message}`);
            }
        }

        // ======================================
        // INITIALIZE ON PAGE LOAD
        // ======================================

        // Set component name from auto-discovered path
        async function loadDiscoveryInfo() {
            try {
                const response = await fetch('/api/discovery-info');
                if (response.ok) {
                    const info = await response.json();
                    if (info.componentConfig) {
                        // Extract component name from path
                        const path = info.componentConfig;
                        const parts = path.split('/');
                        // Get the folder before component_config
                        const componentNameIndex = parts.indexOf('component_config') - 1;
                        const componentName = componentNameIndex >= 0 ? parts[componentNameIndex] : 'Auto-discovered';

                        // Update UI
                        const componentEl = document.getElementById('current-component');
                        if (componentEl) {
                            componentEl.textContent = componentName;
                        }
                    }
                }
            } catch (error) {
                console.warn('Could not load discovery info:', error);
            }
        }

        window.addEventListener('DOMContentLoaded', () => {
            loadDiscoveryInfo();  // Pre-fill manual paths
            loadSchemas();
            // Wait for editors to initialize, then load config
            setTimeout(loadConfig, 500);
        });
    </script>
</body>
</html>
"""


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == '__main__':
    # Parse command-line arguments
    parser = argparse.ArgumentParser(
        description='Keboola Component Schema Tester',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Auto-discovery from current directory
  python component_schema_tester.py

  # Specify component root directory
  python component_schema_tester.py /path/to/component

  # Specify component_config directory directly
  python component_schema_tester.py /path/to/component/component_config
        """
    )
    parser.add_argument(
        'path',
        nargs='?',
        default=None,
        help='Path to component directory or component_config folder (optional)'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=8000,
        help='Port to run the server on (default: 8000)'
    )

    args = parser.parse_args()

    # Resolve project root
    if args.path:
        # User provided a path
        project_root = resolve_component_path(args.path)
        if not project_root:
            print("\n" + "="*80)
            print("❌ ERROR: Invalid component path")
            print("="*80)
            print(f"\nCould not find component_config/ in or near: {args.path}")
            print("\nPlease provide:")
            print("  - Path to component root directory (contains component_config/)")
            print("  - Path to component_config/ folder directly")
            print("="*80 + "\n")
            sys.exit(1)
        print(f"\n📍 Using component path: {args.path}")
    else:
        # Auto-discovery
        project_root = find_project_root()
        if not project_root:
            print("\n" + "="*80)
            print("❌ ERROR: Could not find component_config/ folder")
            print("="*80)
            print("\nAuto-discovery failed. Please either:")
            print("  1. Run from within your component directory, OR")
            print("  2. Provide component path as argument:")
            print("     python component_schema_tester.py /path/to/component")
            print("="*80 + "\n")
            sys.exit(1)
        print(f"\n🔍 Auto-discovered component")

    component_config_path = find_component_config(project_root)
    config_json_path = find_config_json(project_root)

    # Verify required schemas exist
    if not os.path.exists(os.path.join(component_config_path, 'configSchema.json')):
        print(f"\n❌ ERROR: configSchema.json not found in {component_config_path}")
        sys.exit(1)

    if not os.path.exists(os.path.join(component_config_path, 'configRowSchema.json')):
        print(f"\n❌ ERROR: configRowSchema.json not found in {component_config_path}")
        sys.exit(1)

    # Print startup information
    print("\n" + "="*80)
    print("🏭 KEBOOLA COMPONENT SCHEMA TESTER")
    print("="*80)
    print(f"✅ Project root:       {project_root}")
    print(f"✅ Component config:   {component_config_path}")

    if config_json_path:
        print(f"✅ Config.json:        {config_json_path}")
    else:
        print(f"ℹ️  Config.json:        Not found (will use empty config)")

    print("\n" + "-"*80)
    print(f"🚀 Starting server on http://localhost:{args.port}")
    print("-"*80)
    print("\nPress Ctrl+C to stop the server")
    print("="*80 + "\n")

    # Set up environment for component imports
    os.environ['KBC_DATADIR'] = os.path.join(project_root, 'data')
    sys.path.insert(0, os.path.join(project_root, 'src'))

    # Start Flask server
    try:
        app.run(host='0.0.0.0', port=args.port, debug=False)
    except KeyboardInterrupt:
        print("\n\n" + "="*80)
        print("👋 Server stopped")
        print("="*80 + "\n")
        sys.exit(0)
