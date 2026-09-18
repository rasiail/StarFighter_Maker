// enemies/models: imports are side-effect free; main.js controls initialization.
import { currentEnvironment } from '../world/environment.js';


export function createTankMesh() {
    const tankGroup = new THREE.Group();

    const isDesert = (currentEnvironment && currentEnvironment.stageId === 1);
    const armorMat = new THREE.MeshStandardMaterial({
        color: isDesert ? 0x8a704f : 0x3d4b35, // 사막 위장 탄색 or 올리브 드랩 국방색
        roughness: 0.65,
        metalness: 0.25
    });
    const treadMat = new THREE.MeshStandardMaterial({
        color: 0x1f2226,
        roughness: 0.85,
        metalness: 0.45
    });
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0x2b3036,
        roughness: 0.5,
        metalness: 0.6
    });
    const detailMat = new THREE.MeshStandardMaterial({
        color: 0x353a42,
        roughness: 0.6,
        metalness: 0.3
    });

    // 1. 차체 하부 (Lower Hull)
    const lowerHullGeom = new THREE.BoxGeometry(10, 2.8, 17);
    const lowerHull = new THREE.Mesh(lowerHullGeom, armorMat);
    lowerHull.position.y = 2.4;
    tankGroup.add(lowerHull);

    // 2. 무한궤도 좌/우 (Caterpillar Tracks)
    [-5.5, 5.5].forEach(x => {
        const trackGeom = new THREE.BoxGeometry(2.4, 3.4, 19);
        const track = new THREE.Mesh(trackGeom, treadMat);
        track.position.set(x, 1.7, 0);
        tankGroup.add(track);

        // 트랙 휠(Road Wheels)
        for (let z = -7.5; z <= 7.5; z += 3.75) {
            const wheelGeom = new THREE.CylinderGeometry(1.3, 1.3, 0.4, 10);
            wheelGeom.rotateZ(Math.PI / 2);
            const wheel = new THREE.Mesh(wheelGeom, metalMat);
            wheel.position.set(x + (x > 0 ? 1.1 : -1.1), 1.4, z);
            tankGroup.add(wheel);
        }
    });

    // 3. 차체 상부 경사장갑 (Upper Hull)
    const upperHullGeom = new THREE.BoxGeometry(10.5, 1.6, 14);
    const upperHull = new THREE.Mesh(upperHullGeom, armorMat);
    upperHull.position.set(0, 4.0, 0);
    tankGroup.add(upperHull);

    // 4. 회전 포탑 (Turret)
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 5.0, -0.5);

    // 포탑 본체 (팔각형)
    const turretBodyGeom = new THREE.CylinderGeometry(4.2, 4.8, 2.4, 8);
    const turretBody = new THREE.Mesh(turretBodyGeom, armorMat);
    turretGroup.add(turretBody);

    // 포탑 방패 및 주포
    const mantletGeom = new THREE.BoxGeometry(3.6, 2.0, 2.2);
    const mantlet = new THREE.Mesh(mantletGeom, detailMat);
    mantlet.position.set(0, 0.2, -4.5);
    turretGroup.add(mantlet);

    const barrelGeom = new THREE.CylinderGeometry(0.42, 0.48, 14, 10);
    barrelGeom.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeom, metalMat);
    barrel.position.set(0, 0.2, -11.5);
    turretGroup.add(barrel);

    const muzzleGeom = new THREE.CylinderGeometry(0.7, 0.7, 1.4, 8);
    muzzleGeom.rotateX(Math.PI / 2);
    const muzzle = new THREE.Mesh(muzzleGeom, detailMat);
    muzzle.position.set(0, 0.2, -18.5);
    turretGroup.add(muzzle);

    // 전차장 해치 & 대공 기관총
    const hatchGeom = new THREE.CylinderGeometry(1.2, 1.2, 0.8, 8);
    const hatch = new THREE.Mesh(hatchGeom, detailMat);
    hatch.position.set(1.8, 1.4, 1.2);
    turretGroup.add(hatch);

    const aaGunGeom = new THREE.BoxGeometry(0.3, 0.4, 3.2);
    const aaGun = new THREE.Mesh(aaGunGeom, metalMat);
    aaGun.position.set(1.8, 2.1, 0.6);
    aaGun.rotation.x = -0.3; // 상공 대공 사격 각도
    turretGroup.add(aaGun);

    tankGroup.add(turretGroup);
    tankGroup.turret = turretGroup;

    // 시인성 확보를 위한 스케일 확대 (전장 약 30m 급 중전차)
    tankGroup.scale.set(1.6, 1.6, 1.6);
    tankGroup.colliderRadius = 18.0;

    return tankGroup;
}
export function createBattleshipMesh() {
    const shipGroup = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
        color: 0x404954, // 군함 네이비 그레이
        roughness: 0.7,
        metalness: 0.2
    });
    const deckMat = new THREE.MeshStandardMaterial({
        color: 0x2b323a, // 어두운 갑판
        roughness: 0.85,
        metalness: 0.1
    });
    const bottomMat = new THREE.MeshStandardMaterial({
        color: 0x7a2222, // 흘수선 하부 적색 방오 도료
        roughness: 0.8,
        metalness: 0.1
    });
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0x252a30,
        roughness: 0.5,
        metalness: 0.5
    });
    const turretMat = new THREE.MeshStandardMaterial({
        color: 0x363e47,
        roughness: 0.6,
        metalness: 0.3
    });

    // 1. 하부 흘수선 선체 (Red Bottom Hull, y = -3)
    const underHullGeom = new THREE.BoxGeometry(26, 8, 170);
    const underHull = new THREE.Mesh(underHullGeom, bottomMat);
    underHull.position.y = -3;
    shipGroup.add(underHull);

    // 2. 메인 선체 (Main Grey Hull, y = 6)
    const mainHullGeom = new THREE.BoxGeometry(28, 12, 175);
    const mainHull = new THREE.Mesh(mainHullGeom, hullMat);
    mainHull.position.y = 6;
    shipGroup.add(mainHull);

    // 3. 쐐기형 날렵한 함수 (Bow Wedge, z = -98)
    const bowGeom = new THREE.ConeGeometry(14, 28, 4);
    bowGeom.rotateY(Math.PI / 4);
    bowGeom.rotateX(-Math.PI / 2);
    const bow = new THREE.Mesh(bowGeom, hullMat);
    bow.position.set(0, 6, -98);
    bow.scale.set(1.0, 0.45, 1.0);
    shipGroup.add(bow);

    // 4. 주 갑판 (Main Deck, y = 12.2)
    const deckGeom = new THREE.BoxGeometry(27.4, 0.6, 172);
    const deck = new THREE.Mesh(deckGeom, deckMat);
    deck.position.y = 12.2;
    shipGroup.add(deck);

    // 5. 중앙 상부 구조물 (Superstructure & Command Bridge)
    const bridgeGeom = new THREE.BoxGeometry(18, 16, 45);
    const bridge = new THREE.Mesh(bridgeGeom, hullMat);
    bridge.position.set(0, 20, 0);
    shipGroup.add(bridge);

    // 지휘 함교 상단 타워
    const towerGeom = new THREE.BoxGeometry(12, 10, 22);
    const tower = new THREE.Mesh(towerGeom, metalMat);
    tower.position.set(0, 32, -6);
    shipGroup.add(tower);

    // 연돌 (Smokestack Funnels) 2개
    [-8, 12].forEach(zOffset => {
        const funnelGeom = new THREE.CylinderGeometry(2.8, 3.2, 14, 12);
        funnelGeom.rotateX(-0.15); // 후방 경사 굴뚝
        const funnel = new THREE.Mesh(funnelGeom, metalMat);
        funnel.position.set(0, 31, zOffset);
        shipGroup.add(funnel);
    });

    // 대공 레이더 마스트
    const mastGeom = new THREE.CylinderGeometry(0.5, 0.8, 22, 8);
    const mast = new THREE.Mesh(mastGeom, metalMat);
    mast.position.set(0, 43, -6);
    shipGroup.add(mast);

    const radarAntGeom = new THREE.BoxGeometry(8, 2.5, 1.0);
    const radarAnt = new THREE.Mesh(radarAntGeom, metalMat);
    radarAnt.position.set(0, 48, -6);
    shipGroup.add(radarAnt);
    shipGroup.radarAnt = radarAnt;

    // 6. 주포탑 생성 헬퍼 (3연장 대구경 주포탑)
    function createTurret() {
        const tGroup = new THREE.Group();

        // 8각형 장갑 포탑 본체
        const bodyGeom = new THREE.CylinderGeometry(6.5, 7.5, 4.2, 8);
        const body = new THREE.Mesh(bodyGeom, turretMat);
        tGroup.add(body);

        // 3연장 주포 배럴
        [-2.6, 0, 2.6].forEach(xOffset => {
            const barrelGeom = new THREE.CylinderGeometry(0.65, 0.75, 26, 10);
            barrelGeom.rotateX(Math.PI / 2);
            const barrel = new THREE.Mesh(barrelGeom, metalMat);
            barrel.position.set(xOffset, 0.3, -13);
            tGroup.add(barrel);

            const muzzleGeom = new THREE.CylinderGeometry(0.9, 0.9, 2.0, 8);
            muzzleGeom.rotateX(Math.PI / 2);
            const muzzle = new THREE.Mesh(muzzleGeom, metalMat);
            muzzle.position.set(xOffset, 0.3, -25.5);
            tGroup.add(muzzle);
        });

        return tGroup;
    }

    // 전방 주포탑 (Turret #1 - Forward)
    const fwdTurret = createTurret();
    fwdTurret.position.set(0, 14.2, -50);
    shipGroup.add(fwdTurret);
    shipGroup.fwdTurret = fwdTurret;

    // 후방 주포탑 (Turret #2 - Aft)
    const aftTurret = createTurret();
    aftTurret.position.set(0, 14.2, 50);
    aftTurret.rotation.y = Math.PI; // 기본 후방 지향
    shipGroup.add(aftTurret);
    shipGroup.aftTurret = aftTurret;

    shipGroup.hullMat = hullMat;
    shipGroup.deckMat = deckMat;
    shipGroup.turretMat = turretMat;

    return shipGroup;
}
