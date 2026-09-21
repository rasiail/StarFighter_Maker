import os

# 1. Update player/flight.js
with open('src/player/flight.js', 'r', encoding='utf-8') as f:
    js = f.read()

flight_old = '''    if (playerMesh.baseGlow) {
        const glowScale = (playerFlight.isAfterburner ? 1.4 : 1.0) * (0.85 + Math.random() * 0.25);
        playerMesh.baseGlow.scale.set(glowScale, glowScale, glowScale);
        playerMesh.baseGlow.material.color.setHex(playerFlight.isAfterburner ? 0x66ddff : 0xffaa22);
    }'''

flight_new = '''    const glows = playerMesh.baseGlows || (playerMesh.baseGlow ? [playerMesh.baseGlow] : []);
    glows.forEach(glow => {
        const glowScale = (playerFlight.isAfterburner ? 1.4 : 1.0) * (0.85 + Math.random() * 0.25);
        glow.scale.set(glowScale, glowScale, glowScale);
        glow.material.color.setHex(playerFlight.isAfterburner ? 0x66ddff : 0xffaa22);
    });'''

js = js.replace(flight_old, flight_new)

with open('src/player/flight.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('flight.js patched')


# 2. Update enemies/ai.js
with open('src/enemies/ai.js', 'r', encoding='utf-8') as f:
    js = f.read()

ai_old = '''        if (enemy.mesh.baseGlow) {
            enemy.mesh.baseGlow.scale.set(1 + Math.random() * 0.15, 1 + Math.random() * 0.15, 1);
        }'''

ai_new = '''        const glows = enemy.mesh.baseGlows || (enemy.mesh.baseGlow ? [enemy.mesh.baseGlow] : []);
        glows.forEach(glow => {
            glow.scale.set(1 + Math.random() * 0.15, 1 + Math.random() * 0.15, 1);
        });'''

js = js.replace(ai_old, ai_new)

with open('src/enemies/ai.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('ai.js patched')
