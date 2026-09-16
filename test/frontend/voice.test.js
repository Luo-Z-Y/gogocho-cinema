import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceBoxOffice } from '../../frontend/voice/client.js';

function fixture() {
  const sent = [];
  const voice = new VoiceBoxOffice({ state: () => {}, transcript: () => {}, runTool: async () => ({ results: [] }) });
  voice.active = true;
  voice.ws = { readyState: WebSocket.OPEN, send: value => sent.push(JSON.parse(value)), close: () => {} };
  return { voice, sent };
}

test('a hold tool returns a validated result without starting a second reply', async () => {
  const { voice, sent } = fixture();
  await voice.tool({ name: 'search_screenings', arguments: {}, call_id: 'a' }, voice.generation);
  assert.deepEqual(sent.map(m => m.type), ['tool.result']);
  assert.equal(sent[0].call_id, 'a');
  assert.equal(sent[0].is_error, false);
  await voice.tool({ name: 'confirm_booking', call_id: 'b' }, voice.generation);
  assert.equal(sent[1].is_error, true);
});

test('interruption clears scheduled speech; typed messages wait for the active reply', () => {
  const { voice, sent } = fixture();
  let stopped = 0;
  voice.sources.add({ stop: () => stopped++, disconnect: () => {} });
  voice.event({ type: 'reply.started' }, voice.generation);
  voice.text('Actually, something gentle.');
  assert.equal(sent.length, 0);
  voice.event({ type: 'reply.done', status: 'interrupted' }, voice.generation);
  assert.equal(stopped, 1);
  assert.equal(voice.sources.size, 0);
  assert.deepEqual(sent.map(m => m.type), ['conversation.message', 'reply.create']);
});

test('ending a session releases the mic and discards late tool results', async () => {
  const { voice, sent } = fixture();
  let released = false, finish;
  voice.stream = { getTracks: () => [{ stop: () => { released = true; } }] };
  voice.runTool = () => new Promise(resolve => { finish = resolve; });
  const pending = voice.tool({ name: 'search_screenings', arguments: {}, call_id: 'slow' }, voice.generation);
  voice.stop();
  finish({ results: [] });
  await pending;
  assert.ok(released);
  assert.equal(voice.active, false);
  assert.deepEqual(sent.map(m => m.type), ['session.end']);
});

test('silent microphone frames produce a warning; actual input clears it', () => {
  const { voice } = fixture();
  const readings = [];
  voice.input = (level, message, warning) => readings.push({ level, message, warning });
  voice.captureStartedAt = Date.now() - 9000;
  voice.inspectInput(new ArrayBuffer(960));
  assert.equal(readings.at(-1).level, 0);
  assert.match(readings.at(-1).message, /No sound/);
  assert.ok(readings.at(-1).warning);
  const spoken = new Int16Array(480).fill(2000);
  voice.lastMeterAt = 0;
  voice.inspectInput(spoken.buffer);
  assert.ok(readings.at(-1).level > 0);
  assert.equal(readings.at(-1).message, 'Input detected');
  assert.equal(readings.at(-1).warning, false);
});

test('missing audio frames and a muted device are distinguished from silence', () => {
  const { voice } = fixture();
  voice.captureStartedAt = Date.now() - 5000;
  assert.match(voice.inputWarning(Date.now()), /paused/);
  voice.track = { muted: true };
  assert.match(voice.inputWarning(Date.now()), /muted/);
  assert.deepEqual(voice.constraints('chosen-input').deviceId, { exact: 'chosen-input' });
  assert.equal(voice.constraints('').deviceId, undefined);
});
