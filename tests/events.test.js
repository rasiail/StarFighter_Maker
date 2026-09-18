import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventBus } from '../src/core/events.js';

test('전투 결과가 미션/성장 구독자에 동기적으로 전달되고 구독 해제가 가능하다', () => {
    const events = createEventBus();
    const calls = [];
    const unsubscribe = events.on('enemy:destroyed', result => calls.push(['mission', result.killCount]));
    events.on('enemy:destroyed', result => calls.push(['progression', result.killCount]));
    events.emit('enemy:destroyed', { killCount: 1 });
    unsubscribe();
    events.emit('enemy:destroyed', { killCount: 2 });
    assert.deepEqual(calls, [['mission', 1], ['progression', 1], ['progression', 2]]);
});

test('이벤트 전파 중 추가한 구독자는 다음 이벤트부터 실행된다', () => {
    const events = createEventBus();
    const calls = [];
    const later = () => calls.push('later');
    events.on('hit', () => { calls.push('first'); events.on('hit', later); });
    events.emit('hit');
    assert.deepEqual(calls, ['first']);
    events.emit('hit');
    assert.deepEqual(calls, ['first', 'first', 'later']);
});
