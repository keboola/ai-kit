---
name: changelog-from-linear
description: Create a changelog post from a Linear issue or project
argument-hint: [linear-issue-id or project-name]
---

You are helping create a changelog post for the Keboola platform by pulling information from Linear.

Use the changelog-writing skill from this plugin to ensure proper Keboola style and formatting.

## Workflow

### Step 1: Fetch from Linear

If the user provided $ARGUMENTS:
- If it looks like an issue ID (e.g., "KBC-123", "ENG-456"), use mcp__plugin_linear_linear__get_issue to fetch the issue
- If it looks like a project name, use mcp__plugin_linear_linear__get_project and mcp__plugin_linear_linear__list_issues to fetch related issues

If no argument provided, use AskUserQuestion to ask:
- Do you want to pull from a specific Linear issue or a project?
- What is the issue ID or project name?

### Step 2: Extract Information

From the Linear issue/project, extract:
- **Title/Summary**: The issue title or project name
- **Description**: Full description of what was built/changed
- **Labels**: Any relevant labels (feature, enhancement, deprecation, etc.)
- **Linked issues**: Related work that should be mentioned
- **Comments**: Any additional context from team discussions

If the Linear content is sparse, use AskUserQuestion to gather:
- What is the main user benefit?
- Are there any migration steps or breaking changes?
- What are the key technical details to highlight?

### Step 3: Generate Changelog

Transform the Linear content into a changelog post with:

#### Title
- Distill the Linear issue title into a compelling changelog title
- Make it attention-grabbing and benefit-focused
- Keep it concise for in-platform notifications

#### Excerpt
- One sentence capturing the essence of the change
- Pull from the issue description or craft from context

#### Post Detail
- Transform the technical Linear description into user-facing content
- Focus on benefits and value, not implementation details
- Include any migration steps or breaking changes prominently
- Use markdown formatting (headers, bullets) for readability

### Step 4: Output Format

Present the changelog in this format:

```markdown
# [Title]

**Excerpt:** [One sentence excerpt]

**Source:** Linear issue [ISSUE-ID](link) / Project: [Project Name]

---

[Post detail content]
```

### Step 5: Review and Refine

After generating, ask:
- Does this accurately represent the feature as described in Linear?
- Should any technical details be simplified for the changelog audience?
- Are there additional user benefits not captured in the Linear issue?
- Would you like to adjust the tone or add/remove sections?

### Step 6: Publish to Ghost

Once the user is satisfied with the changelog, use AskUserQuestion to ask:

"Would you like me to create this as a draft in Ghost CMS? I can use browser automation to:
- Open Ghost at https://keboola-platform-changelog.ghost.io
- Create a new post with this title, excerpt, and content
- Save it as a draft for you to review and publish"

Options:
- "Yes, create draft in Ghost" - Proceed with browser automation
- "No, I'll copy it manually" - End here with the markdown output

If they choose to publish to Ghost:

1. **Initialize Browser**
   - Use `mcp__claude-in-chrome__tabs_context_mcp` with `createIfEmpty: true`
   - Use `mcp__claude-in-chrome__tabs_create_mcp` to create a new tab

2. **Navigate to Ghost**
   - Use `mcp__claude-in-chrome__navigate` to go to: `https://keboola-platform-changelog.ghost.io/ghost/#/editor/post`
   - Take a screenshot to verify the page loaded

3. **Check Login**
   - If login page appears, ask user to log in and confirm when ready
   - Wait for user confirmation before proceeding

4. **Enter Title**
   - Find the title field (large text area at top)
   - Click and type the title

5. **Enter Content**
   - Click in the main content area
   - Type or paste the post detail content
   - Ghost's editor accepts markdown

6. **Set Excerpt**
   - Click the settings gear icon (top right)
   - Find the "Excerpt" or "Custom excerpt" field
   - Enter the excerpt text
   - Close settings

7. **Confirm**
   - Take a screenshot showing the draft
   - Inform user the draft is saved (Ghost auto-saves)
   - Provide link to edit/publish in Ghost

## Linear MCP Tools Available

- `mcp__plugin_linear_linear__get_issue` - Get issue details by ID
- `mcp__plugin_linear_linear__list_issues` - Search and filter issues
- `mcp__plugin_linear_linear__get_project` - Get project details
- `mcp__plugin_linear_linear__list_projects` - List available projects
- `mcp__plugin_linear_linear__list_comments` - Get issue comments for context

## Style Guidelines

Reference the changelog-writing skill for Keboola-specific style guidelines.
