import json
import sys

path = r"C:\Users\rasiail\.gemini\antigravity\brain\5eaad3e0-3686-4c24-9a75-9194548ae8fc\.system_generated\logs\transcript.jsonl"
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    for idx, line in enumerate(f):
        data = json.loads(line)
        content = data.get('content', '')
        if isinstance(content, str) and (('카드' in content or 'card' in content.lower()) and ('sfx' in content.lower() or '효과음' in content or '소리' in content)):
            sys.stdout.buffer.write(f"[{data.get('type')}] line {idx}: {content[:200]}\n".encode('utf-8', errors='ignore'))
