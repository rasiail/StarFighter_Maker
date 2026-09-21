import os

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# I need to extract the Casual Controls block and put it BEFORE the APPLY button.
import re

# Find the Casual Controls block
casual_match = re.search(r'<!-- 5\. Casual Controls -->[\s\S]*?</label>\s*</div>', html)
if casual_match:
    casual_block = casual_match.group(0)
    # Remove it from its current position
    html = html.replace(casual_block, '')
    
    # Find the pointer lock block
    pointer_match = re.search(r'id="opt-pointer-lock"[^>]*>[\s\S]*?</label>\s*</div>', html)
    if pointer_match:
        pos = pointer_match.end()
        html = html[:pos] + '\n' + casual_block + html[pos:]
        
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print('index.html fixed!')
    else:
        print('Could not find pointer lock block')
else:
    print('Could not find casual controls block')
