// rendering/retro: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';

export let retroRenderTarget;
export let retroPostScene;
export let retroPostCamera;
let retroQuad;
export let retroMaterial;
let retroVertexShader;
let retroFragmentShader;

function initRetroShader() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    retroRenderTarget = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat
    });

    retroPostScene = new THREE.Scene();
    retroPostCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    retroMaterial = new THREE.ShaderMaterial({
        vertexShader: retroVertexShader,
        fragmentShader: retroFragmentShader,
        uniforms: {
            tDiffuse: { value: retroRenderTarget.texture },
            uResolution: { value: new THREE.Vector2(w, h) },
            uPixelSize: { value: 2.4 },
            uColorLevels: { value: 18.0 }
        },
        depthTest: false,
        depthWrite: false
    });

    const quadGeom = new THREE.PlaneGeometry(2, 2);
    retroQuad = new THREE.Mesh(quadGeom, retroMaterial);
    retroPostScene.add(retroQuad);
}

export function initRetro() {
    gameState.retroFilterEnabled = true;

    retroRenderTarget = null;

    retroPostScene = null;

    retroPostCamera = null;

    retroQuad = null;

    retroMaterial = null;

    retroVertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
        }
    `;

    retroFragmentShader = `
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uPixelSize;
        uniform float uColorLevels;
        varying vec2 vUv;

        // 4x4 Ordered Bayer Matrix
        float getBayer4(vec2 coord) {
            vec2 bCoord = floor(mod(coord, 4.0));
            int x = int(bCoord.x);
            int y = int(bCoord.y);
            int idx = x + y * 4;
            if (idx == 0) return 0.0 / 16.0;
            if (idx == 1) return 8.0 / 16.0;
            if (idx == 2) return 2.0 / 16.0;
            if (idx == 3) return 10.0 / 16.0;
            if (idx == 4) return 12.0 / 16.0;
            if (idx == 5) return 4.0 / 16.0;
            if (idx == 6) return 14.0 / 16.0;
            if (idx == 7) return 6.0 / 16.0;
            if (idx == 8) return 3.0 / 16.0;
            if (idx == 9) return 11.0 / 16.0;
            if (idx == 10) return 1.0 / 16.0;
            if (idx == 11) return 9.0 / 16.0;
            if (idx == 12) return 15.0 / 16.0;
            if (idx == 13) return 7.0 / 16.0;
            if (idx == 14) return 13.0 / 16.0;
            return 5.0 / 16.0;
        }

        void main() {
            // 1. 도트 픽셀화 (깔끔한 픽셀 그리드)
            vec2 pixelCoord = floor(vUv * uResolution / uPixelSize);
            vec2 uvPix = (pixelCoord + 0.5) * uPixelSize / uResolution;

            vec4 baseCol = texture2D(tDiffuse, uvPix);

            // 2. 은은한 미세 베이어 디더링 (과도한 모아레 노이즈 제거: 0.25 수준)
            float bayerVal = getBayer4(pixelCoord);
            float dither = (bayerVal - 0.5) * (0.25 / uColorLevels);

            // 3. 자연스러운 레트로 색상 양자화 (아웃라인 제외)
            vec3 col = baseCol.rgb + vec3(dither);
            col = floor(col * uColorLevels + 0.5) / uColorLevels;

            gl_FragColor = vec4(col, 1.0);
        }
    `;

    initRetroShader();
}
