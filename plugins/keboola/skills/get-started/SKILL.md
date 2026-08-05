---
name: get-started
description: >
  Mandatory initialization workflow for new Keboola Python components — use this skill before
  writing any code. Contains the exact cookiecutter command, Keboola-specific post-template
  cleanup steps, KBC_DATADIR directory structure, data/config.json format, and first commit
  format that are easy to get wrong without this reference. Invoke whenever the user is
  starting from a fresh or empty repository, has never built a Keboola component before,
  wants to run the cookiecutter template, or says things like "new extractor for X",
  "build ex-something from scratch", "fresh repo", "empty git repo", "brand new component",
  "never done this in keboola", "initialize a component", "scaffolding a new component",
  "just initialized the git repo", "nothing set up yet". Not for existing components
  that already have src/component.py.
metadata:
  tools: "Bash, Read, Write, Edit, Glob, AskUserQuestion"
  model: sonnet
  color: green
---

# Initialize New Keboola Component

Before writing any code, check whether the component has already been initialized.

## Step 1: Detect state

Check for signs of an existing cookiecutter setup:

```bash
ls src/component.py component_config/ pyproject.toml 2>/dev/null
```

- If all present → skip initialization, hand off to `@develop-component` immediately
- If missing or empty repo → proceed with initialization below

## Step 2: Gather component info

You may already know the component details from the conversation. If not, ask:

- **Component name** — kebab-case, no type suffix (e.g. `ex-salesforce`, not `salesforce-extractor`)
- **Component ID** — `vendor.component-name` format (e.g. `keboola.ex-salesforce`)
- **Type** — `extractor`, `writer`, or `application`
- **Short description** — one sentence of what it does

Naming rules:
- Never include "extractor", "writer", or "application" in the name itself
- Use prefix convention: `ex-` for extractors, `wr-` for writers

## Step 3: Run cookiecutter

```bash
# Install if missing
which cookiecutter || pip install --user cookiecutter

cookiecutter gh:keboola/cookiecutter-python-component
```

Run interactively so the user can confirm the values. The template creates `src/`, `component_config/`, `tests/`, `.github/workflows/`, `Dockerfile`, `pyproject.toml`, and `data/` with example files.

## Step 4: Clean up and configure

```bash
# Remove the generic example files that come with the template
find data -type f -delete

# Recreate the expected directory structure
mkdir -p data/in/tables data/in/files data/out/tables data/out/files
```

Then create `data/config.json` with realistic example parameters based on what the component actually does — not a generic placeholder. Read `component_config/configSchema.json` if it already has content, and mirror the required fields with plausible example values. Use `#` prefix for sensitive fields (e.g. `"#api_key"`).

## Step 5: Initial commit

```bash
git add -A
git commit -m "feat: initialize component from cookiecutter template"
```

## Step 6: Hand off

Once initialized, pass to `@develop-component` to start the implementation. Share what you know about the component's purpose so it has context.

---

## Key resources

- Cookiecutter template: `gh:keboola/cookiecutter-python-component`
- Developer Portal: https://components.keboola.com/
- Component tutorial: https://developers.keboola.com/extend/component/tutorial/
