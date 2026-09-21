import os
import re

with open('src/ui/menus.js', 'r', encoding='utf-8') as f:
    js = f.read()

insert_js = '''
    const optCasualControls = document.getElementById('opt-casual-controls');
    if (optCasualControls) {
        optCasualControls.checked = (gameState.controlScheme === 'casual');
        optCasualControls.addEventListener('change', (e) => {
            gameState.controlScheme = e.target.checked ? 'casual' : 'standard';
        });
    }
'''

# Find a good place to insert, right after optPointerLock event listener block
match = re.search(r'optPointerLock\.addEventListener\(\'change\',.*?\}\);.*?\}', js, re.DOTALL)
if match:
    js = js[:match.end()] + insert_js + js[match.end():]
    with open('src/ui/menus.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print("menus.js updated")
else:
    print("Failed to find optPointerLock block")
