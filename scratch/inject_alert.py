import os

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

inject = """
    <script>
        window.addEventListener('error', function(e) {
            alert('JS Error: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
        });
        if (window.location.protocol === 'file:') {
            alert('CORS Error: You opened index.html directly (file://). ES Modules will not load. Please run Play_Game.bat instead!');
        }
    </script>
    <script type="module" src="src/main.js"></script>
"""

html = html.replace('<script type="module" src="src/main.js"></script>', inject)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('injected alert into index.html')
