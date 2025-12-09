# Playwright MCP Setup for Schema Testing

Automated E2E testing for Keboola configuration schemas using Playwright MCP.

## What is Playwright MCP?

Playwright MCP is a Model Context Protocol server that allows Claude to control browsers and run automated tests. It's perfect for testing configuration schema UIs.

## Prerequisites

- Node.js 18+ installed
- Claude Desktop or Claude Code
- Schema tester running (see `../schema-tester/`)

## Installation

### Option 1: Automatic Installation (Recommended)

```bash
cd ~/.claude/plugins/marketplaces/keboola-claude-kit/plugins/component-ui-developer/tools/playwright-setup
./install.sh
```

This will:
1. Install Playwright MCP via npx
2. Add configuration to your Claude config
3. Install browser binaries
4. Verify installation

### Option 2: Manual Installation

1. **Add to Claude Config**

Edit your Claude configuration file:
- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Add this MCP server:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@executeautomation/mcp-playwright"
      ]
    }
  }
}
```

2. **Install Browser Binaries**

```bash
npx playwright install chromium
```

3. **Restart Claude**

Restart Claude Desktop or Claude Code to load the MCP server.

## Verification

Check that Playwright MCP is available:

1. Look for `mcp__playwright__` tools in Claude's tool list
2. Try navigating to a page:
   ```
   Use mcp__playwright__browser_navigate to go to http://example.com
   ```

## Using with Schema Tester

### 1. Start Schema Tester

```bash
cd ~/.claude/plugins/.../schema-tester
./start-server.sh
```

### 2. Ask Claude to Test

```
Test my configuration schema at http://localhost:8000/schema-tester/

Check:
1. Component Config loads
2. When auth_type changes to "apiKey", username field disappears
3. When sync_type changes to "incremental", incremental_field appears
4. Password values are captured in JSON output
```

### 3. Claude Will Use Playwright MCP

Claude will automatically:
- Navigate to the schema tester
- Fill in fields
- Change dropdown values
- Take screenshots
- Verify conditional fields work
- Check JSON output
- Report results

## Example Test Cases

### Test 1: Basic Conditional Fields

```
Navigate to http://localhost:8000/schema-tester/

Test the auth_type conditional fields:
1. Verify username and password visible when auth_type="basic"
2. Change auth_type to "apiKey"
3. Verify username and password hidden
4. Verify api_key field visible
5. Take screenshot of each state
```

### Test 2: Incremental Sync Fields

```
Navigate to http://localhost:8000/schema-tester/

Click Row Config tab.

Test sync_type conditional fields:
1. Verify incremental_field hidden when sync_type="full"
2. Change sync_type to "incremental"
3. Verify incremental_field appears
4. Verify primary_key field appears
5. Take screenshots
```

### Test 3: Form Validation

```
Navigate to http://localhost:8000/schema-tester/

Test required field validation:
1. Clear the base_url field
2. Click "Validate Form"
3. Verify validation error appears
4. Fill base_url
5. Click "Validate Form" again
6. Verify validation passes
```

### Test 4: Password Field Capture

```
Navigate to http://localhost:8000/schema-tester/

Test password field:
1. Set auth_type to "basic"
2. Fill username: "testuser"
3. Fill password: "myPassword123"
4. Click Base URL field (to trigger blur)
5. Check JSON output contains "#password": "myPassword123"
6. Take screenshot
```

## Available Playwright MCP Tools

### Navigation
- `mcp__playwright__browser_navigate` - Go to URL
- `mcp__playwright__browser_navigate_back` - Go back

### Interaction
- `mcp__playwright__browser_click` - Click element
- `mcp__playwright__browser_type` - Type text
- `mcp__playwright__browser_fill_form` - Fill multiple fields
- `mcp__playwright__browser_select_option` - Select dropdown option
- `mcp__playwright__browser_press_key` - Press keyboard key

### Inspection
- `mcp__playwright__browser_snapshot` - Get accessibility tree
- `mcp__playwright__browser_take_screenshot` - Capture screenshot
- `mcp__playwright__browser_evaluate` - Run JavaScript
- `mcp__playwright__browser_console_messages` - Get console logs

### Waiting
- `mcp__playwright__browser_wait_for` - Wait for text/time

### Management
- `mcp__playwright__browser_close` - Close browser
- `mcp__playwright__browser_tabs` - Manage tabs

## Best Practices

### 1. Start with Manual Testing

Before writing automated tests:
1. Manually test in schema-tester
2. Identify critical paths
3. Note exact steps
4. Then automate

### 2. Take Screenshots

Always take screenshots at key points:
- Before and after field changes
- On validation errors
- Final state with JSON output

### 3. Use Descriptive Test Names

Good:
```
Test auth_type conditional fields - basic to apiKey transition
```

Bad:
```
Test fields
```

### 4. Test Edge Cases

- Empty values
- Required fields
- Long text
- Special characters
- Multiple conditional dependencies

### 5. Verify JSON Output

Always check the generated JSON matches expectations:
```javascript
await page.evaluate('() => {
  return componentEditor.getValue();
}');
```

## Troubleshooting

### Playwright MCP Not Found

1. Check Claude config has playwright server
2. Restart Claude completely
3. Verify `npx @executeautomation/mcp-playwright` works

### Browser Won't Start

```bash
npx playwright install chromium
```

### Schema Tester Not Loading

1. Check server is running: http://localhost:8000/schema-tester/
2. Check port 8000 not in use
3. Check schemas exist in `component_config/`

### Timing Issues

If tests are flaky:
1. Add wait times: `mcp__playwright__browser_wait_for`
2. Wait for ready state
3. Check for loading indicators

### Screenshots Not Saving

Screenshots save to `.playwright-mcp/` in your project directory. Check:
1. Directory exists
2. Permissions are correct
3. Path is relative or absolute

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Test Schemas

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Playwright
        run: npx playwright install chromium

      - name: Start Schema Tester
        run: |
          cd schema-tester
          python3 -m http.server 8000 &
          sleep 2

      - name: Run Tests
        run: |
          # Use Claude Code API or custom test script
          npx playwright test

      - name: Upload Screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: screenshots
          path: .playwright-mcp/
```

## Advanced Usage

### Custom Test Scripts

Create reusable test scripts:

```javascript
// tests/schema-conditional-fields.spec.js
const { test, expect } = require('@playwright/test');

test('auth_type conditional fields', async ({ page }) => {
  await page.goto('http://localhost:8000/schema-tester/');

  // Test basic auth
  await page.selectOption('[id="root[auth_type]"]', 'basic');
  await expect(page.locator('input[name="root[username]"]')).toBeVisible();

  // Test apiKey auth
  await page.selectOption('[id="root[auth_type]"]', 'apiKey');
  await expect(page.locator('input[name="root[username]"]')).toBeHidden();
  await expect(page.locator('input[name="root[#api_key]"]')).toBeVisible();
});
```

Run with:
```bash
npx playwright test
```

### Visual Regression Testing

Take baseline screenshots:
```bash
npx playwright test --update-snapshots
```

Compare on future runs:
```javascript
await expect(page).toHaveScreenshot('auth-basic.png');
```

## Resources

- [Playwright MCP GitHub](https://github.com/executeautomation/mcp-playwright)
- [Playwright Documentation](https://playwright.dev/)
- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- [Schema Tester README](../schema-tester/README.md)

## Examples in Action

See `VERIFICATION_SUCCESS.md` in the SAP OData extractor project for a complete example of Playwright MCP testing a real schema.

## Support

If you encounter issues:
1. Check Playwright MCP GitHub issues
2. Verify Claude configuration
3. Test with simple page first (http://example.com)
4. Check browser console for errors
