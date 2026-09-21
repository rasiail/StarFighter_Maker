import * as THREE from 'three';
import { createF104Mesh } from './src/assets/aircraft.js';

// mock globals
globalThis.isFBXReady = true;
globalThis.fbxModelTemplate = new THREE.Group();
globalThis.fbxModelTemplate.add(new THREE.Mesh());
globalThis.playerPbrMat = new THREE.Material();

const mesh = createF104Mesh();
console.log('Mesh created:', mesh !== null);
console.log('Mesh baseGlow:', mesh.baseGlow !== undefined);
console.log('Mesh baseGlows:', mesh.baseGlows !== undefined);
