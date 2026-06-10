import json

p = r'c:\Users\anura\AppData\Roaming\Code\User\workspaceStorage\972fca9b2b094675e96eb4387c5a7430\GitHub.copilot-chat\transcripts\215e5a0f-bfe5-400b-b212-ffb80e6e57fc.jsonl'
with open(p, encoding='utf-8') as f:
    lines = f.readlines()

print(f'Total lines: {len(lines)}')

# Search for lines containing the full file content (look for Python writes or PowerShell writes with full content)
for i, line in enumerate(lines):
    try:
        obj = json.loads(line)
        if obj.get('type') == 'tool.execution_start':
            args = obj.get('data', {}).get('arguments', {})
            cmd = args.get('command', '') or args.get('content', '')
            if 'STEP1_FIELDS' in cmd and 'questionnaire-review-client' in cmd:
                print(f'\n=== FOUND at line {i+1} ===')
                print(f'CMD length: {len(cmd)}')
                # Extract the file content portion
                # Find the TSX content
                start = cmd.find('"use client"')
                if start == -1:
                    start = cmd.find("'use client'")
                if start != -1:
                    print(f'File content starts at offset {start}')
                    print(cmd[start:start+500])
    except:
        pass
