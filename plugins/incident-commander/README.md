# Incident Commander Plugin

A specialized toolkit for incident response, helping incident commanders create comprehensive post-mortem documents from Slack incident channels.

## Overview

This plugin assists senior engineers and incident commanders in writing post-mortem documents after incidents are resolved. It gathers information from Slack incident channels and creates structured post-mortem documents in Confluence following your organization's template.

## Commands

### Create Post-Mortem
**Command**: `/create-postmortem <slack-channel-name>`

Creates a post-mortem document in Confluence based on incident information gathered from a Slack channel.

**Features:**
- Reads complete Slack channel history including all threads
- Follows your organization's post-mortem template
- Generates structured sections: Overview, Impact, Timeline, Action Items, etc.
- Creates year-based directory structure in Confluence
- Includes links to monitoring, alerting, and code repositories
- Asks for clarification when information is missing

**Usage:**
```bash
/create-postmortem incident-2024-12-api-outage
```

**Prerequisites:**
- Atlassian MCP configured and authenticated (for Confluence)
- Slack MCP configured and authenticated (for reading channel messages)

## MCP Server Requirements

### Atlassian (Confluence)

```bash
claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse
```

After adding, run `/mcp` to authenticate with your Atlassian account.

### Slack

```bash
claude mcp add --transport stdio slack-mcp-server \
  --env SLACK_MCP_XOXC_TOKEN=<your-xoxc-token> \
  --env SLACK_MCP_XOXD_TOKEN=<your-xoxd-token> \
  -- npx -y slack-mcp-server
```

See the main README for instructions on obtaining Slack tokens from your browser.

## Configuration

### Confluence Page IDs

The plugin uses these default Confluence page IDs (update for your organization):

| Setting | Default Value | Description |
|---------|---------------|-------------|
| Parent Page ID | `3568009242` | Where post-mortems are stored |
| Template Page ID | `3568304146` | Post-mortem template document |

### Timezone

Default timezone is **Europe/Prague**. Update to your organization's primary timezone or use UTC for consistency.

## Post-Mortem Sections

The generated post-mortem includes these sections:

### Overview
Brief, high-level summary of the incident (1-2 sentences).

### What Can We Learn From This?
General engineering lessons that can help others avoid similar issues.

### What Happened
Description of the incident response process and actions taken.

### Impact
- **Time In**: Duration from bug introduction to resolution
- **Job Failures**: Failed data processing or background jobs
- **Projects/Customers Affected**: Scope of impact
- **Support Requests**: Related support tickets

### Responders
All participants in the incident response.

### Timeline
Major events with timestamps (in configured timezone):
- Bug introduced
- Incident detected
- Root cause identified
- Fix deployed
- Incident closed

### What Went Well?
Positive aspects of the incident response.

### What Didn't Go So Well?
Hurdles and areas for improvement.

### Action Items
3-5 specific, actionable improvements.

### Messaging
External communications: status updates, customer messages, support responses.

### Runbooks
Relevant documentation used or needed during the incident.

## Best Practices

1. **Be Concise**: Post-mortems should be brief but factual
2. **Be Blameless**: Focus on systems and processes, not individuals
3. **Be Thorough**: Read ALL Slack messages and threads before writing
4. **Be Accurate**: Verify timestamps and facts
5. **Ask When Unsure**: Request clarification for missing information
6. **Use Consistent Format**: Match existing post-mortem style
7. **Include Links**: Reference monitoring, code, and communication links

## Plugin Structure

```
plugins/incident-commander/
├── .claude-plugin/
│   └── plugin.json          # Plugin configuration
├── commands/
│   └── create-postmortem.md # Post-mortem creation command
└── README.md                # This file
```

---

**Version**: 1.0.0
**Maintainer**: Keboola :(){:|:&};: s.r.o.
**License**: MIT
