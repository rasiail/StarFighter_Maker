import re
import os

src_dir = 'src'
index_html = open('index.html', 'r', encoding='utf-8').read()

# Collect all IDs referenced by JavaScript
js_ids = set()
for root, dirs, files in os.walk(src_dir):
    for fn in files:
        if fn.endswith('.js'):
            code = open(os.path.join(root, fn), 'r', encoding='utf-8').read()
            for m in re.finditer(r"getElementById\(['\"]([^'\"]+)['\"]\)", code):
                js_ids.add(m.group(1))

# Collect all IDs present in index.html
html_ids = set(re.findall(r'id="([^"]+)"', index_html))

missing = js_ids - html_ids

print("=== IDs referenced in JS but MISSING from index.html ===")
for mid in sorted(missing):
    print(f"  MISSING: {mid}")

print("\n=== IDs present in index.html ===")
for hid in sorted(html_ids):
    print(f"  OK: {hid}")
