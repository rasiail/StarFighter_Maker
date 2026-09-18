// audio/audio: imports are side-effect free; main.js controls initialization.

export let audio;

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterBgmGain = null;
        this.masterSfxGain = null;
        this.engineGain = null;
        this.engineFilter = null;
        this.engineNoise = null;
        this.engineOsc = null;
        this.initialized = false;
        this.lastBeepTime = 0;
        this.bgmVolume = 0.6; // 기본 음악 볼륨 60% 적용
        this.sfxVolume = 0.8;
        this.bgmPlaying = false;
        this.bgmTimer = null;
        this.flightAudioActive = false;

        // 타이틀 및 미션 선택 화면 전용 BGM (Sound/DancingSky.mp3)
        this.titleBgm = new Audio('Sound/DancingSky.mp3');
        this.titleBgm.loop = true;
        this.titleBgm.volume = this.bgmVolume;

        // 인게임 전투 전용 BGM (Sound/StarFighter.mp3)
        this.combatBgm = new Audio('Sound/StarFighter.mp3');
        this.combatBgm.loop = true;
        this.combatBgm.volume = this.bgmVolume;
    }

    playTitleBGM() {
        if (!this.titleBgm) return;
        this.stopCombatBGM(); // 인게임 전투 BGM 정지 후 타이틀 BGM 재생
        this.titleBgm.volume = this.bgmVolume;
        if (this.titleBgm.paused) {
            const playPromise = this.titleBgm.play();
            if (playPromise && playPromise.catch) {
                playPromise.catch(() => {
                    // 브라우저의 오디오 자동재생 정책에 의해 차단 시 사용자 제스처 대기
                });
            }
        }
    }

    stopTitleBGM() {
        if (!this.titleBgm) return;
        this.titleBgm.pause();
        this.titleBgm.currentTime = 0;
    }

    pauseTitleBGM() {
        if (!this.titleBgm) return;
        this.titleBgm.pause();
    }

    playCombatBGM() {
        if (!this.combatBgm) return;
        this.stopTitleBGM(); // 타이틀 BGM 정지 후 전투 BGM 재생
        this.combatBgm.volume = this.bgmVolume;
        if (this.combatBgm.paused) {
            const playPromise = this.combatBgm.play();
            if (playPromise && playPromise.catch) {
                playPromise.catch(() => {
                    // 브라우저의 오디오 자동재생 정책에 의해 차단 시 사용자 제스처 대기
                });
            }
        }
    }

    stopCombatBGM() {
        if (!this.combatBgm) return;
        this.combatBgm.pause();
        this.combatBgm.currentTime = 0;
    }

    pauseCombatBGM() {
        if (!this.combatBgm) return;
        this.combatBgm.pause();
    }

    resumeCombatBGM() {
        if (!this.combatBgm) return;
        if (this.flightAudioActive && this.combatBgm.paused) {
            this.combatBgm.volume = this.bgmVolume;
            this.combatBgm.play().catch(() => {});
        }
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // 마스터 BGM / SFX 게인 노드
        this.masterBgmGain = this.ctx.createGain();
        this.masterBgmGain.gain.value = this.bgmVolume;
        this.masterBgmGain.connect(this.ctx.destination);

        this.masterSfxGain = this.ctx.createGain();
        this.masterSfxGain.gain.value = this.sfxVolume;
        this.masterSfxGain.connect(this.ctx.destination);

        // Master engine sound loop (pink-ish noise + sub oscillator)
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99 * b0 + white * 0.05;
            b1 = 0.96 * b1 + white * 0.11;
            b2 = 0.86 * b2 + white * 0.25;
            output[i] = (b0 + b1 + b2) * 0.5;
        }

        this.engineNoise = this.ctx.createBufferSource();
        this.engineNoise.buffer = noiseBuffer;
        this.engineNoise.loop = true;

        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 450;

        // 초기 볼륨은 0 (출격 시 startFlightAudio에서 활성화)
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.00001;

        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 65;

        const oscGain = this.ctx.createGain();
        oscGain.gain.value = 0.08;
        this.engineOsc.connect(oscGain);
        oscGain.connect(this.engineFilter);

        this.engineNoise.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.masterSfxGain); // SFX 채널 연결

        this.engineNoise.start();
        this.engineOsc.start();
        this.initialized = true;
    }

    startFlightAudio() {
        if (!this.initialized) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.flightAudioActive = true;

        // 인게임 전투 전용 BGM (StarFighter.mp3) 재생
        this.stopTitleBGM();
        this.playCombatBGM();

        if (this.engineGain && this.ctx) {
            this.engineGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.engineGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
            this.engineGain.gain.exponentialRampToValueAtTime(0.22, this.ctx.currentTime + 0.35);
        }
    }

    stopFlightAudio() {
        this.flightAudioActive = false;
        this.stopCombatBGM(); // 전투 BGM 정지
        this.stopProceduralBGM();
        if (this.engineGain && this.ctx) {
            this.engineGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.engineGain.gain.setTargetAtTime(0.00001, this.ctx.currentTime, 0.1);
        }
    }

    stopProceduralBGM() {
        this.bgmPlaying = false;
        if (this.bgmTimer) {
            clearTimeout(this.bgmTimer);
            this.bgmTimer = null;
        }
    }

    setBGMVolume(val) {
        this.bgmVolume = Math.max(0, Math.min(1, val));
        if (this.titleBgm) {
            this.titleBgm.volume = this.bgmVolume;
        }
        if (this.combatBgm) {
            this.combatBgm.volume = this.bgmVolume;
        }
        if (this.masterBgmGain && this.ctx) {
            this.masterBgmGain.gain.setTargetAtTime(this.bgmVolume, this.ctx.currentTime, 0.05);
        }
    }

    setSFXVolume(val) {
        this.sfxVolume = Math.max(0, Math.min(1, val));
        if (this.masterSfxGain && this.ctx) {
            this.masterSfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
        }
    }

    startProceduralBGM() {
        if (!this.initialized || this.bgmPlaying) return;
        this.bgmPlaying = true;

        // 120 BPM 베이스라인 & 아르페지오 루프 생성기
        const notes = [110, 110, 130.81, 146.83, 110, 164.81, 146.83, 130.81]; // A minor 아르페지오
        let step = 0;

        const tick = () => {
            if (!this.bgmPlaying || !this.ctx) return;
            const freq = notes[step % notes.length];
            step++;

            // 서브 베이스 신스
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 600;

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterBgmGain);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.24);

            this.bgmTimer = setTimeout(tick, 220); // 16분 음표 주기
        };
        tick();
    }

    setEngineThrottle(throttlePercent, isAfterburner) {
        if (!this.initialized || !this.ctx || !this.flightAudioActive) return;
        const targetFreq = 300 + throttlePercent * 900 + (isAfterburner ? 700 : 0);
        const targetGain = 0.15 + (throttlePercent * 0.2) + (isAfterburner ? 0.15 : 0);
        const oscFreq = 50 + throttlePercent * 120;

        this.engineFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
        this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
        this.engineOsc.frequency.setTargetAtTime(oscFreq, this.ctx.currentTime, 0.1);
    }

    playGunfire() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.06);

        gain.gain.setValueAtTime(0.28, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);

        osc.connect(gain);
        gain.connect(this.masterSfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.07);
    }

    playMissileLaunch() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.35);

        gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.45);

        osc.connect(gain);
        gain.connect(this.masterSfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.45);
    }

    playExplosion() {
        if (!this.initialized) return;
        const bufferSize = this.ctx.sampleRate * 0.6;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.15));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.5);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.55);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterSfxGain);
        noise.start();
    }

    playLockBeep(locked) {
        if (!this.initialized) return;
        const now = performance.now();
        if (locked) {
            if (now - this.lastBeepTime > 120) {
                this.beep(1200, 0.08, 0.22);
                this.lastBeepTime = now;
            }
        } else {
            if (now - this.lastBeepTime > 380) {
                this.beep(850, 0.09, 0.15);
                this.lastBeepTime = now;
            }
        }
    }

    beep(freq, duration, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.masterSfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
}

export function initAudio() {
    audio = new SoundEngine();
}
