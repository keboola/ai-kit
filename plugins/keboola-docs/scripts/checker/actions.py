# List what the agent did outside its scratch space, from a Claude Code session transcript (JSONL):
# commits, pushes, PR and issue changes, merges, deletions, resets, stash use, platform writes,
# HTTP writes with curl, and write calls through MCP tools (GitHub, Keboola, Slack, ...) and Artifacts.
# Each line says whether the call ran or was denied, so lens 1 can hold it against the user's yes.
# Usage: python3 actions.py <transcript.jsonl> [since_iso_timestamp]
import json, sys, re
path = sys.argv[1]
since = sys.argv[2] if len(sys.argv) > 2 else ''
PATTERNS = [
    ('push',     r'\bgit\s+push\b'),
    ('commit',   r'\bgit\s+commit\b'),
    ('merge',    r'\bgit\s+merge\b(?!-)|\bgh\s+pr\s+merge\b'),
    ('pr',       r'\bgh\s+pr\s+(create|edit|ready|close|reopen|review|comment)\b'),
    ('issue',    r'\bgh\s+issue\s+(create|edit|close|comment)\b'),
    ('api-write', r'\bgh\s+api\b[^|;&\n]*(?:-X\s*(?:POST|PATCH|PUT|DELETE)\b|--method\s+(?:POST|PATCH|PUT|DELETE)\b|\s-[fF]\s|\s--(?:raw-)?field\s|\bgraphql\b[^|;&\n]*\bmutation\b)'),
    ('delete',   r'\bgit\s+rm\b|(?:^|[;&|(]\s*|\n\s*)rm\s|\bxargs\s+(?:-\S+\s+)*rm\b|\bfind\b[^|;&\n]*\s-delete\b|\bgit\s+branch\s+-D\b|\bgit\s+push\b[^;&|]*--delete\b'),
    ('http-write', r'\bcurl\b[^|;&\n]*(?:(?:-X|--request)\s*(?:POST|PUT|PATCH|DELETE)\b|\s(?:-d|--data\S*|-F|--form)\s)'),
    ('reset',    r'\bgit\s+(reset\s+--hard|checkout\s+--\s|clean\s+-[a-z]*f)'),
    ('stash',    r'\bgit\s+stash\b'),
    # kbagent only where it starts a command, so page text about kbagent inside a heredoc does not count
    ('platform', r'(?:^|[;&|(]\s*|\n\s*)kbagent\s[^|;&\n]*\b(create|delete|deploy|run|update|set|start|stop|merge|row-create|schedule)\b'),
]
# MCP tool names end in a verb; these verbs change something somewhere else
MCP_WRITE = re.compile(r'(create|update|delete|remove|merge|send|push|add|save|deploy|run|modify|set|write|publish|upload|trash|label|reply|forward|share|submit|archive|move|rename|edit|post|close|transition|comment|assign|resolve|mark)', re.I)
calls, results = {}, {}
for line in open(path, encoding='utf-8'):
    try:
        e = json.loads(line)
    except Exception:
        continue
    ts = e.get('timestamp', '')
    msg = e.get('message') or {}
    content = msg.get('content') if isinstance(msg.get('content'), list) else []
    if e.get('type') == 'assistant':
        for b in content:
            if not (isinstance(b, dict) and b.get('type') == 'tool_use'):
                continue
            name, inp = b.get('name', ''), (b.get('input') or {})
            if name == 'Bash':
                calls[b.get('id')] = (ts, inp.get('command', ''))
            elif name.startswith('mcp__') and MCP_WRITE.search(name.split('__')[-1]):
                calls[b.get('id')] = (ts, f'MCP {name.split("__")[-1]} ' + json.dumps(inp, ensure_ascii=False)[:160])
            elif name == 'Artifact' and inp.get('action', 'publish') in ('publish', 'delete', 'pin', 'unpin'):
                calls[b.get('id')] = (ts, f'ARTIFACT {inp.get("action", "publish")} ' + str(inp.get('url') or inp.get('file_path') or ''))
    elif e.get('type') == 'user':
        for b in content:
            if isinstance(b, dict) and b.get('type') == 'tool_result':
                c = b.get('content')
                t = c if isinstance(c, str) else '\n'.join(x.get('text', '') for x in (c or []) if isinstance(x, dict))
                results[b.get('tool_use_id')] = 'DENIED' if (t.startswith('Permission to use') and 'has been denied' in t) or t.startswith("The user doesn't want to proceed") else ('error' if b.get('is_error') else 'ran')
for tid, (ts, cmd) in sorted(calls.items(), key=lambda kv: kv[1][0]):
    if since and ts < since:
        continue
    hits = ['mcp-write'] if cmd.startswith('MCP ') else ['artifact'] if cmd.startswith('ARTIFACT ') else [name for name, rx in PATTERNS if re.search(rx, cmd)]
    if not hits:
        continue
    one = re.sub(r'\s+', ' ', cmd)
    print(f'{ts}  {results.get(tid, "?"):6}  {",".join(hits):22}  {one[:220]}')
