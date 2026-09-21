import os

with open('src/assets/aircraft.js', 'r', encoding='utf-8') as f:
    js = f.read()

# For F104
f104_dummy_logic = '''
        group.baseGlows = [];
        let dummyFound = false;
        modelClone.traverse(child => {
            if (child.name && child.name.toLowerCase().includes('dummy_exhaust')) {
                const fx = createEngineEffects(0, 0);
                child.add(fx.group);
                group.baseGlows.push(fx.baseGlow);
                dummyFound = true;
            }
        });

        if (!dummyFound) {
            // 배기구 불꽃 효과 부착(FBX 기체 후방 노즐 위치 y = -0.38, z = 4.55)
            const fx = createEngineEffects(4.55, -0.38);
            group.add(fx.group);
            group.baseGlows.push(fx.baseGlow);
        }
        group.baseGlow = group.baseGlows[0]; // backward compatibility
'''
# I need to replace the old fx addition in createF104Mesh
f104_old = '''        // 배기구 불꽃 효과 부착(FBX 기체 후방 노즐 위치 y = -0.38, z = 4.55)
        const fx = createEngineEffects(4.55, -0.38);
        group.add(fx.group);
        group.baseGlow = fx.baseGlow;'''
js = js.replace(f104_old, f104_dummy_logic)

# For Su307
elite_dummy_logic = '''
        group.baseGlows = [];
        let dummyFound = false;
        modelClone.traverse(child => {
            if (child.name && child.name.toLowerCase().includes('dummy_exhaust')) {
                const fx = createEngineEffects(0, 0);
                child.add(fx.group);
                group.baseGlows.push(fx.baseGlow);
                dummyFound = true;
            }
        });

        if (!dummyFound) {
            // exhaust pos for Su307 scaled up (F104 is 4.55, -0.38)
            const fx = createEngineEffects(4.55 * 1.2, -0.38 * 1.2);
            group.add(fx.group);
            group.baseGlows.push(fx.baseGlow);
        }
        group.baseGlow = group.baseGlows[0];
'''
elite_old = '''        // exhaust pos for Su307 scaled up (F104 is 4.55, -0.38)
        // Adjust if needed, for now use scaled F104 exhaust coords
        const fx = createEngineEffects(4.55 * 1.2, -0.38 * 1.2);
        group.add(fx.group);
        group.baseGlow = fx.baseGlow;'''
js = js.replace(elite_old, elite_dummy_logic)

with open('src/assets/aircraft.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('aircraft.js patched')
