import { createPlayerFlight } from './state.js';
// player/player: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { createF104Mesh } from '../assets/aircraft.js';
import { camera, scene } from '../rendering/scene.js';
import { JetExhaustSystem } from '../effects/exhaust.js';

export let playerMesh;
export let playerFlight;


export function initPlayer() {
    playerMesh = createF104Mesh(false);

    playerMesh.position.set(0, 600, 1200);

    scene.add(playerMesh);

    window.player = playerMesh;

    gameState.cameraPivot = new THREE.Group();

    gameState.cameraPivot.name = "cameraPivot";

    gameState.cameraPivot.rotation.order = 'YXZ';

    gameState.cameraPivot.position.set(0, 0.4, 0);

    playerMesh.add(gameState.cameraPivot);

    gameState.cameraPivot.add(camera);

    camera.position.set(0, 1.4, 6.25);

    camera.rotation.set(-0.13, 0, 0);

    gameState.jetExhaustSystem = new JetExhaustSystem();

    playerFlight = createPlayerFlight(new THREE.Vector3(0, 0, -1));
}
