import os

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

target = '''                <div class="option-row" style="margin-bottom: 18px;">
                    <div>
                        <div style="font-weight: bold; color: #ffffff; font-size: 14px;">CONFINE MOUSE TO WINDOW</div>
                        <div style="font-size: 11px; color: #8edebb; margin-top: 2px;">창 밖 이탈 방지 + 전투 조준 커서 활성 (ESC/종료 시 해제)</div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="opt-pointer-lock" checked>
                        <span class="slider"></span>
                    </label>
                </div>'''

# The encoding and korean chars might mismatch exactly, so let's find the pointer lock block instead.
import re
match = re.search(r'<div class="option-row"[^>]*>[\s\S]*?id="opt-pointer-lock"[^>]*>[\s\S]*?</div>\s*</div>', html)
if match:
    insert_str = '''
                <!-- 5. Casual Controls -->
                <div class="option-row" style="margin-bottom: 18px;">
                    <div>
                        <div style="font-weight: bold; color: #ffffff; font-size: 14px;">CASUAL FLIGHT CONTROLS</div>
                        <div style="font-size: 11px; color: #8edebb; margin-top: 2px;">W/S: Pitch (Inverted), A/D: Yaw, Q/E: Roll</div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="opt-casual-controls">
                        <span class="slider"></span>
                    </label>
                </div>'''
    
    html = html[:match.end()] + insert_str + html[match.end():]
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("index.html updated successfully")
else:
    print("Failed to match options block")
