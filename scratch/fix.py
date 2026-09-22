with open('src/enemies/fleet.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("\\'", "'").replace("\\`", "`")

with open('src/enemies/fleet.js', 'w', encoding='utf-8') as f:
    f.write(text)
