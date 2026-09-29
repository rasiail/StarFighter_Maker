import test from 'node:test';
import assert from 'node:assert/strict';
import { initAudio, audio } from '../src/audio/audio.js';

test('beam pulse and hold use SFX volume, reuse the hold voice, and release audio nodes', () => {
    const previousAudio = globalThis.Audio;
    globalThis.Audio = class {};
    try { initAudio(); } finally {
        if (previousAudio === undefined) delete globalThis.Audio;
        else globalThis.Audio = previousAudio;
    }
    const oscillators = [], gains = [];
    const param = () => ({ value: 0, setValueAtTime(value) { this.value = value; },
        exponentialRampToValueAtTime(value) { this.value = value; },
        setTargetAtTime(value) { this.value = value; }, cancelScheduledValues() {} });
    const node = () => ({ connect(target) { this.target = target; }, disconnect() { this.disconnected = true; } });
    audio.ctx = {
        currentTime: 10,
        createOscillator() {
            const oscillator = { ...node(), frequency: param(), start() { this.started = true; }, stop(at) { this.stoppedAt = at; } };
            oscillators.push(oscillator);
            return oscillator;
        },
        createGain() { const gain = { ...node(), gain: param() }; gains.push(gain); return gain; },
    };
    audio.masterSfxGain = { gain: param() };
    audio.initialized = true;
    audio.playBeamPulse();
    assert.equal(gains[0].target, audio.masterSfxGain);
    assert.equal(oscillators[0].stoppedAt, 10.23);
    oscillators[0].onended();
    assert.ok(oscillators[0].disconnected && gains[0].disconnected);
    audio.setBeamHold(1);
    const voice = audio.beamHoldVoice;
    assert.equal(voice.gain.target, audio.masterSfxGain);
    assert.equal(voice.oscillator.frequency.value, 160);
    audio.setBeamHold(3);
    assert.equal(audio.beamHoldVoice, voice, 'one persistent voice, not one per frame');
    assert.equal(voice.oscillator.frequency.value, 340);
    audio.setSFXVolume(0);
    assert.equal(audio.masterSfxGain.gain.value, 0);
    audio.stopBeamHold();
    audio.stopBeamHold();
    assert.equal(audio.beamHoldVoice, null);
    assert.equal(voice.oscillator.stoppedAt, 10.06);
    assert.equal(voice.overtone.stoppedAt, 10.06);
    voice.oscillator.onended();
    assert.ok(voice.oscillator.disconnected && voice.overtone.disconnected && voice.gain.disconnected);
});
