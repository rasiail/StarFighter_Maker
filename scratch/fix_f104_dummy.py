import os

with open('src/assets/aircraft.js', 'r', encoding='utf-8') as f:
    js = f.read()

# For F104
f104_old = '''        // 배기구 불꽃 효과 부착(FBX 기체 후방 노즐 위치 y = -0.38, z = 4.55)
        const fx = createEngineEffects(4.55, -0.38);
        group.add(fx.group);
        group.baseGlow = fx.baseGlow;'''
# Also handle the case where encoding makes it '?방'
import re
js = re.sub(r'// 배기.*?\n\s*const fx = createEngineEffects\(4\.55, -0\.38\);\n\s*group\.add\(fx\.group\);\n\s*group\.baseGlow = fx\.baseGlow;', 
'''        group.baseGlows = [];
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
            const fx = createEngineEffects(4.55, -0.38);
            group.add(fx.group);
            group.baseGlows.push(fx.baseGlow);
        }
        group.baseGlow = group.baseGlows[0];''', js)

with open('src/assets/aircraft.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('patched f104')
