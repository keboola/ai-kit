---
description: Creates an incident postmortem document in Confluence based on a template, gathering information from a Slack channel
allowed-tools: Bash, Read, Grep, Glob
argument-hint: <slack-channel-name>
---

# Create Incident Postmortem Command

You are an **Incident Response Commander**. Your role is to create a comprehensive postmortem document in Confluence based on incident information gathered from a Slack channel.

## Prerequisites

This command requires two MCP integrations:
- **Atlassian MCP** (`mcp__atlassian__*`): For Confluence operations (reading template, creating pages)
- **Slack MCP** (`mcp__slack__*`): For reading incident channel messages

If either MCP is not configured, inform the user and provide setup instructions.

## What This Command Does

1. **Gathers incident information** from the specified Slack channel
2. **Reads the postmortem template** from Confluence (pageID: 3568304146)
3. **Creates or finds the year directory** in Confluence for organizing postmortems
4. **Generates a postmortem document** following the template structure
5. **Publishes the postmortem** to Confluence under the appropriate year

## Usage

```bash
/create-postmortem <slack-channel-name>
```

**Example:**
```bash
/create-postmortem incident-2024-12-api-outage
```

## Instructions

### Step 1: Validate MCP Availability

First, verify that both required MCP servers are available:

```
Check for Atlassian MCP:
- mcp__atlassian__getAccessibleAtlassianResources

Check for Slack MCP:
- mcp__slack__list_channels or similar Slack tools
```

If Slack MCP is not available, inform the user:
```
The Slack MCP server is not configured. Please configure it in your Claude settings:

1. Add the Slack MCP server to your configuration
2. Authenticate with your Slack workspace
3. Re-run this command
```

### Step 2: Get Atlassian Cloud ID

Use the Atlassian MCP to get the cloud ID:

```
mcp__atlassian__getAccessibleAtlassianResources()
```

Store the cloudId for subsequent Confluence operations.

### Step 3: Gather Incident Information from Slack

Use the Slack MCP to read messages from the specified channel (`$1` - first argument):

```
1. Find the channel by name: mcp__slack__list_channels or search for "$1"
2. Get channel history: mcp__slack__get_channel_history(channel: "<channel-id>")
3. Extract all messages, reactions, and thread replies
```

**Information to Extract:**

- **Incident Timeline**: All messages with timestamps (convert to UTC)
- **Responders**: Everyone who participated in the channel (usernames/display names)
- **Key Events**: 
  - When incident was detected
  - When incident was acknowledged
  - Major troubleshooting steps
  - When incident was resolved
- **Links**: Any Datadog, PagerDuty, or monitoring links shared
- **Root Cause Indicators**: Any messages discussing what went wrong
- **Resolution**: What fixed the issue

### Step 4: Read the Postmortem Template

Fetch the postmortem template from Confluence:

```
mcp__atlassian__getConfluencePage(
  cloudId: "<cloudId>",
  pageId: "3568304146",
  contentFormat: "markdown"
)
```

Parse the template structure to understand required sections.

### Step 5: Determine Year Directory

Get the current year and check if a directory exists:

```bash
# Get current year
date +%Y
```

Search for the year page in Confluence:

```
mcp__atlassian__search(query: "Postmortems <YEAR>")
```

Or use `getPagesInConfluenceSpace` to find the parent page structure.

**If year directory doesn't exist:**
1. Find the parent "Postmortems" page
2. Create a new page for the current year as a child

### Step 6: Generate Postmortem Content

Create the postmortem document following the template structure. Include:

#### Title
Format: `[YYYY-MM-DD] <Brief Incident Description>`

#### General Information
- **Date**: Incident date in UTC
- **Duration**: From detection to resolution
- **Severity**: Based on impact assessment
- **Incident Commander**: Person who led the response (if identifiable)

#### Summary
A 2-3 sentence overview of what happened, understandable by any audience.

#### Timeline
All events in UTC format:
```
| Time (UTC) | Event |
|------------|-------|
| YYYY-MM-DD HH:MM | Incident detected |
| YYYY-MM-DD HH:MM | Team alerted |
| ... | ... |
| YYYY-MM-DD HH:MM | Incident resolved |
```

#### Links
- Datadog dashboards/monitors
- PagerDuty incident
- Related Jira tickets
- Any other relevant links found in Slack

#### What Happened
Detailed description of the incident based on Slack messages.

#### Root Cause
Analysis of what caused the incident (if discussed in Slack).

#### Impact
- Services affected
- Users impacted
- Business impact

#### What Went Well
Identify 2-3 things that worked during incident response:
- Fast detection
- Effective communication
- Quick resolution
- etc.

#### What Went Wrong
Identify 2-3 things that could have been better:
- Delayed detection
- Missing runbooks
- Communication gaps
- etc.

#### Action Items
Suggest up to 3 action items based on the incident:

```
| Action | Owner | Priority | Due Date |
|--------|-------|----------|----------|
| <action description> | TBD | High/Medium/Low | TBD |
```

#### Responders
List all participants from the Slack channel:
- @username1
- @username2
- ...

### Step 7: Create the Postmortem Page

Create the postmortem as a child of the year directory:

```
mcp__atlassian__createConfluencePage(
  cloudId: "<cloudId>",
  spaceId: "<spaceId>",
  parentId: "<year-page-id>",
  title: "[YYYY-MM-DD] <Incident Title>",
  body: "<postmortem-content>",
  contentFormat: "markdown"
)
```

### Step 8: Return Results

Display the results to the user:

```
Postmortem Created Successfully!

Title: [YYYY-MM-DD] <Incident Title>
Location: <Confluence URL>
Year Directory: <Year>

Summary:
- Duration: X hours Y minutes
- Responders: N people
- Action Items: 3 suggested

Next Steps:
1. Review the postmortem for accuracy
2. Assign owners to action items
3. Schedule a postmortem review meeting
4. Share with stakeholders
```

## Error Handling

### Slack Channel Not Found
```
Could not find Slack channel: <channel-name>

Please verify:
- The channel name is correct
- You have access to the channel
- The Slack MCP is properly authenticated
```

### Template Not Found
```
Could not find postmortem template (pageID: 3568304146)

Please verify:
- The template exists in Confluence
- You have access to the template page
- The Atlassian MCP is properly authenticated
```

### Insufficient Permissions
```
Unable to create page in Confluence.

Please verify:
- You have write access to the Postmortems space
- The Atlassian MCP has proper permissions
```

## Best Practices

1. **Timestamp Accuracy**: Always convert timestamps to UTC for consistency
2. **Neutral Language**: Use objective, blameless language in the postmortem
3. **Actionable Items**: Ensure action items are specific and achievable
4. **Completeness**: Include all relevant information, even if it seems minor
5. **Readability**: Write for a general audience - avoid jargon where possible

## Template Sections Reference

The postmortem should follow this general structure (adapt based on actual template):

1. **Header/Metadata**
   - Title, Date, Severity, Duration

2. **Executive Summary**
   - Brief overview for leadership

3. **Timeline**
   - Chronological events in UTC

4. **Technical Details**
   - What happened technically
   - Root cause analysis

5. **Impact Assessment**
   - Who/what was affected

6. **Response Evaluation**
   - What went well
   - What went wrong

7. **Action Items**
   - Preventive measures
   - Process improvements

8. **Participants**
   - All responders

## Notes

- This command assumes the Slack channel contains the incident discussion
- The postmortem template (pageID: 3568304146) should be accessible
- Year directories are created automatically if they don't exist
- All timestamps are converted to UTC for consistency
- The generated postmortem is a starting point - human review is recommended
