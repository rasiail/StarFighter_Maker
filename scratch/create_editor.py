import os

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

insert_script = """
    <script type="module">
        import { startEditor } from './src/ui/layout_editor.js';
        setTimeout(() => {
            // Force hide the start menu and show HUD so the editor is visible immediately
            const startModal = document.getElementById('start-modal');
            if (startModal) startModal.style.display = 'none';
            document.getElementById('ui-overlay').style.display = 'flex';
            document.getElementById('progression-hud').style.display = 'block';
            startEditor();
        }, 1000);
    </script>
"""
html = html.replace('</body>', insert_script + '</body>')

with open('ui_editor.html', 'w', encoding='utf-8') as f:
    f.write(html)
