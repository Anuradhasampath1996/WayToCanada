import json

p = r'c:\Users\anura\AppData\Roaming\Code\User\workspaceStorage\972fca9b2b094675e96eb4387c5a7430\GitHub.copilot-chat\transcripts\215e5a0f-bfe5-400b-b212-ffb80e6e57fc.jsonl'
with open(p, encoding='utf-8') as f:
    lines = f.readlines()

obj = json.loads(lines[4074])
args = obj.get('data', {}).get('arguments', {})
cmd = args.get('command', '')

# Extract content between @' and '@
start_marker = "@'\n"
end_marker = "\n'@"
start = cmd.find(start_marker)
end = cmd.rfind(end_marker)

if start == -1 or end == -1:
    print(f'Markers not found! start={start} end={end}')
    # Try alternate markers
    start_marker = "@'\r\n"
    start = cmd.find(start_marker)
    print(f'With CRLF: start={start}')
else:
    content = cmd[start + len(start_marker):end]
    print(f'Extracted content length: {len(content)} chars')
    print('First 200 chars:')
    print(repr(content[:200]))
    print()
    print('Last 100 chars:')
    print(repr(content[-100:]))
    
    # Count lines
    lines_count = content.count('\n')
    print(f'Lines: {lines_count}')
