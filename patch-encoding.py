"""
Fix Windows-1252 double-encoding artifacts in all frontend TSX/TS/JSX files.
Each garbled sequence is the UTF-8 encoding of the Latin-1/Win-1252 
misinterpretation of the original Unicode character.
"""
import os
import glob

# Map: garbled bytes (as they appear in the UTF-8 file) -> correct character
# These are the UTF-8 representations of common Win-1252 mojibake sequences
REPLACEMENTS = [
    # U+2026 HORIZONTAL ELLIPSIS  (…)
    # Original UTF-8: E2 80 A6  → Win-1252 read as: â (E2) € (80) ¦ (A6) → UTF-8 re-encoded
    (b'\xc3\xa2\xe2\x82\xac\xc2\xa6', '…'.encode('utf-8')),
    # U+2013 EN DASH  (–)
    # Original UTF-8: E2 80 93  → Win-1252 read as: â (E2) € (80) " (93) → UTF-8 re-encoded
    (b'\xc3\xa2\xe2\x82\xac\xe2\x80\x9c', '–'.encode('utf-8')),
    # U+2014 EM DASH  (—)
    # Original UTF-8: E2 80 94  → Win-1252 read as: â (E2) € (80) " (94) → UTF-8 re-encoded
    (b'\xc3\xa2\xe2\x82\xac\xe2\x80\x9d', '—'.encode('utf-8')),
    # U+2018 LEFT SINGLE QUOTE  (')
    # Original UTF-8: E2 80 98  → Win-1252 read as: â (E2) € (80) ˜ (98) → UTF-8 re-encoded
    (b'\xc3\xa2\xe2\x82\xac\xcb\x9c', '\u2018'.encode('utf-8')),
    # U+2019 RIGHT SINGLE QUOTE / APOSTROPHE  (')
    # Original UTF-8: E2 80 99  → Win-1252 read as: â (E2) € (80) ™ (99) → UTF-8 re-encoded
    (b'\xc3\xa2\xe2\x82\xac\xe2\x84\xa2', '\u2019'.encode('utf-8')),
    # U+201C LEFT DOUBLE QUOTE  (")
    # Original UTF-8: E2 80 9C  → Win-1252 read as: â (E2) € (80) œ (9C) → UTF-8 re-encoded
    (b'\xc3\xa2\xe2\x82\xac\xc5\x93', '\u201c'.encode('utf-8')),
    # U+201D RIGHT DOUBLE QUOTE  (")
    # Original UTF-8: E2 80 9D  → Win-1252 read as: â (E2) € (80)   (9D) → UTF-8 re-encoded
    (b'\xc3\xa2\xe2\x82\xac\xef\xbf\xbd', '\u201d'.encode('utf-8')),
    # U+00E2 â followed by literal bytes we haven't accounted for — skip complex ones
]

patterns = ['frontend/**/*.tsx', 'frontend/**/*.ts', 'frontend/**/*.jsx', 'frontend/**/*.js']
targets = set()
for pattern in patterns:
    for p in glob.glob(pattern, recursive=True):
        # Skip node_modules and .next build output
        if 'node_modules' not in p and '.next' not in p:
            targets.add(p)

total_files = 0
total_replacements = 0

for path in sorted(targets):
    if not os.path.isfile(path):
        continue
    try:
        with open(path, 'rb') as f:
            content = f.read()
        
        original = content
        for garbled_bytes, correct_bytes in REPLACEMENTS:
            count = content.count(garbled_bytes)
            if count:
                content = content.replace(garbled_bytes, correct_bytes)
                total_replacements += count
        
        if content != original:
            with open(path, 'wb') as f:
                f.write(content)
            print(f'Fixed: {path}')
            total_files += 1
    except Exception as e:
        print(f'Skip {path}: {e}')

print(f'\nDone. Fixed {total_replacements} occurrence(s) in {total_files} file(s).')
