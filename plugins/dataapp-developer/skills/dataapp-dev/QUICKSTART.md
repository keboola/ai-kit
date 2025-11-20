# Quick Start Guide

Get started with the Keboola Data App Development skill in 5 minutes.

## ⚡ Installation

This skill is included with the **dataapp-developer** plugin. If you haven't installed it yet:

```bash
/plugin install dataapp-developer
```

The skill will be automatically available once the plugin is installed.

### Prerequisites

The skill uses two MCP servers that are automatically configured:
- ✅ **Keboola MCP** - For data validation and querying (OAuth authentication on first use)
- ✅ **Playwright MCP** - For visual testing (browser installs on first use)

### Start Your Streamlit App

```bash
# In your data app directory
streamlit run streamlit_app.py

# Should see: "You can now view your Streamlit app in your browser."
# App runs at: http://localhost:8501
```

## 🎯 Using the Skill

### Automatic Activation

The skill activates automatically when you mention Keboola data app tasks:

```
"Add a filter for user type to the dashboard"
"Create a new page showing cost analysis"
"Fix the error on the users page"
"Why is the overview page loading slowly?"
```

### Explicit Invocation

You can also explicitly request the skill:

```
Use the dataapp-dev skill to add a date range filter
```

## 📝 Your First Task: Add a Simple Filter

Let's add a status filter to demonstrate the workflow.

### Ask Claude

```
Add a global filter for event status (success vs error vs all),
defaulting to success only
```

### What Will Happen

**Phase 1: VALIDATE (Claude will)**:
- Check table schema to verify "status" or "type" column
- Query distinct values to see options
- Test filter SQL: `"type" = 'success'`

**Phase 2: BUILD (Claude will)**:
- Create `get_status_filter_clause()` in `utils/data_loader.py`
- Add radio button to sidebar in `streamlit_dashboard.py`
- Import filter in all page modules
- Update all queries to use the filter

**Phase 3: VERIFY (Claude will)**:
- Open app in browser
- Test switching between Success/Error/All
- Navigate through pages
- Take screenshots showing it works
- Confirm no errors

**You'll see**: Screenshots proving the feature works before committing!

## 🔍 Example Workflows

### Adding a New Metric

```
User: Add a metric showing percentage of returning users

Claude: I'll add this metric following the validate → build → verify workflow.

Phase 1: VALIDATE
[Checks if data supports calculating returning users]
[Queries sample data to test calculation]

Phase 2: BUILD
[Adds query to appropriate page]
[Adds metric display]

Phase 3: VERIFY
[Opens app, navigates to page, takes screenshot]

✅ Complete! Here's what it looks like: [screenshot]
```

### Debugging an Issue

```
User: The overview page shows "KeyError: 'user_count'"

Claude: Let me diagnose and fix this issue.

Phase 1: VALIDATE (Diagnose)
[Reads error details]
[Checks query to see what columns are actually returned]
[Queries database to verify column names]
Found: Query returns "users" but code expects "user_count"

Phase 2: BUILD (Fix)
[Updates code to use "users" instead of "user_count"]

Phase 3: VERIFY
[Opens app, verifies page loads, no error]

✅ Fixed! Page now loads correctly.
```

### Performance Optimization

```
User: Overview page is slow (12 seconds to load)

Claude: Let me optimize the page performance.

Phase 1: VALIDATE (Diagnose)
[Identifies queries without date filters]
[Checks data volume: 2M rows]
[Tests query with EXPLAIN]

Phase 2: BUILD (Optimize)
[Adds date filter: CURRENT_DATE - INTERVAL '90 days']
[Changes SELECT * to SELECT specific columns]
[Adds WHERE clause early in query]

Phase 3: VERIFY
[Opens app, times page load]
[Confirms < 3 seconds]
[Verifies data still correct]

✅ Optimized! Load time reduced from 12s to 2.5s
```

## 🎨 Common Patterns

### Pattern 1: Add Global Filter

```
You: Add a global filter for [filter name], defaulting to [default value]

Claude will:
1. ✅ Validate column exists and check values
2. ✅ Create get_X_filter_clause() function
3. ✅ Add UI to sidebar
4. ✅ Update all page modules
5. ✅ Verify visually
6. ✅ Show screenshots
```

### Pattern 2: Create New Page

```
You: Create a new page showing [analysis type]

Claude will:
1. ✅ Check what data is available
2. ✅ Query sample data to understand structure
3. ✅ Create new page module
4. ✅ Add to navigation
5. ✅ Verify page loads and works
6. ✅ Show screenshot
```

### Pattern 3: Fix Bug

```
You: [Describe error message and location]

Claude will:
1. ✅ Read code to understand issue
2. ✅ Validate data to confirm diagnosis
3. ✅ Apply fix
4. ✅ Test with Playwright
5. ✅ Confirm fix works
```

## 📊 Expected Output

### What You'll See

When Claude uses this skill, you'll see:

**During Validation**:
```
Let me first validate the data structure...

✅ Table schema retrieved - "user_type" column exists (STRING type)
✅ Queried distinct values: 'External User', 'Keboola User'
✅ Tested filter SQL - returns 122 users, 3,151 events
```

**During Build**:
```
Now I'll implement the filter...

✅ Updated utils/data_loader.py - added get_user_type_filter_clause()
✅ Updated streamlit_dashboard.py - added UI to sidebar
✅ Updated 8 page modules - added filter to all queries
```

**During Verify**:
```
Let me verify the implementation works...

✅ Opened app in browser
✅ Filter displays correctly - "External Users Only" selected by default
✅ Tested switching to "Keboola Users Only" - data updates correctly
✅ Navigated through all pages - no errors
✅ Screenshots captured
```

### What You Get

- 📸 Screenshots showing working features
- 📊 Query results proving data exists
- ✅ Confidence that code works
- 🚀 Ready-to-commit changes

## 🎓 Learning Resources

### Included in This Skill

1. **workflow-guide.md** - Step-by-step examples
   - Adding filters
   - Creating pages
   - Fixing bugs
   - Optimizing performance

2. **best-practices.md** - Comprehensive guide
   - SQL-first architecture
   - Environment parity
   - Modular design
   - Caching strategies

3. **templates.md** - Copy-paste templates
   - Filter functions
   - Page modules
   - Queries
   - UI components

### External Resources

- [Streamlit Documentation](https://docs.streamlit.io)
- [Plotly Documentation](https://plotly.com/python/)
- [Keboola Data Apps Guide](https://help.keboola.com)

## 🚀 Next Steps

1. **Try a simple task**: Add a filter or metric
2. **Watch the workflow**: See how Claude validates → builds → verifies
3. **Review screenshots**: Visual proof helps you understand
4. **Study the code**: Learn patterns Claude follows
5. **Build more**: Create complex features with confidence

## 💬 Tips for Success

### Get the Most from This Skill

1. **Be specific**: "Add filter defaulting to X" vs "add a filter"
2. **Trust the process**: Let Claude validate before building
3. **Review screenshots**: Visual verification catches issues
4. **Ask questions**: "Why did you choose this approach?"
5. **Request examples**: "Show me how to do X using this pattern"

### When Things Go Wrong

1. **Share error messages**: Copy full stack traces
2. **Describe what you see**: "Users page shows error"
3. **Mention recent changes**: "After adding the filter..."
4. **Let Claude diagnose**: The skill will check data first

## ✅ Quick Checklist

Before starting development with this skill:

- [ ] Plugin installed: `/plugin install dataapp-developer`
- [ ] Keboola MCP authenticated (OAuth on first use)
- [ ] Streamlit app running on localhost:8501
- [ ] You understand the 3-phase workflow
- [ ] You're ready to see Claude validate before coding

After Claude completes a task:

- [ ] You reviewed the screenshots
- [ ] You understand what changed
- [ ] You verified the explanation makes sense
- [ ] You're ready to commit the changes

## 🎉 You're Ready!

Start building Keboola data apps with confidence. The skill will:
- ✅ Check your data first
- ✅ Write correct code
- ✅ Test visually
- ✅ Show proof it works

Just describe what you want, and let the skill guide the implementation!

---

**Need help?** See the other reference docs or ask Claude:
- "Explain how the validate phase works"
- "Show me an example of adding a filter"
- "What are the best practices for queries?"
