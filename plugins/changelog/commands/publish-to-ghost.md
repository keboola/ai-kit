---
name: publish-to-ghost
description: Publish a changelog draft directly to Ghost CMS using browser automation
argument-hint: [optional: "title" "excerpt" "content" or use from conversation]
---

You are helping publish a changelog post to the Keboola Ghost CMS at https://keboola-platform-changelog.ghost.io/

## Prerequisites

Before starting, ensure you have:
1. The changelog content (title, excerpt, post detail) - either from the conversation or provided as arguments
2. Access to Ghost CMS (user must be logged in or able to log in)

## Workflow

### Step 1: Prepare Content

If changelog content was just generated in this conversation, use that.

If not, use AskUserQuestion to ask:
- What is the changelog title?
- What is the excerpt (one sentence summary)?
- What is the post detail content?

Store these as:
- `title`: The post title
- `excerpt`: The short excerpt/summary
- `content`: The full post detail (markdown)

### Step 2: Initialize Browser

First, get the browser context:
```
Use mcp__claude-in-chrome__tabs_context_mcp with createIfEmpty: true
```

Then create a new tab for Ghost:
```
Use mcp__claude-in-chrome__tabs_create_mcp
```

### Step 3: Navigate to Ghost Editor

Navigate to the Ghost new post editor:
```
Use mcp__claude-in-chrome__navigate to: https://keboola-platform-changelog.ghost.io/ghost/#/editor/post
```

Wait for the page to load, then take a screenshot to verify the editor is visible.

### Step 4: Check Login Status

Take a screenshot to see the current state:
```
Use mcp__claude-in-chrome__computer with action: screenshot
```

If you see a login page:
- Inform the user they need to log in
- Wait for them to complete login
- Use AskUserQuestion: "Please log in to Ghost CMS. Let me know when you're ready to continue."

### Step 5: Enter the Title

Once in the editor, the title field should be at the top.

Use mcp__claude-in-chrome__find to locate the title input field (usually a large text area at the top with placeholder like "Post title").

Click on the title field and type the title:
```
Use mcp__claude-in-chrome__computer with action: left_click on the title field
Use mcp__claude-in-chrome__computer with action: type with text: [the title]
```

### Step 6: Enter the Content

Click in the main content area (below the title) and enter the post content.

The Ghost editor uses a block-based editor. Click in the content area and type the content:
```
Use mcp__claude-in-chrome__computer with action: left_click on content area
Use mcp__claude-in-chrome__computer with action: type with text: [the content]
```

Note: Ghost's Koenig editor supports markdown. You can paste markdown directly and it will be converted.

### Step 7: Set the Excerpt

The excerpt is in the post settings sidebar:

1. Find and click the settings gear icon (usually top right)
2. Look for "Excerpt" or "Custom excerpt" field
3. Enter the excerpt text

```
Use mcp__claude-in-chrome__find to locate "settings" or gear icon
Use mcp__claude-in-chrome__computer to click it
Use mcp__claude-in-chrome__find to locate excerpt field
Use mcp__claude-in-chrome__form_input or computer type to enter excerpt
```

### Step 8: Verify and Confirm

Take a screenshot to show the user the draft:
```
Use mcp__claude-in-chrome__computer with action: screenshot
```

Ask the user to confirm:
- "I've created the draft in Ghost. The post will auto-save. Would you like me to make any changes, or are you ready to review it in Ghost?"

### Step 9: Final Status

Report to the user:
- Draft created successfully
- Post is saved (Ghost auto-saves)
- They can review, edit, and publish from Ghost

## Important Notes

- Ghost auto-saves drafts, so the content is preserved even if you navigate away
- The post will be in "Draft" status until the user publishes it
- Always take screenshots to verify each step succeeded
- If any step fails, report to the user and offer to retry or continue manually

## Error Handling

If the browser automation encounters issues:
1. Take a screenshot to see current state
2. Report what went wrong
3. Offer alternatives:
   - Retry the failed step
   - Output the content for manual copy-paste
   - Continue from where it left off
