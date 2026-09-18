// Temporary low-poly swarm models. Geometry/materials are shared across the fleet.
// Final modular mechanical-fish assets can replace this factory without touching AI.
let bodyGeometry, wingGeometry, tailGeometry, material, bossMaterial, sensorMaterial, sensorGeometry;
export function createDroneMesh(isBoss = false) {
    if (!bodyGeometry) {
        bodyGeometry = new THREE.ConeGeometry(1.8, 12, 6);
        bodyGeometry.rotateX(-Math.PI / 2);
        wingGeometry = new THREE.BoxGeometry(12, 0.35, 3);
        tailGeometry = new THREE.BoxGeometry(0.35, 3.5, 3);
        sensorGeometry = new THREE.SphereGeometry(0.6, 6, 4);
        material = new THREE.MeshStandardMaterial({ color: 0xacb4bf, roughness: 0.85, metalness: 0.35 });
        bossMaterial = new THREE.MeshStandardMaterial({ color: 0xe29b40, roughness: 0.65, metalness: 0.55 });
        sensorMaterial = new THREE.MeshBasicMaterial({ color: 0xff3849 });
    }
    const group = new THREE.Group();
    const hullMaterial = isBoss ? bossMaterial : material;
    group.add(new THREE.Mesh(bodyGeometry, hullMaterial));
    const wing = new THREE.Mesh(wingGeometry, hullMaterial);
    wing.position.z = 1;
    group.add(wing);
    const tail = new THREE.Mesh(tailGeometry, hullMaterial);
    tail.position.set(0, 1, 4);
    group.add(tail);
    const sensor = new THREE.Mesh(sensorGeometry, sensorMaterial);
    sensor.position.set(0, 1, -3);
    group.add(sensor);
    return group;
}
