import os

with open('src/enemies/lifecycle.js', 'r', encoding='utf-8') as f:
    js = f.read()

# patch score logic
orig_score = "playerFlight.score += (enemy.isBoss ? BALANCE.enemies.boss : (enemy.isGround ? BALANCE.enemies.tank : BALANCE.enemies.stage_aircraft)).scoreReward;"
new_score = "playerFlight.score += (enemy.isBoss ? BALANCE.enemies.boss : (enemy.isGround ? BALANCE.enemies.tank : (enemy.isElite ? BALANCE.enemies.elite : BALANCE.enemies.stage_aircraft))).scoreReward;"
js = js.replace(orig_score, new_score)

# patch event emit
orig_event = "enemyType: enemy.isShip ? (enemy.shipPart === 'TURRET' ? 'turret' : 'ship') : (enemy.isGround ? 'tank' : 'aircraft'),"
new_event = "enemyType: enemy.isShip ? (enemy.shipPart === 'TURRET' ? 'turret' : 'ship') : (enemy.isGround ? 'tank' : (enemy.isElite ? 'elite' : 'aircraft')),"
js = js.replace(orig_event, new_event)

with open('src/enemies/lifecycle.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('lifecycle.js patched')

with open('src/progression/runtime.js', 'r', encoding='utf-8') as f:
    js = f.read()

orig_runtime = "const id = isBoss ? 'boss' : ({ aircraft: 'stage_aircraft', tank: 'tank', turret: 'ship_turret', ship: 'ship_hull' }[enemyType] || 'stage_aircraft');"
new_runtime = "const id = isBoss ? 'boss' : ({ aircraft: 'stage_aircraft', tank: 'tank', turret: 'ship_turret', ship: 'ship_hull', elite: 'elite' }[enemyType] || 'stage_aircraft');"
js = js.replace(orig_runtime, new_runtime)

with open('src/progression/runtime.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('runtime.js patched')
