---
name: changelog
description: Create a Keboola platform changelog post with interactive guidance
argument-hint: [optional: brief feature description]
---

You are helping create a changelog post for the Keboola platform. Changelog posts announce new features and functionalities.

Use the changelog-writing skill from this plugin to ensure proper Keboola style and formatting.

## Workflow

### Step 1: Gather Information

If the user provided a description via $ARGUMENTS, use that as a starting point. Otherwise, ask.

Use the AskUserQuestion tool to gather the following information interactively:

1. **Feature Category** - Ask what type of announcement this is:
   - New feature
   - Enhancement to existing feature
   - Deprecation/migration notice
   - Important update/breaking change
   - Bug fix (if significant enough for changelog)

2. **Feature Details** - Ask for:
   - What is the feature/change?
   - What problem does it solve for users?
   - What are the key benefits or improvements?

3. **Technical Details** (if applicable) - Ask about:
   - Any migration steps required?
   - Any breaking changes?
   - New capabilities or options?

4. **Target Audience** - Ask who this is most relevant for:
   - All users
   - Data engineers
   - Admins/project managers
   - Developers using specific components

### Step 2: Generate Changelog

Once you have the information, generate the changelog post with these three sections:

#### Title
- Short, attention-grabbing, poignant
- Should work as an in-platform notification
- Use action words and highlight the key benefit
- Examples of good titles:
  - "Faster, Smarter CDC Components—MySQL CDC Connector Now Generally Available"
  - "Multiple Schedules per Flow"
  - "Buffer API Deprecation & Migration to Data Streams"

#### Excerpt
- One short sentence summarizing the announcement
- Should complement (not duplicate) the first sentence of the detail
- Captures the essence of what changed and why it matters

#### Post Detail
- 2-4 paragraphs describing the feature
- Start with context about what changed
- Highlight the value to users
- Include bullet lists for features, steps, or options when helpful
- Use markdown headers (###) to organize sections if needed
- Tone: Professional, informative, catchy but not overly informal
- End with a call to action or next steps if appropriate

### Step 3: Output Format

Present the changelog in this markdown format:

```markdown
# [Title]

**Excerpt:** [One sentence excerpt]

---

[Post detail content with proper markdown formatting]
```

### Step 4: Offer Refinements

After generating, ask if the user wants to:
- Adjust the tone (more/less formal)
- Add or remove technical details
- Modify specific sections

### Step 5: Publish to Ghost

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

## Style Guidelines

Reference the changelog-writing skill for detailed Keboola style guidelines including:
- Vocabulary preferences
- Formatting conventions
- Tone and voice
- Structure patterns from existing changelogs
