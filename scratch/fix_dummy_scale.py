import os
import re

with open('src/assets/aircraft.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Replace the traverse block for dummy
old_traverse = '''        modelClone.traverse(child => {
            if (child.name && child.name.toLowerCase().includes('dummy_exhaust')) {
                const fx = createEngineEffects(0, 0);
                child.add(fx.group);
                group.baseGlows.push(fx.baseGlow);
                dummyFound = true;
            }
        });'''

new_traverse = '''        modelClone.updateMatrixWorld(true);
        modelClone.traverse(child => {
            if (child.name && child.name.toLowerCase().includes('dummy_exhaust')) {
                const pos = new THREE.Vector3();
                pos.setFromMatrixPosition(child.matrixWorld);
                const fx = createEngineEffects(pos.z, pos.y);
                fx.group.position.x = pos.x;
                group.add(fx.group);
                group.baseGlows.push(fx.baseGlow);
                dummyFound = true;
            }
        });'''

js = js.replace(old_traverse, new_traverse)

with open('src/assets/aircraft.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('patched aircraft.js')
