# Component Initialization & Setup

Complete guide for initializing new Keboola Python components.

## Steps

### 1. Understand Requirements

Gather information about what the component should do:
- Component type (extractor, writer, transformation, or application)
- Data source/destination
- Required authentication method
- Incremental vs. full load requirements
- Configuration parameters needed

### 2. Use Cookiecutter Template

Initialize using the official template:

```bash
cookiecutter gh:keboola/cookiecutter-python-component
```

The template will prompt you for:
- Component name (without 'extractor', 'writer', or 'application' suffix)
- Component ID
- Author information
- Python version

### 3. Clean Up Example Data and Create Config

After cookiecutter initialization:

#### a) Remove all example files

```bash
find data -type f -delete
```

#### b) Create example `data/config.json`

Create a component-specific configuration file:

```json
{
  "parameters": {
    "param1": "example_value",
    "param2": true
  }
}
```

**Important notes:**
- The template includes generic example files (test.csv, order1.xml, etc.) - remove these
- Create a **new** `data/config.json` with realistic example parameters for this specific component
- Include all required parameters with example values
- Use placeholder values that clearly indicate what should be replaced (e.g., "your-api-key-here")
- The `data/` directory is in `.gitignore` so config.json won't be committed
- Developers need config.json for local testing: `python src/component.py`
- The Keboola platform provides real configuration at runtime

### 4. Repository Structure

Ensure proper directory structure is established:

```
my-component/
├── src/
│   ├── component.py          # Main component logic
│   └── configuration.py      # Configuration validation
├── component_config/
│   ├── component_config.json           # Configuration schema
│   ├── component_long_description.md   # Detailed description
│   ├── component_short_description.md  # Brief description
│   └── configRowSchema.json           # Row-level config (if needed)
├── tests/
│   └── test_component.py     # Unit tests
├── data/
│   ├── config.json          # Example config for local testing
│   ├── in/
│   │   ├── tables/          # Empty
│   │   └── files/           # Empty
│   └── out/
│       ├── tables/          # Empty
│       └── files/           # Empty
├── .github/workflows/
│   └── push.yml             # CI/CD deployment
├── Dockerfile               # Container definition
├── pyproject.toml           # Dependencies
└── README.md                # Documentation
```

### 5. Developer Portal Registration

Register the component in the Developer Portal using curl commands. See [Developer Portal Guide](developer-portal.md) for the complete API workflow.

**IMPORTANT**: Always use curl commands for registration, never use a web browser.

## Important Notes

**IMPORTANT**: Never use words like 'extractor', 'writer', or 'application' in the component name itself.

## Next Steps

After initialization:
1. Review [Architecture Guide](architecture.md) for component structure patterns
2. Implement your component following [Code Quality Guidelines](code-quality.md)
3. Use [Workflow Patterns](workflow-patterns.md) for clean code organization
4. Check [Best Practices](best-practices.md) DO/DON'T lists
5. Use [Debugging Guide](debugging.md) when troubleshooting issues
