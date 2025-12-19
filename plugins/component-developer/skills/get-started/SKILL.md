---
name: get-started
description: Guide for initializing and setting up new Keboola Python components using cookiecutter template. Use when starting a new component project from scratch.
model: sonnet
color: green
---

# Get Started with Keboola Component Development

This skill helps you initialize and set up new Keboola Python components from scratch using the official cookiecutter template.

## When to Use This Skill

- Starting a new Keboola component project
- Need to understand the initialization process
- Setting up the project structure correctly
- Understanding cookiecutter template usage

## Quick Start

The fastest way to start a new component:

```bash
cookiecutter gh:keboola/cookiecutter-python-component
```

Then clean up and configure:
1. Remove cookiecutter example files from `data/` directory
2. Create component-specific `data/config.json` with example parameters
3. Keep empty `data/` folder structure (not committed to git)

## Complete Initialization Guide

For detailed step-by-step instructions, see:
- [Initialization Guide](references/initialization.md) - Complete setup process

## What Happens During Initialization

The cookiecutter template creates:
- `src/` - Component Python code
- `component_config/` - Configuration schemas and descriptions
- `tests/` - Test structure
- `.github/workflows/` - CI/CD pipelines
- `Dockerfile` - Container definition
- `requirements.txt` - Python dependencies
- `data/` - Local testing directory (with examples to remove)

## After Initialization

Once initialized, you'll typically want to:
1. Implement component logic (use `@build-component` skill)
2. Design configuration schemas (use `@build-component-ui` skill)
3. Write tests (use `@test-component` skill)
4. Deploy to Developer Portal

## Key Resources

- **Cookiecutter Template**: https://github.com/keboola/cookiecutter-python-component
- **Component Tutorial**: https://developers.keboola.com/extend/component/tutorial/
- **Developer Docs**: https://developers.keboola.com/

## Next Steps

After getting started:
- For component development: Use `@build-component` skill
- For UI/schema work: Use `@build-component-ui` skill
- For testing: Use `@test-component` skill
- For debugging: Use `@debug-component` skill
