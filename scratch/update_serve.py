import os

with open('tools/serve.js', 'r', encoding='utf-8') as f:
    js = f.read()

js = js.replace("res.writeHead(404).end('Not found');", "console.log('404:', req.url); res.writeHead(404).end('Not found');")

with open('tools/serve.js', 'w', encoding='utf-8') as f:
    f.write(js)
