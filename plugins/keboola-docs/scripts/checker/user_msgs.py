# Print the user's own words from a Claude Code session transcript (JSONL), oldest first:
# typed messages, messages queued while the agent was busy, answers to AskUserQuestion,
# plan approvals, rejections (with the text the user typed when rejecting), and denied tool calls.
# Usage: python3 user_msgs.py <transcript.jsonl> [last_n=40]
import json, sys, re
path = sys.argv[1]
N = int(sys.argv[2]) if len(sys.argv) > 2 else 40
TAGS = r'system-reminder|command-name|command-message|command-args|local-command-stdout|local-command-caveat|task-notification'
SKIP = re.compile(r'<(' + TAGS + r')>.*?</\1>', re.S)
SAID = 'the user said:'

def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(b.get('text', '') for b in content if isinstance(b, dict) and b.get('type') == 'text')
    return ''

def clean(t):
    t = SKIP.sub('', t or '').strip()
    if not t or t.startswith('<') or t.startswith('This session is being continued') or t.startswith('Base directory for this skill'):
        return ''
    return t

out, seen_queued = [], set()
for line in open(path, encoding='utf-8'):
    try:
        e = json.loads(line)
    except Exception:
        continue
    ts = e.get('timestamp', '')
    # messages typed while the agent was working are queued, and some never reach a plain user turn
    if e.get('type') == 'queue-operation' and e.get('operation') == 'enqueue':
        t = clean(e.get('content') if isinstance(e.get('content'), str) else text_of(e.get('content')))
        if t and t not in seen_queued:
            seen_queued.add(t); out.append((ts, '[queued while you worked] ' + t))
        continue
    att = e.get('attachment')
    if isinstance(att, dict) and att.get('type') == 'queued_command':
        t = clean(att.get('prompt') if isinstance(att.get('prompt'), str) else text_of(att.get('prompt')))
        if t and t not in seen_queued:
            seen_queued.add(t); out.append((ts, '[queued while you worked] ' + t))
        continue
    if e.get('type') != 'user' or e.get('isMeta') or e.get('isCompactSummary'):
        continue
    c = (e.get('message') or {}).get('content')
    if isinstance(c, list):
        results = [b for b in c if isinstance(b, dict) and b.get('type') == 'tool_result']
        if results:
            for b in results:
                t = text_of(b.get('content')).strip()
                if t.startswith('The user answered'):
                    out.append((ts, '[answer to my question] ' + t[:900]))
                elif t.startswith('User has approved your plan'):
                    out.append((ts, '[approved the plan]'))
                elif t.startswith("The user doesn't want to proceed"):
                    i = t.find(SAID)
                    said = t[i + len(SAID):].strip() if i >= 0 else ''
                    out.append((ts, '[rejected a tool call]' + (' and said: ' + said[:1500] if said else '')))
                elif t.startswith('Permission to use') and 'has been denied' in t:
                    out.append((ts, '[denied a tool call] ' + t[:300]))
            continue
        c = text_of(c)
    if not isinstance(c, str):
        continue
    t = clean(c)
    if t and t not in seen_queued:
        out.append((ts, t))
out.sort(key=lambda x: x[0])
for ts, t in out[-N:]:
    print(f'--- {ts}\n{t}\n')
