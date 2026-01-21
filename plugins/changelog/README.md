# Keboola Changelog Plugin

A Claude Code plugin for creating changelog posts for the Keboola platform in the official style.

## Installation

Add this plugin to your Claude Code installation:

```bash
# From the plugin directory
claude plugins add ./keboola-changelog-plugin

# Or if published
claude plugins add keboola-changelog
```

## Features

### Commands

#### `/changelog [description]`
Interactive changelog creation with guided Q&A workflow.

**Usage:**
```
/changelog
/changelog New CDC connector with column masking
```

The command will ask you about:
- Feature category (new feature, enhancement, deprecation, etc.)
- Feature details and benefits
- Technical details and migration steps
- Target audience

Then generates a complete changelog post with title, excerpt, and post detail.

#### `/changelog-from-linear [issue-id or project-name]`
Create a changelog by pulling information from Linear issues or projects.

**Usage:**
```
/changelog-from-linear KBC-1234
/changelog-from-linear "CDC Improvements"
```

Automatically extracts:
- Issue title and description
- Related issues and context
- Team comments for additional detail

### Skill: Changelog Writing

The plugin includes a comprehensive style guide that Claude uses automatically when writing changelogs. It covers:

- **Title guidelines** - Short, attention-grabbing, benefit-focused
- **Excerpt guidelines** - One-sentence summary that complements the title
- **Post detail structure** - Professional tone, proper formatting, clear organization
- **Tone and voice** - Professional but approachable, direct, user-focused
- **Formatting conventions** - Headers, bullets, bold, code formatting
- **Templates** - For different changelog types (feature, deprecation, enhancement)

### Agent: Changelog Writer

For complex changelogs involving multiple features or requiring research, use the changelog-writer agent:

```
Use the changelog-writer agent to create a comprehensive changelog for the Q4 CDC improvements
```

The agent will:
- Research Linear issues and projects
- Gather context from documentation
- Ask clarifying questions
- Create a polished changelog post
- Optionally publish directly to Ghost CMS

#### `/publish-to-ghost`
Standalone command to publish changelog content directly to Ghost CMS using browser automation.

**Usage:**
```
/publish-to-ghost
```

Use this when you already have changelog content and just want to push it to Ghost.

## Ghost CMS Integration

The plugin includes browser automation to publish directly to Ghost CMS at `https://keboola-platform-changelog.ghost.io`.

### How It Works

After generating a changelog, you'll be asked if you want to publish to Ghost. If yes:

1. **Browser opens** - A new Chrome tab opens to Ghost
2. **Login check** - If not logged in, you'll be prompted to authenticate
3. **Content entry** - Title, content, and excerpt are automatically entered
4. **Draft saved** - Ghost auto-saves; your post is ready to review and publish

### Requirements

- **Claude in Chrome extension** - Must be installed and connected
- **Ghost access** - You need login credentials for the Keboola Ghost CMS
- **Chrome browser** - Browser automation works with Chrome

### Manual Fallback

If browser automation isn't available or you prefer manual entry:
- All commands output clean markdown
- Copy the title to Ghost's title field
- Copy the excerpt to the "Custom excerpt" in post settings
- Paste the content into the editor

## Output Format

All changelogs are generated in markdown, ready for Ghost CMS:

```markdown
# [Title]

**Excerpt:** [One sentence excerpt]

---

[Post detail content with proper markdown formatting]
```

### Copying to Ghost

1. **Title** → Ghost post title field
2. **Excerpt** → Ghost excerpt/custom excerpt field
3. **Post Detail** → Ghost content body (supports full markdown)

## Style Examples

### Good Titles
- "Faster, Smarter CDC Components—MySQL CDC Connector Now Generally Available"
- "Multiple Schedules per Flow"
- "Buffer API Deprecation & Migration to Data Streams"

### Good Excerpts
- "We are announcing the deprecation of the Buffer API and encouraging users to migrate to the new Data Streams feature for improved performance and reliability."
- "The recent update to Flows introduces a frequently requested feature: the ability to set multiple schedules per flow."

## Requirements

- Claude Code CLI
- Linear MCP integration (for `/changelog-from-linear`)
- Claude in Chrome extension (for Ghost CMS publishing)

## Configuration

No additional configuration required. The plugin uses your existing Linear MCP connection.

## Contributing

To modify the style guidelines, edit:
- `skills/changelog-writing/SKILL.md` - Style guide and templates
- `commands/changelog.md` - Interactive workflow
- `agents/changelog-writer.md` - Agent capabilities
