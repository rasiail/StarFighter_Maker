import { initAudio } from './audio/audio.js';
import { initAircraft } from './assets/aircraft.js';
import { initExhaust } from './effects/exhaust.js';
import { initScene } from './rendering/scene.js';
import { initRetro } from './rendering/retro.js';
import { initEnvironment } from './world/environment.js';
import { initPlayer } from './player/player.js';
import { initInputState } from './input/state.js';
import { initWeapons } from './combat/weapons.js';
import { initParticles } from './effects/particles.js';
import { initEnemies } from './enemies/fleet.js';
import { initTargeting } from './combat/targeting.js';
import { initCamera } from './camera/camera.js';
import { initLoop } from './core/loop.js';
import { initEnemyAI } from './enemies/ai.js';
import { initControls } from './input/controls.js';
import { initSession } from './core/session.js';
import { initPointerLock } from './input/pointer-lock.js';
import { initMissions } from './game/missions.js';
import { initMenus } from './ui/menus.js';
import { initProgression } from './progression/runtime.js';
import { initUpgrades } from './ui/upgrades.js';

// Initialize once, in dependency order, after the document is parsed.
initAudio();
initAircraft();
initExhaust();
initScene();
initRetro();
initEnvironment();
initPlayer();
initInputState();
initWeapons();
initParticles();
initEnemies();
initTargeting();
initCamera();
initEnemyAI();
initControls();
initSession();
initPointerLock();
initProgression(); // Reward the final kill before any mission transition.
initMissions();
initMenus();
initUpgrades();

// Start the frame loop only after every system and listener is ready.
initLoop();
