let template;
// Broad swept wings, four engine pods and cardinal missile launchers.
export function createBomberMesh() {
    if (!template) {
        template = new THREE.Group();
        const armor = new THREE.MeshStandardMaterial({ color: 0x394352, metalness: 0.75, roughness: 0.5 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x151e2c, metalness: 0.6, roughness: 0.6 });
        const light = new THREE.MeshBasicMaterial({ color: 0xff8039 });
        const add = (geometry, material, x, y, z) => {
            const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); template.add(mesh); return mesh;
        };
        add(new THREE.BoxGeometry(2.8, 1.2, 10), armor, 0, 0, 0);
        const nose = new THREE.ConeGeometry(1.4, 3.5, 4); nose.rotateX(-Math.PI / 2);
        add(nose, armor, 0, 0, -6.5);
        add(new THREE.BoxGeometry(1.4, 0.5, 2.2), dark, 0, 0.7, -3);
        for (const side of [-1, 1]) {
            const wing = add(new THREE.BoxGeometry(9, 0.35, 4), armor, side * 5, 0, 1);
            wing.rotation.y = side * -0.3;
            const tail = add(new THREE.BoxGeometry(0.3, 2.6, 2.5), armor, side * 1.5, 1, 4);
            tail.rotation.z = side * -0.3;
            for (const x of [3.5, 6]) {
                add(new THREE.BoxGeometry(1.2, 1.1, 4), dark, side * x, -0.65, 1.8);
                add(new THREE.BoxGeometry(0.8, 0.6, 0.15), light, side * x, -0.65, 3.9);
            }
        }
        for (const [x, z] of [[0,-4],[4,0],[0,4],[-4,0]]) {
            add(new THREE.BoxGeometry(1.1, 0.8, 1.1), dark, x, 0.9, z);
            add(new THREE.BoxGeometry(0.7, 0.15, 0.7), light, x, 1.35, z);
        }
    }
    const group = template.clone(true);
    const warning = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff3311 }));
    warning.position.set(0, 1.8, 0); warning.visible = false;
    group.add(warning); group.userData.salvoLight = warning;
    return group;
}
