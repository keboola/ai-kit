---
description: Creates a post-mortem document in Confluence based on incident information from a Slack channel
allowed-tools: Bash, Read, Grep, Glob
argument-hint: <slack-channel-name>
---

# Create Post-Mortem Command

You work in a senior engineering role in a software company and you are helping an incident commander write a post-mortem after an incident is finished.

All communication regarding the incident should be in a Slack channel. Use the provided slack channel argument to get all relevant info of the incident. Read the whole conversations and read also all threads carefully and consider any image attachments if available. Things change in time, we often test hypotheses on the go and the results may be completely different from where we started. Time of each message is important to understand what was going on. Also we may try many dead ends.

You are tasked to write a post-mortem document about the incident. Be very concise, brief but factual. You will be given a post-mortem template document and instructions for each point in the post-mortem. You will then save it to Confluence under the configured parent page (and a subpage with incident year number).

## Prerequisites

This command requires two MCP integrations:
- **Atlassian MCP** (`mcp__atlassian__*`): For Confluence operations (reading template, creating pages)
- **Slack MCP** (`mcp__slack__*`): For reading incident channel messages

If either MCP is not configured, inform the user and ask them to run `/mcp` to configure and authenticate.

## Configuration

**Default Confluence Page IDs (update for your organization):**
- **Parent Page ID**: `3568009242` - Where post-mortems are stored
- **Template Page ID**: `3568304146` - Post-mortem template document

**Default Timezone**: Europe/Prague (change to your organization's primary timezone or UTC)

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

If any MCP is not available, inform the user to run `/mcp` to configure and authenticate.

### Step 2: Get Atlassian Cloud ID

Use the Atlassian MCP to get the cloud ID:

```
mcp__atlassian__getAccessibleAtlassianResources()
```

Store the cloudId for subsequent Confluence operations.

### Step 3: Gather Incident Information from Slack

Use the Slack MCP to read ALL messages from the specified channel (`$1` - first argument):

1. Find the channel by name using Slack MCP tools
2. Get complete channel history including all threads
3. Consider image attachments if the MCP provides them

**Critical: Read everything carefully.** Things change during incident response - initial hypotheses may be completely wrong, and the final root cause may be very different from early assumptions. Pay attention to timestamps to understand the sequence of events.

### Step 4: Read the Post-Mortem Template

Fetch the post-mortem template from Confluence:

```
mcp__atlassian__getConfluencePage(
  cloudId: "<cloudId>",
  pageId: "3568304146",
  contentFormat: "markdown"
)
```

The template contains info blocks with basic instructions for each section.

### Step 5: Determine Year Directory

Get the current year and check if a directory exists under the parent page:

```bash
date +%Y
```

Search for or create the year page as a child of the parent page (ID: 3568009242).

### Step 6: Generate Post-Mortem Content

Follow these detailed instructions for each section:

---

#### Overview
Be very short, focus on the big picture. One to two sentences maximum describing what happened at a high level.

---

#### What Can We Learn From This?
**Fill this section LAST but position it here in the document.**

These should be general engineering ideas or tips that can help other engineers in the company avoid similar issues in different scenarios. You do not need any subject expertise to understand what will help you. Think about lessons that are broadly applicable.

---

#### What Happened
Description of the incident response process and actions taken. Focus on the sequence of events during the response, what was tried, what worked, and what didn't.

---

#### Impact

Document the following:

- **Time In**: From when the bug was **INTRODUCED** (NOT identified or reported) until resolution. Look for mentions of PRs or deployments that introduced the bug and check when they were merged/deployed. If you do not have this information, **ask the user explicitly**.

- **Job Failures**: Look for failed data processing jobs, background jobs, pipeline runs, or any job queue failures mentioned in the channel.

- **Projects/Customers Affected**: How many projects, customers, or systems were affected. If applicable, note how many environments or regions were impacted.

- **Support Requests Raised**: Look for support tickets (e.g., from Jira, Zendesk) that were pasted into the Slack channel. List all of them here with links if available.

---

#### Responders
Mention ALL people that participated in the Slack channel during the incident response.

---

#### Timeline

Use the organization's primary timezone (default: Europe/Prague). Do not focus too much on minute-by-minute details during active incident response. List only major events:

- Incident created/detected
- Status page updated
- Root cause identified
- Fix released/deployed
- Incident closed

**Also include important events OUTSIDE the incident response timeline:**
- Time when the bug was introduced (PR merged, deployment)
- First support ticket received
- First error logged
- Any other significant precursor events

Format as a table with timestamps and descriptions.

---

#### What Went Well?
Look in the chat for positive aspects:
- How fast was the issue identified?
- Was there sufficient monitoring/alerting?
- Did communication flow smoothly?
- Were runbooks helpful?
- Did the team collaborate effectively?

---

#### What Didn't Go So Well?
List any hurdles identified in the chat:
- Delays in detection or response
- Missing documentation or runbooks
- Communication gaps
- Tooling issues
- Knowledge gaps

---

#### Action Items
List 3 to 5 things mentioned in the chat that need improving or were significantly worse than during other incidents. Each action item should be:
- Specific and actionable
- Assigned to a team or individual if mentioned
- Prioritized if possible

---

#### Messaging
Look for ALL mentions of:
- Public status page updates
- Messages to customer channels
- Support ticket responses
- External communications

List them here with timestamps and content summaries.

---

#### Runbooks
Look for mentions of relevant runbooks (documents from GitHub, Confluence, or other documentation systems) that were used or should have been used during the incident.

---

### Step 7: Cross-Reference with Recent Post-Mortems

When in doubt about anything:
1. Ask the user to fill in missing information
2. Look at other recent post-mortem documents in Confluence
3. Use the same format and wording as existing post-mortems for consistency

### Step 8: Add Links

When writing, accompany all important events with relevant links to:
- Monitoring dashboards (Datadog, Grafana, etc.)
- Alerting systems (PagerDuty, OpsGenie, etc.)
- Code repositories (GitHub PRs, commits)
- Slack messages (permalinks)
- Support tickets
- Any other relevant resources

### Step 9: Create the Post-Mortem Page

Create the post-mortem as a child of the year directory:

```
mcp__atlassian__createConfluencePage(
  cloudId: "<cloudId>",
  spaceId: "<spaceId>",
  parentId: "<year-page-id>",
  title: "[YYYY-MM-DD] <Brief Incident Description>",
  body: "<postmortem-content>",
  contentFormat: "markdown"
)
```

### Step 10: Return Results

Display the results to the user:

```
Post-Mortem Created Successfully!

Title: [YYYY-MM-DD] <Incident Title>
Location: <Confluence URL>
Year Directory: <Year>

Summary:
- Duration: X hours Y minutes (from bug introduction to resolution)
- Responders: N people
- Action Items: N items

Next Steps:
1. Review the post-mortem for accuracy
2. Fill in any missing information (marked with [TODO])
3. Assign owners to action items
4. Schedule a post-mortem review meeting
5. Share with stakeholders
```

## Error Handling

### Slack Channel Not Found
```
Could not find Slack channel: <channel-name>

Please verify:
- The channel name is correct
- You have access to the channel
- The Slack MCP is properly authenticated (run /mcp)
```

### Template Not Found
```
Could not find post-mortem template (pageID: 3568304146)

Please verify:
- The template exists in Confluence
- You have access to the template page
- Update the template pageID in the command configuration
```

### Missing Information
If critical information cannot be found in the Slack channel, explicitly ask the user:
```
I could not find the following information in the Slack channel:
- [List missing items]

Please provide this information or point me to where I can find it.
```

## Best Practices

1. **Be Concise**: Post-mortems should be brief but factual
2. **Be Blameless**: Focus on systems and processes, not individuals
3. **Be Thorough**: Read ALL messages and threads before writing
4. **Be Accurate**: Verify timestamps and facts
5. **Ask When Unsure**: If information is missing or unclear, ask the user
6. **Use Consistent Format**: Match the style of existing post-mortems
7. **Include Links**: Every significant event should have supporting links

## Notes

- The Slack channel should contain the complete incident discussion
- The post-mortem template should be accessible in Confluence
- Year directories are created automatically if they don't exist
- All timestamps use the configured timezone (default: Europe/Prague)
- The generated post-mortem is a starting point - human review is essential
- When in doubt, consult recent post-mortems for format and wording guidance
