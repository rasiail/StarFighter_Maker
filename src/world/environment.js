// world/environment: imports are side-effect free; main.js controls initialization.
import { scene } from '../rendering/scene.js';

let ambientLight;
let sunLight;
let hemiLight;
let skyGeo;
let skyMat;
export let skyMesh;
let terrainSize;
let terrainSegments;
let terrainGeom;
let posAttr;
let sandTexture;
let waterTexture;
let cityGroundTexture;
let terrainMat;
let terrain;
let stagePropsGroup;
export let currentEnvironment;
let cloudGroupList;
let cloudMaterial;

function createSandTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    // 채도를 대폭 낮춘 건조한 사막 모래/협곡 흙먼지 톤 (Desaturated muted sand & rock)
    ctx.fillStyle = '#554d45';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 35000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(118, 110, 100, 0.22)' : 'rgba(56, 50, 45, 0.25)';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(48, 48);
    return tex;
}
function createWaterTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    // 밝고 선명한 청록/코발트 블루 바다 베이스
    ctx.fillStyle = '#1a6cb5';
    ctx.fillRect(0, 0, 512, 512);
    // 부드러운 파도 물결 패턴
    for (let i = 0; i < 22000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(40, 140, 220, 0.35)' : 'rgba(15, 80, 150, 0.3)';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 5, 2.5);
    }
    for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = 'rgba(130, 210, 255, 0.35)';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 1.5);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(64, 64);
    return tex;
}
function createCityGroundTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1c1f24'; // 어두운 아스팔트
    ctx.fillRect(0, 0, 512, 512);
    // 도로 격자선 (그리드)
    ctx.strokeStyle = '#383e47';
    ctx.lineWidth = 14;
    for (let x = 0; x <= 512; x += 128) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(512, x); ctx.stroke();
    }
    // 노란색 중앙 차선
    ctx.strokeStyle = '#e6b800';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    for (let x = 0; x <= 512; x += 128) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(512, x); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    return tex;
}
function createBuildingTexture(isNight = false) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#222830';
    ctx.fillRect(0, 0, 256, 512);
    // 창문 그리드
    const rows = 32; const cols = 16;
    const cw = 256 / cols; const ch = 512 / rows;
    for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
            const isLit = isNight ? (Math.random() > 0.45) : (Math.random() > 0.7);
            if (isLit) {
                ctx.fillStyle = Math.random() > 0.3 ? '#ffe082' : '#80d8ff';
            } else {
                ctx.fillStyle = '#11151a';
            }
            ctx.fillRect(col * cw + 2, r * ch + 2, cw - 4, ch - 4);
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 6);
    return tex;
}
export function getSurfaceHeight(x, z) {
    const stage = (currentEnvironment && currentEnvironment.stageId) ? currentEnvironment.stageId : 1;
    if (stage === 1) {
        // 사막: 사구 굴곡 및 협곡 릿지
        const height = Math.sin(x * 0.0006) * Math.cos(z * 0.0006) * 280 +
                       Math.sin(x * 0.0018 + z * 0.0012) * 110 +
                       (Math.sin(x * 0.0002) * Math.sin(z * 0.0002) > 0.3 ? 750 : 0);
        return Math.max(0, height);
    } else if (stage === 2) {
        // 바다: 완전 평평한 해수면 (Y = 0)
        return 0;
    } else {
        // 도시: 평탄한 도로 아스팔트 지면
        return 0;
    }
}
export function setupStageEnvironment(stageId, customTimeOfDay = null) {
    // 1. 시간대 무작위 선택 (주간, 일몰, 야간)
    const times = ['DAY', 'SUNSET', 'NIGHT'];
    const timeOfDay = customTimeOfDay || times[Math.floor(Math.random() * times.length)];
    currentEnvironment.stageId = stageId;
    currentEnvironment.timeOfDay = timeOfDay;

    // 2. 시간대별 스카이 돔 / 포그 / 라이팅 설정 (야간도 밝고 선명하게 유지)
    if (timeOfDay === 'DAY') {
        skyMat.color.setHex(0x6bb5ff);
        scene.background.setHex(0x6bb5ff);
        scene.fog.color.setHex(0xa0c8ff);
        sunLight.color.setHex(0xfff5e6);
        sunLight.intensity = (stageId === 1 ? 1.12 : 1.35); // 사막 눈부심 완화
        sunLight.position.set(4000, 5000, -3000);
        ambientLight.color.setHex(0xffffff);
        ambientLight.intensity = (stageId === 1 ? 0.42 : 0.50);
        hemiLight.color.setHex(0xa0c8ff);
        hemiLight.groundColor.setHex(stageId === 2 ? 0x1a4568 : (stageId === 1 ? 0x48423a : 0x7a5833));
    } else if (timeOfDay === 'SUNSET') {
        skyMat.color.setHex(0xc85532); // 오렌지/레드 노을
        scene.background.setHex(0xc85532);
        scene.fog.color.setHex(0xb85638);
        sunLight.color.setHex(0xff6622);
        sunLight.intensity = 1.45;
        sunLight.position.set(5500, 1600, -2500); // 낮게 깔린 석양
        ambientLight.color.setHex(0xffaa77);
        ambientLight.intensity = 0.52;
        hemiLight.color.setHex(0xff7744);
        hemiLight.groundColor.setHex(0x552233);
    } else {
        // NIGHT: 사용자 요청에 따라 너무 어둡지 않게 시인성 높은 사이버 미드나잇 블루 연출
        skyMat.color.setHex(0x13203c);
        scene.background.setHex(0x13203c);
        scene.fog.color.setHex(0x182845);
        sunLight.color.setHex(0x9fc3f5);
        sunLight.intensity = 0.95; // 창백한 달빛
        sunLight.position.set(3000, 4500, 2000);
        ambientLight.color.setHex(0x7090b8);
        ambientLight.intensity = 0.62; // 달빛 반사로 기체와 지형이 충분히 밝게 보임
        hemiLight.color.setHex(0x406088);
        hemiLight.groundColor.setHex(0x182535);
    }

    // 3. 기존 스테이지 전용 프랍 오브젝트 정리
    const geometries = new Set(), materials = new Set(), textures = new Set();
    stagePropsGroup.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
            if (!material) continue;
            materials.add(material);
            if (material.map && ![sandTexture, waterTexture, cityGroundTexture].includes(material.map)) textures.add(material.map);
        }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    while (stagePropsGroup.children.length > 0) {
        const child = stagePropsGroup.children[0];
        stagePropsGroup.remove(child);
    }

    const posAttr = terrainGeom.attributes.position;

    // 4. 스테이지별 지형 고도 및 환경 프랍 생성
    if (stageId === 1) {
        // ==========================================
        // STAGE 1: 사막 (DESERT - 채도를 확 낮춘 차분한 모래 흙빛)
        // ==========================================
        currentEnvironment.theme = 'DESERT';
        terrainMat.map = sandTexture;
        terrainMat.color.setHex(0x9a938a); // 채도를 대폭 낮춘 매트한 드라이 샌드 톤
        terrainMat.roughness = 0.95;
        terrainMat.metalness = 0.05;
        terrainMat.needsUpdate = true;

        // 굴곡진 모래 사구와 웅장한 협곡
        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const z = posAttr.getZ(i);
            posAttr.setY(i, getSurfaceHeight(x, z));
        }

        // 사막 공군 활주로 & 유도선 & 격납고
        const runwayGeom = new THREE.PlaneGeometry(350, 4500);
        runwayGeom.rotateX(-Math.PI / 2);
        const runwayMat = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.7 });
        const runway = new THREE.Mesh(runwayGeom, runwayMat);
        runway.position.set(0, 15, 0);
        stagePropsGroup.add(runway);

        const centerLineGeom = new THREE.PlaneGeometry(12, 4300);
        centerLineGeom.rotateX(-Math.PI / 2);
        const centerLineMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
        const centerLine = new THREE.Mesh(centerLineGeom, centerLineMat);
        centerLine.position.set(0, 16, 0);
        stagePropsGroup.add(centerLine);

        const hangarGeom = new THREE.CylinderGeometry(60, 60, 140, 16, 1, false, 0, Math.PI);
        hangarGeom.rotateZ(Math.PI / 2);
        hangarGeom.rotateY(Math.PI / 2);
        const hangarMat = new THREE.MeshStandardMaterial({ color: 0x6e7882, roughness: 0.6, metalness: 0.3 });
        [-320, 320].forEach((xSide, idx) => {
            for (let z = -1200; z <= 1200; z += 600) {
                const hangar = new THREE.Mesh(hangarGeom, hangarMat);
                hangar.position.set(xSide, 35, z + (idx * 150));
                stagePropsGroup.add(hangar);
            }
        });

    } else if (stageId === 2) {
        // ==========================================
        // STAGE 2: 바다 (OCEAN - 평평한 파란 바다 & 반사광 제외)
        // ==========================================
        currentEnvironment.theme = 'OCEAN';
        terrainMat.map = waterTexture;
        terrainMat.color.setHex(0x1d75c2); // 선명하고 맑은 파란색 바다
        terrainMat.roughness = 0.95;       // 반사광 제외 (무광 매트)
        terrainMat.metalness = 0.0;        // 금속 반사 완전 제거 (검은 화면 방지)
        terrainMat.needsUpdate = true;

        // 평평한 바다 수면 (전체 Y = 0)
        for (let i = 0; i < posAttr.count; i++) {
            posAttr.setY(i, 0);
        }

        // 바다 위 초대형 항공모함 (Aircraft Carrier) 배치
        const carrierGroup = new THREE.Group();
        // 1. 선체
        const hullGeom = new THREE.BoxGeometry(110, 35, 620);
        const hullMat = new THREE.MeshStandardMaterial({ color: 0x3a424a, roughness: 0.5 });
        const hull = new THREE.Mesh(hullGeom, hullMat);
        hull.position.y = 10;
        carrierGroup.add(hull);

        // 2. 비행갑판
        const deckGeom = new THREE.BoxGeometry(130, 4, 650);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.8 });
        const deck = new THREE.Mesh(deckGeom, deckMat);
        deck.position.y = 28;
        carrierGroup.add(deck);

        // 3. 착함 활주선
        const deckLineGeom = new THREE.PlaneGeometry(8, 620);
        deckLineGeom.rotateX(-Math.PI / 2);
        const deckLine = new THREE.Mesh(deckLineGeom, new THREE.MeshBasicMaterial({ color: 0xf5c542 }));
        deckLine.position.set(-15, 30.5, 0);
        carrierGroup.add(deckLine);

        // 4. 함교 아일랜드 타워
        const islandGeom = new THREE.BoxGeometry(25, 45, 90);
        const islandMat = new THREE.MeshStandardMaterial({ color: 0x48525c, roughness: 0.4 });
        const island = new THREE.Mesh(islandGeom, islandMat);
        island.position.set(50, 52, -40);
        carrierGroup.add(island);

        carrierGroup.position.set(0, 0, 800);
        stagePropsGroup.add(carrierGroup);

        // 호위 구축함 2척
        [-800, 800].forEach((sideX, idx) => {
            const shipGeom = new THREE.BoxGeometry(45, 25, 280);
            const ship = new THREE.Mesh(shipGeom, hullMat);
            ship.position.set(sideX, 5, 400 + idx * 700);
            stagePropsGroup.add(ship);
        });

    } else {
        // ==========================================
        // STAGE 3: 도시 (CITY)
        // ==========================================
        currentEnvironment.theme = 'CITY';
        terrainMat.map = cityGroundTexture;
        terrainMat.color.setHex(0x333333);
        terrainMat.roughness = 0.8;
        terrainMat.metalness = 0.2;
        terrainMat.needsUpdate = true;

        // 평평한 도시 대지
        for (let i = 0; i < posAttr.count; i++) {
            posAttr.setY(i, 0);
        }

        // 수백 채의 고층 빌딩과 미래형 마천루 (Skyscrapers) 군집 생성
        const bldgTex = createBuildingTexture(timeOfDay === 'NIGHT');
        const bldgMat = new THREE.MeshStandardMaterial({
            map: bldgTex,
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.6
        });

        const bldgGeom = new THREE.BoxGeometry(1, 1, 1);
        // 350채의 마천루 빌딩 배치
        const cityRange = 16000;
        const gridSize = 450;

        for (let x = -cityRange / 2; x <= cityRange / 2; x += gridSize) {
            for (let z = -cityRange / 2; z <= cityRange / 2; z += gridSize) {
                // 중앙 비행 경로는 빌딩 간격을 살짝 비워두어 시원한 비행로 확보
                if (Math.abs(x) < 350 && Math.abs(z) < 2500) continue;
                if (Math.random() < 0.25) continue; // 자연스러운 도시 빈터

                const bldg = new THREE.Mesh(bldgGeom, bldgMat);
                const bWidth = 120 + Math.random() * 160;
                const bDepth = 120 + Math.random() * 160;
                // 중심부에 가까울수록 초고층 마천루(최대 850m)
                const distFromCenter = Math.hypot(x, z);
                const centerBoost = Math.max(0, 1 - distFromCenter / 7000);
                const bHeight = 150 + Math.random() * 350 + centerBoost * 350;

                bldg.scale.set(bWidth, bHeight, bDepth);
                bldg.position.set(
                    x + (Math.random() - 0.5) * 60,
                    bHeight / 2,
                    z + (Math.random() - 0.5) * 60
                );
                bldg.castShadow = true;
                stagePropsGroup.add(bldg);
            }
        }
    }

    posAttr.needsUpdate = true;
    terrainGeom.computeVertexNormals();
}

export function initEnvironment() {
    ambientLight = new THREE.AmbientLight(0xffffff, 0.45);

    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);

    sunLight.position.set(4000, 5000, -3000);

    scene.add(sunLight);

    hemiLight = new THREE.HemisphereLight(0xa0c8ff, 0xc29a6b, 0.6);

    scene.add(hemiLight);

    skyGeo = new THREE.SphereGeometry(25000, 32, 24);

    skyMat = new THREE.MeshBasicMaterial({
        color: 0x6bb5ff, // 뚜렷한 하늘색
        side: THREE.BackSide
    });

    skyMesh = new THREE.Mesh(skyGeo, skyMat);

    scene.add(skyMesh);

    terrainSize = 80000;

    terrainSegments = 120;

    terrainGeom = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);

    terrainGeom.rotateX(-Math.PI / 2);

    posAttr = terrainGeom.attributes.position;

    for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const z = posAttr.getZ(i);
        // Low undulating dunes + dramatic ridges
        const height = Math.sin(x * 0.0006) * Math.cos(z * 0.0006) * 280 +
                       Math.sin(x * 0.0018 + z * 0.0012) * 110 +
                       (Math.sin(x * 0.0002) * Math.sin(z * 0.0002) > 0.3 ? 750 : 0);
        posAttr.setY(i, Math.max(0, height));
    }

    terrainGeom.computeVertexNormals();

    sandTexture = createSandTexture();

    waterTexture = createWaterTexture();

    cityGroundTexture = createCityGroundTexture();

    terrainMat = new THREE.MeshStandardMaterial({
        map: sandTexture,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
    });

    terrain = new THREE.Mesh(terrainGeom, terrainMat);

    scene.add(terrain);

    stagePropsGroup = new THREE.Group();

    scene.add(stagePropsGroup);

    currentEnvironment = {
        stageId: 1,
        theme: 'DESERT',
        timeOfDay: 'DAY'
    };

    cloudGroupList = [];

    cloudMaterial = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        flatShading: true
    });

    for (let c = 0; c < 120; c++) {
        const cloudBlock = new THREE.Group();
        const puffCount = 4 + Math.floor(Math.random() * 6);

        for(let p = 0; p < puffCount; p++) {
            const size = 200 + Math.random() * 350; // 커다란 구름 덩어리
            const puffGeo = new THREE.SphereGeometry(size, 7, 7); // Low-poly로 성능 최적화
            const puff = new THREE.Mesh(puffGeo, cloudMaterial);
            puff.position.set(
                (Math.random() - 0.5) * 1000,
                (Math.random() - 0.5) * 300,
                (Math.random() - 0.5) * 1000
            );
            puff.scale.set(1, 0.5 + Math.random() * 0.3, 1); // 넓적하게 눌린 형태의 구름
            cloudBlock.add(puff);
        }

        cloudBlock.position.set(
            (Math.random() - 0.5) * 60000,
            3000 + Math.random() * 6000, // 고도 3000 ~ 9000 상공에 배치
            (Math.random() - 0.5) * 60000
        );
        scene.add(cloudBlock);
        cloudGroupList.push(cloudBlock);
    }
}
