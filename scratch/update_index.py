import os

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

start_idx = html.find('<div id="ui-overlay">')
end_idx = html.find('<button id="upgrade-prompt"')

if start_idx == -1 or end_idx == -1:
    print('Failed to find replace boundaries.')
else:
    new_html = '''        <div id="progression-hud">
            <div id="progression-status">LV 1 &nbsp;&nbsp;&nbsp;EXP 0/40</div>
            <div class="xp-track"><div id="xp-fill"></div></div>
        </div>
        <div id="ui-overlay">
            <div class="hud-header">
                <div class="hud-panel" style="width: 260px;">
                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                        <span>HULL HP</span>
                        <span id="player-hp-val" style="color: #fff;">100%</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.6); border: 1px solid #4df58a; margin-bottom: 12px; overflow: hidden;">
                        <div id="player-hp-bar" style="width: 100%; height: 100%; background: #4df58a; transition: width 0.15s, background-color 0.2s;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>GUN: &nbsp;<span id="gun-stat" style="color: #fff;">20mm VULCAN</span></span>
                        <span style="font-size: 16px; line-height: 12px;">&infin;</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>MSL: &nbsp;</span><span id="missile-stat" style="display:flex; justify-content:space-between; flex-grow:1; color: #ff6b6b;"><span>STD READY</span><span>9/20</span></span>
                    </div>
                    <div>
                        <span>FLARE: <span id="flare-stat" style="color: #4df58a;">ACTIVE</span></span>
                    </div>
                </div>

                <div class="hud-panel" style="width: 200px;">
                    <div id="wave-status" style="font-size: 18px; margin-bottom: 8px; letter-spacing: 2px;">WAVE 1 / 3</div>
                    <div style="border-top: 1px solid #4df58a; margin-bottom: 8px; margin-left: -12px; margin-right: -12px;"></div>
                    <div style="margin-bottom: 6px;">TGT REMAIN: <span id="target-count" style="color: #fff;">19</span></div>
                    <div>SCORE: <span id="score-val" style="color: #fff;">13500</span></div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div id="radar-placeholder" style="position: relative; width: 140px; height: 140px;">
                    <div class="hud-panel" id="threat-warning" style="display: none; position: absolute; top: -45px; left: 0;">
                        <div class="hud-danger">MISSILE ALERT !!</div>
                    </div>
                </div>
            </div>
        </div>

        '''
    html = html[:start_idx] + new_html + html[end_idx:]
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('index.html updated')
