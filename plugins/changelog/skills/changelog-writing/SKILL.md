---
name: Keboola Changelog Writing
description: Use this skill when writing changelog posts for the Keboola platform. It provides style guidelines, tone guidance, and formatting conventions based on existing Keboola changelogs.
version: 1.0.0
---

# Keboola Changelog Writing Style Guide

This skill provides the authoritative style guidelines for writing Keboola platform changelog posts.

## Post Structure

Every changelog post has three required components:

### 1. Title

**Purpose:** Displayed in platform notifications and as the post headline.

**Guidelines:**
- Short, poignant, and concise
- Attention-grabbing to encourage clicks
- Use action-oriented language
- Highlight the key benefit or change
- Can use em-dash (—) to add context or subtitle

**Good Examples:**
- "Faster, Smarter CDC Components—MySQL CDC Connector Now Generally Available"
- "Multiple Schedules per Flow"
- "Buffer API Deprecation & Migration to Data Streams"

**Avoid:**
- Generic titles like "New Feature Release"
- Overly long titles that get truncated
- Technical jargon without context

### 2. Excerpt

**Purpose:** Short summary displayed alongside the title and in post previews.

**Guidelines:**
- One sentence (occasionally two short ones)
- Captures the main announcement
- Complements the title—don't just repeat it
- Should NOT duplicate the first sentence of the detail section
- Summarizes the "what" and hints at the "why"

**Good Examples:**
- "We are announcing the deprecation of the Buffer API and encouraging users to migrate to the new Data Streams feature for improved performance and reliability."
- "Our MySQL Change Data Capture (CDC) component is now generally available, featuring column masks, filters, resumable snapshots, and improved performance for faster, more reliable data replication."
- "The recent update to Flows introduces a frequently requested feature: the ability to set multiple schedules per flow."

### 3. Post Detail

**Purpose:** Full description of the feature, change, or announcement.

**Guidelines:**
- 2-5 paragraphs typically
- Start with context about what changed
- Explain the value to users
- Include technical details where helpful
- Use markdown formatting for structure

## Tone and Voice

### Do:
- Be informative and clear
- Be professional but approachable
- Be direct about what changed and why
- Express genuine enthusiasm for improvements
- Thank users when appropriate (deprecations, migrations)
- Use "we" when speaking as Keboola
- Use "you" when addressing the user

### Don't:
- Be overly formal or stiff
- Be too casual or use slang
- Use excessive exclamation points
- Over-promise or use hyperbole
- Bury important information (breaking changes, deadlines)

### Tone Examples:
- Good: "We would like to inform you that our Buffer API is being deprecated as part of our commitment to providing you with the best tools and services."
- Good: "We're excited for you to experience the benefits of Data Streams!"
- Avoid: "AMAZING NEWS! This is the BEST feature EVER!"

## Formatting Conventions

### Headers (###)
Use for organizing sections within post detail:
- "Why the change?"
- "New Features:"
- "How to migrate:"
- "What you need to do:"

### Bullet Points
Use for:
- Feature lists
- Step-by-step instructions
- Multiple options or benefits

**Format:**
```markdown
### New Features:
- **Feature Name:** Description of what it does.
- **Another Feature:** Description with user benefit.
```

### Bold Text
Use for:
- Feature names within bullets
- Emphasis on key terms
- Important warnings or deadlines

### Code Formatting
Use backticks for:
- Table names: `kbc_snowflake_stats`
- Technical terms: `primary key`
- Configuration values

### Links
- Link to relevant documentation when helpful
- Don't overload with links

## Content Patterns by Type

### New Feature Announcement
1. Open with what the feature is
2. Explain why it matters / what problem it solves
3. List key capabilities (bullets)
4. Mention how to access or enable it
5. Optional: Invite feedback

### Deprecation Notice
1. State what is being deprecated
2. Give the deprecation date/timeline
3. Explain the replacement (if any)
4. Provide migration steps
5. Offer support contact
6. Thank users for understanding

### Enhancement/Improvement
1. Reference the existing feature
2. Describe what's new or improved
3. Highlight the benefit
4. Note any changes to existing behavior

### Breaking Change / Important Update
1. Lead with the change and its impact
2. Explain why the change is necessary
3. Provide clear action items
4. Include any deadlines
5. Apologize for inconvenience if appropriate
6. Offer support

## Common Phrases and Vocabulary

### Openers:
- "We would like to inform you..."
- "We are announcing..."
- "The recent update to [Feature] introduces..."
- "We want to inform you about..."

### Benefits Language:
- "Enhanced performance"
- "Improved reliability"
- "Greater flexibility"
- "Streamlined experience"
- "More intuitive"

### Calls to Action:
- "Please review your workflows and adjust any dependencies..."
- "Our support team is here to help you every step of the way."
- "If you have questions or need assistance, please don't hesitate to submit a support ticket."
- "We look forward to your feedback as you explore these enhancements!"

### Closings:
- "Thank you for your understanding and for being a valued part of the Keboola community."
- "Thank you for your understanding and patience!"
- "We sincerely apologize for any inconvenience this may cause."

## Example Templates

### Feature Announcement Template
```markdown
# [Feature Name]—[Key Benefit or Status]

**Excerpt:** [One sentence describing the feature and its main benefit.]

---

[Opening paragraph explaining what the feature is and why it matters.]

### [Key Section, e.g., "New Features:"]
- **[Feature 1]:** [Description]
- **[Feature 2]:** [Description]
- **[Feature 3]:** [Description]

[Closing paragraph with call to action or next steps.]
```

### Deprecation Template
```markdown
# [Feature Name] Deprecation & Migration to [New Feature]

**Excerpt:** We are announcing the deprecation of [old feature] and encouraging users to migrate to [new feature] for [key benefit].

---

We would like to inform you that [old feature] is being deprecated as part of our commitment to providing you with the best tools and services. Effective [date], [old feature] will no longer be available.

To ensure a seamless transition, we are introducing [new feature], [brief description of replacement].

### Why the change?
- **[Benefit 1]:** [Description]
- **[Benefit 2]:** [Description]

### How to migrate:
[Migration instructions]

### What you need to do:
1. [Step 1]
2. [Step 2]

Our support team is here to help you every step of the way. If you have any questions or concerns about the migration, feel free to reach out to us.

Thank you for your understanding and for being a valued part of the Keboola community.
```

## Ghost CMS Considerations

When preparing content for Ghost CMS (https://keboola-platform-changelog.ghost.io/):
- The title goes in the Ghost post title field
- The excerpt goes in the Ghost excerpt/custom excerpt field
- The post detail is the main content body
- Ghost supports full markdown including headers, bullets, bold, code blocks
- Images can be added through Ghost's editor
