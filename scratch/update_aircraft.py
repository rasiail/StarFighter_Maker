import os

with open('src/assets/aircraft.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Add exports for Su307
if 'export let su307ModelTemplate;' not in js:
    insert_exports = '''
export let su307ModelTemplate;
export let isSu307Ready = false;
export let su307PbrMat;
'''
    js = js.replace('export let fbxModelTemplate;', 'export let fbxModelTemplate;' + insert_exports)

# Add load logic
su307_load = '''
    loader.load(
        'Enemy/Su307/Su307.fbx',
        (fbx) => {
            console.log('Su307 FBX loaded successfully');
            su307ModelTemplate = processFBXTemplate(fbx);
            // Size up by 1.2x
            su307ModelTemplate.scale.set(1.2, 1.2, 1.2);
            isSu307Ready = true;
        },
        undefined,
        (err) => console.warn('Su307 FBX load failed:', err)
    );
'''
if 'Enemy/Su307/Su307.fbx' not in js:
    js = js.replace('''            isFBXReady = true;
            refreshPlayerMesh();
            finalizeAssetLoading();''', '''            isFBXReady = true;
            refreshPlayerMesh();
            finalizeAssetLoading();''' + su307_load)

# Add Material init
su307_mat = '''
    const suBaseTex = textureLoader.load('Enemy/Su307/Su307_texture.png');
    suBaseTex.encoding = THREE.sRGBEncoding;
    su307PbrMat = new THREE.MeshStandardMaterial({
        map: suBaseTex,
        roughnessMap: textureLoader.load('Enemy/Su307/Su307_texture_roughness.png'),
        metalnessMap: textureLoader.load('Enemy/Su307/Su307_texture_metallic.png'),
        normalMap: textureLoader.load('Enemy/Su307/Su307_texture_normal.png'),
        normalScale: new THREE.Vector2(2.5, 2.5),
        roughness: 0.70,
        metalness: 0.15
    });
'''
if 'su307PbrMat = new THREE.MeshStandardMaterial' not in js:
    js = js.replace('isFBXReady = false;', 'isFBXReady = false;' + su307_mat)

# Add createEliteMesh
elite_mesh = '''
export function createEliteMesh() {
    const group = new THREE.Group();
    if (isSu307Ready && su307ModelTemplate) {
        const modelClone = su307ModelTemplate.clone(true);
        modelClone.traverse(child => {
            if (child.isMesh) {
                child.material = su307PbrMat;
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.geometry) child.geometry.computeVertexNormals();
            }
        });
        group.add(modelClone);
        
        // exhaust pos for Su307 scaled up (F104 is 4.55, -0.38)
        // Adjust if needed, for now use scaled F104 exhaust coords
        const fx = createEngineEffects(4.55 * 1.2, -0.38 * 1.2);
        group.add(fx.group);
        group.baseGlow = fx.baseGlow;
    } else {
        // Fallback procedural
        const proc = createProceduralF104Mesh(true);
        group.add(proc);
        group.baseGlow = proc.baseGlow;
    }
    group.colliderRadius = 3.5 * 1.2;
    return group;
}
'''
if 'export function createEliteMesh' not in js:
    js += elite_mesh

with open('src/assets/aircraft.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('aircraft.js patched')
