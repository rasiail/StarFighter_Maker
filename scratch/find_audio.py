import os
import re

matches = []
for root, dirs, files in os.walk('src'):
    for f in files:
        if f.endswith('.js'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                for idx, line in enumerate(fp, 1):
                    if re.search(r'\baudio\b|\bsfx\b|\bsound\b', line, re.I):
                        matches.append(f"{path}:{idx}: {line.strip()}")

print(f"Total matches: {len(matches)}")
for m in matches:
    print(m)
