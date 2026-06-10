import json

p = r'c:\Users\anura\AppData\Roaming\Code\User\workspaceStorage\972fca9b2b094675e96eb4387c5a7430\GitHub.copilot-chat\transcripts\215e5a0f-bfe5-400b-b212-ffb80e6e57fc.jsonl'
with open(p, encoding='utf-8') as f:
    lines = f.readlines()

obj = json.loads(lines[4074])
args = obj.get('data', {}).get('arguments', {})
cmd = args.get('command', '')

print(f'CMD length: {len(cmd)}')

# The command is a Python script that writes the file.
# Extract the file content between the heredoc markers
# It uses: content = """..."""
# or similar. Let's look at the structure.
print('=== First 800 chars of command ===')
print(cmd[:800])
print()
print('=== Last 200 chars ===')
print(cmd[-200:])
