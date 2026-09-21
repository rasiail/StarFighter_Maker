import os

with open('styles/game.css', 'r', encoding='utf-8') as f:
    css = f.read()

css = css.replace(
'''#progression-hud { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); z-index: 12; width: 280px; text-align: center; font-size: 13px; pointer-events: none; }''',
'''#progression-hud { position: absolute; top: 0; left: 0; z-index: 12; width: 100%; text-align: center; font-size: 13px; pointer-events: none; display: flex; flex-direction: column; align-items: stretch; }
#progression-status { position: absolute; top: 2px; width: 100%; text-align: center; z-index: 13; color: #000; font-weight: bold; }'''
)

css = css.replace(
'''.xp-track { height: 6px; background: #102c32; margin-top: 6px; border: 1px solid #4df58a66; }''',
'''.xp-track { height: 18px; background: rgba(77, 245, 138, 0.15); border-bottom: 1px solid #4df58a; width: 100%; position: relative; }'''
)

css = css.replace(
'''#ui-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 16px;
}''',
'''#ui-overlay {
    position: absolute;
    top: 18px; /* Below the EXP bar */
    left: 0;
    width: 100%;
    height: calc(100% - 18px);
    pointer-events: none;
    z-index: 10;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 16px;
}'''
)

# Replace .hud-badge entirely or just add .hud-panel
# Let's add .hud-panel
panel_css = '''
.hud-panel {
    background: rgba(10, 30, 20, 0.7);
    border: 2px solid #4df58a;
    border-radius: 6px;
    padding: 12px;
    font-size: 13px;
    letter-spacing: 1.5px;
    box-shadow: 0 0 10px rgba(77, 245, 138, 0.15);
}
'''
if '.hud-panel' not in css:
    css += panel_css

with open('styles/game.css', 'w', encoding='utf-8') as f:
    f.write(css)
print('game.css updated')
