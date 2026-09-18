// rendering/scene: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';

export let container;
let webglCanvas;
export let hudCanvas;
export let hudCtx;
export let scene;
export let camera;
export let renderer;


export function initScene() {
    container = document.getElementById('game-container');

    webglCanvas = document.getElementById('webgl-canvas');

    hudCanvas = document.getElementById('hud-canvas');

    hudCtx = hudCanvas.getContext('2d');

    scene = new THREE.Scene();

    scene.fog = new THREE.FogExp2(0xa0c8ff, 0.00008);

    scene.background = new THREE.Color(0x6bb5ff);

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 40000);

    gameState.cameraPivot = null;

    renderer = new THREE.WebGLRenderer({ canvas: webglCanvas, antialias: true, powerPreference: 'high-performance' });

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1.15;

    renderer.outputEncoding = THREE.sRGBEncoding;
}
