import json

path = r"C:\Users\rasiail\.gemini\antigravity\brain\5eaad3e0-3686-4c24-9a75-9194548ae8fc\.system_generated\logs\transcript.jsonl"
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        data = json.loads(line)
        content = data.get('content', '')
        if isinstance(content, str) and ('카드' in content or 'SFX' in content or '소리' in content or '선택' in content):
            if data.get('type') == 'USER_INPUT':
                print(f"[USER] {content[:200]}")
