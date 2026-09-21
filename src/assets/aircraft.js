// assets/aircraft: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { createEngineEffects } from '../effects/exhaust.js';
import { playerMesh } from '../player/player.js';

let textureLoader;
let hasEmbeddedData;
let baseTexUrl;
let roughTexUrl;
let metalTexUrl;
let normTexUrl;
let baseTex;
let roughTex;
let metalTex;
let normTex;
let playerPbrMat;
let enemyPbrMat;
export let fbxModelTemplate;
export let su307ModelTemplate;
export let isSu307Ready = false;
export let su307PbrMat;

export let isFBXReady;

function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}
function createProceduralF104Mesh(isEnemy = false) {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
        color: isEnemy ? 0x3d4349 : 0xccd3db,
        roughness: 0.35,
        metalness: isEnemy ? 0.25 : 0.65
    });

    const trimMat = new THREE.MeshStandardMaterial({
        color: isEnemy ? 0xd62828 : 0x7c8590,
        roughness: 0.4,
        metalness: 0.3
    });

    const radomeMat = new THREE.MeshStandardMaterial({
        color: 0x22262b,
        roughness: 0.7,
        metalness: 0.1
    });

    const canopyMat = new THREE.MeshStandardMaterial({
        color: 0x274353,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.85
    });

    const exhaustMat = new THREE.MeshStandardMaterial({
        color: 0x1f2022,
        roughness: 0.8,
        metalness: 0.8
    });

    const fuselageGeom = new THREE.CylinderGeometry(0.72, 0.72, 11.5, 20);
    fuselageGeom.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeom, bodyMat);
    fuselage.position.z = -1.0;
    group.add(fuselage);

    const radomeGeom = new THREE.ConeGeometry(0.72, 3.8, 20);
    radomeGeom.rotateX(-Math.PI / 2);
    const radome = new THREE.Mesh(radomeGeom, radomeMat);
    radome.position.z = -8.6;
    group.add(radome);

    const pitotGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8);
    pitotGeom.rotateX(Math.PI / 2);
    const pitot = new THREE.Mesh(pitotGeom, trimMat);
    pitot.position.z = -11.0;
    group.add(pitot);

    const canopyGeom = new THREE.CylinderGeometry(0.48, 0.65, 3.8, 12);
    canopyGeom.rotateX(Math.PI / 2);
    canopyGeom.scale(0.85, 0.9, 1.0);
    const canopy = new THREE.Mesh(canopyGeom, canopyMat);
    canopy.position.set(0, 0.65, -4.6);
    group.add(canopy);

    const intakeShape = new THREE.BoxGeometry(0.55, 0.95, 2.8);
    const shockConeGeom = new THREE.ConeGeometry(0.24, 0.85, 12);
    shockConeGeom.rotateX(-Math.PI / 2);

    [-1, 1].forEach(side => {
        const intake = new THREE.Mesh(intakeShape, bodyMat);
        intake.position.set(side * 0.95, -0.05, -3.2);
        group.add(intake);

        const shockCone = new THREE.Mesh(shockConeGeom, radomeMat);
        shockCone.position.set(side * 0.95, -0.05, -4.7);
        group.add(shockCone);
    });

    const wingGeom = new THREE.BoxGeometry(6.6, 0.07, 2.2);
    const wing = new THREE.Mesh(wingGeom, bodyMat);
    wing.position.set(0, 0.05, -0.2);
    wing.rotation.z = Math.PI * 0.02;
    group.add(wing);

    const tankGeom = new THREE.CylinderGeometry(0.28, 0.28, 3.8, 14);
    tankGeom.rotateX(Math.PI / 2);
    const tankNoseGeom = new THREE.ConeGeometry(0.28, 0.9, 14);
    tankNoseGeom.rotateX(-Math.PI / 2);
    const tankFinGeom = new THREE.BoxGeometry(0.04, 0.6, 0.6);

    [-3.4, 3.4].forEach(xPos => {
        const tank = new THREE.Mesh(tankGeom, trimMat);
        tank.position.set(xPos, 0, -0.2);
        group.add(tank);

        const nose = new THREE.Mesh(tankNoseGeom, radomeMat);
        nose.position.set(xPos, 0, -2.55);
        group.add(nose);

        const fin = new THREE.Mesh(tankFinGeom, bodyMat);
        fin.position.set(xPos, 0.2, 1.4);
        group.add(fin);
    });

    const vFinGeom = new THREE.BoxGeometry(0.12, 2.8, 2.8);
    const vFin = new THREE.Mesh(vFinGeom, bodyMat);
    vFin.position.set(0, 1.6, 3.2);
    vFin.rotation.x = -Math.PI * 0.08;
    group.add(vFin);

    const hTailGeom = new THREE.BoxGeometry(3.6, 0.08, 1.5);
    const hTail = new THREE.Mesh(hTailGeom, bodyMat);
    hTail.position.set(0, 3.0, 3.8);
    group.add(hTail);

    const exhaustGeom = new THREE.CylinderGeometry(0.68, 0.58, 1.4, 20, 1, true);
    exhaustGeom.rotateX(Math.PI / 2);
    const exhaust = new THREE.Mesh(exhaustGeom, exhaustMat);
    exhaust.position.z = 5.2;
    group.add(exhaust);

    const fx = createEngineEffects(5.3, 0);
    group.add(fx.group);
    group.baseGlow = fx.baseGlow;
    group.colliderRadius = 3.5;
    return group;
}
function processFBXTemplate(fbxGroup) {
    const bbox = new THREE.Box3().setFromObject(fbxGroup);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());

    const wrapper = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(fbxGroup);

    // 모델의 바운딩 중심을 원점으로 정렬
    fbxGroup.position.set(-center.x, -center.y, -center.z);

    // 3ds Max의 -Y 전방을 Three.js 게임의 -Z 전방으로 정렬 (Y축 180도 회전)
    inner.rotation.y = Math.PI;

    // 3ds Max 그리드 규격(Grid = 10.0cm)에 맞추어 적당하고 날렵한 크기로 스케일 조정 (전장 약 9.0m)
    const targetLength = 9.0;
    const currentLength = (size.z > 0.1) ? size.z : 21.93;
    const scaleFactor = targetLength / currentLength;

    // 좌우 날개 방향을 올바르게 맞추기 위해 x축 미러링 보정 (-scaleFactor, scaleFactor, scaleFactor)
    inner.scale.set(-scaleFactor, scaleFactor, scaleFactor);

    wrapper.add(inner);
    wrapper.exhaustZ = targetLength * 0.5; // 후방 배기구 위치 약 +4.5m
    return wrapper;
}
export function createF104Mesh(isEnemy = false) {
    // 사용자 요청: 적기는 안정적이고 가벼운 절차적 3D 모델로 생성
    if (isEnemy) {
        return createProceduralF104Mesh(true);
    }

    // 플레이어 기체: 고품질 FBX 3D 모델 및 PBR 텍스처 적용
    const group = new THREE.Group();

    if (isFBXReady && fbxModelTemplate) {
        const modelClone = fbxModelTemplate.clone(true);
        modelClone.traverse(child => {
            if (child.isMesh) {
                child.material = playerPbrMat;
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.geometry) {
                    child.geometry.computeVertexNormals();
                }
            }
        });

        group.add(modelClone);

                group.baseGlows = [];
        let dummyFound = false;
        modelClone.updateMatrixWorld(true);
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
        });

        if (!dummyFound) {
            const fx = createEngineEffects(4.55, -0.38);
            group.add(fx.group);
            group.baseGlows.push(fx.baseGlow);
        }
        group.baseGlow = group.baseGlows[0];
    } else {
        // FBX가 아직 준비되지 않았거나 폴백일 때
        const proc = createProceduralF104Mesh(false);
        group.add(proc);
        group.baseGlow = proc.baseGlow;
    }

    group.colliderRadius = 3.5;
    return group;
}
export function loadFBXAsset() {
    if (isFBXReady) {
        finalizeAssetLoading();
        return;
    }

    const btn = document.getElementById('btn-sortie');
    if (btn) {
        btn.textContent = "LOADING 3D F104 MODEL...";
        btn.style.opacity = "0.7";
        btn.style.pointerEvents = "none";
    }

    if (typeof THREE.FBXLoader === 'undefined') {
        console.warn('FBXLoader is not available. Using procedural models.');
        finalizeAssetLoading();
        return;
    }

    const loader = new THREE.FBXLoader();
    loader.load(
        'F104/F104.fbx',
        (fbx) => {
            console.log('F104 FBX loaded successfully from file');
            fbxModelTemplate = processFBXTemplate(fbx);
            isFBXReady = true;
            refreshPlayerMesh();
            finalizeAssetLoading();
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

        },
        (xhr) => {
            if (xhr.lengthComputable && xhr.total > 0) {
                const pct = Math.round((xhr.loaded / xhr.total) * 100);
                if (btn) btn.textContent = `LOADING 3D MODEL... (${pct}%)`;
            }
        },
        (err) => {
            console.warn('FBX file load failed, falling back to procedural model:', err);
            isFBXReady = false;
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

            finalizeAssetLoading();
        }
    );
}
function finalizeAssetLoading() {
    const btn = document.getElementById('btn-sortie');
    if (btn) {
        btn.textContent = "SORTIE (SELECT MISSION STAGE)";
        btn.style.opacity = "1.0";
        btn.style.pointerEvents = "auto";
    }
}
function refreshPlayerMesh() {
    if (!playerMesh) return;
    // cameraPivot이 playerMesh의 자식으로 등록되어 있다면 안전하게 임시 분리
    if (gameState.cameraPivot && gameState.cameraPivot.parent === playerMesh) {
        playerMesh.remove(gameState.cameraPivot);
    }
    while (playerMesh.children.length > 0) {
        playerMesh.remove(playerMesh.children[0]);
    }
    const newModel = createF104Mesh(false);
    while (newModel.children.length > 0) {
        playerMesh.add(newModel.children[0]);
    }
    playerMesh.baseGlow = newModel.baseGlow;
    // 모델 교체 후 cameraPivot을 전투기 자식으로 다시 안전하게 재부착
    if (gameState.cameraPivot) {
        playerMesh.add(gameState.cameraPivot);
    }
}

export function initAircraft() {
    textureLoader = new THREE.TextureLoader();

    hasEmbeddedData = typeof window.F104_DATA !== 'undefined' && window.F104_DATA.fbx;

    baseTexUrl = hasEmbeddedData ? window.F104_DATA.baseTex : 'F104/Meshy_AI_Falcon_Sentinel_0916041252_texture.png';

    roughTexUrl = hasEmbeddedData ? window.F104_DATA.roughTex : 'F104/Meshy_AI_Falcon_Sentinel_0916041252_texture_roughness.png';

    metalTexUrl = hasEmbeddedData ? window.F104_DATA.metalTex : 'F104/Meshy_AI_Falcon_Sentinel_0916041252_texture_metallic.png';

    normTexUrl = hasEmbeddedData ? window.F104_DATA.normTex : 'F104/Meshy_AI_Falcon_Sentinel_0916041252_texture_normal.png';

    baseTex = textureLoader.load(baseTexUrl);

    roughTex = textureLoader.load(roughTexUrl);

    metalTex = textureLoader.load(metalTexUrl);

    normTex = textureLoader.load(normTexUrl);

    baseTex.encoding = THREE.sRGBEncoding;

    playerPbrMat = new THREE.MeshStandardMaterial({
        map: baseTex,
        roughnessMap: roughTex,
        metalnessMap: metalTex,
        normalMap: normTex,
        normalScale: new THREE.Vector2(2.5, 2.5), // 노말맵 패널 라인 및 요철 뚜렷하게 강조
        roughness: 0.70, // 과도한 플라스틱 반사광 방지 (군용 무광 도장 질감)
        metalness: 0.15  // 반사광 억제
    });

    enemyPbrMat = new THREE.MeshStandardMaterial({
        map: baseTex,
        roughnessMap: roughTex,
        metalnessMap: metalTex,
        normalMap: normTex,
        color: 0xff5555,
        roughness: 0.55,
        metalness: 0.45
    });

    fbxModelTemplate = null;

    isFBXReady = false;
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


    if (hasEmbeddedData && typeof THREE.FBXLoader !== 'undefined') {
        try {
            const loader = new THREE.FBXLoader();
            const buffer = base64ToArrayBuffer(window.F104_DATA.fbx);
            const parsedFbx = loader.parse(buffer, '');
            fbxModelTemplate = processFBXTemplate(parsedFbx);
            isFBXReady = true;
            console.log('F104 FBX model loaded and ready instantly!');
        } catch (err) {
            console.error('Failed to parse embedded FBX data:', err);
        }
    }
}

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
        

        group.baseGlows = [];
        let dummyFound = false;
        modelClone.updateMatrixWorld(true);
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
        });

        if (!dummyFound) {
            // exhaust pos for Su307 scaled up (F104 is 4.55, -0.38)
            const fx = createEngineEffects(4.55 * 1.2, -0.38 * 1.2);
            group.add(fx.group);
            group.baseGlows.push(fx.baseGlow);
        }
        group.baseGlow = group.baseGlows[0];

    } else {
        // Fallback procedural
        const proc = createProceduralF104Mesh(true);
        group.add(proc);
        group.baseGlow = proc.baseGlow;
    }
    group.colliderRadius = 3.5 * 1.2;
    return group;
}
