import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync(new URL('../../frontend/voice/pcm-worklet.js', import.meta.url), 'utf8');
for (const rate of [24000, 44100, 48000]) test(`audio preserves timing across blocks at ${rate} Hz`, () => {
  let Processor;
  const frames = [];
  vm.runInNewContext(code, {
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: b => frames.push(b) }; } },
    registerProcessor: (_name, value) => { Processor = value; }
  });
  const worklet = new Processor({ processorOptions: { inputSampleRate: rate } });
  for (let start = 0; start < rate; start += 128) worklet.process([[new Float32Array(Math.min(128, rate - start)).fill(0.5)]]);
  const count = frames.length * 480 + worklet.used;
  assert.ok(Math.abs(count - 24000) <= 1, `one second produced ${count} samples`);
  assert.ok(frames.every(b => b.byteLength === 960));
  assert.equal(new DataView(frames[0]).getInt16(0, true), 16384);
});
