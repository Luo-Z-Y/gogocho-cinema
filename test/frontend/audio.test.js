/**
 * Execute the real worklet source in a small simulated AudioWorklet environment.
 * The VM captures frame messages without requiring a browser/device/provider.
 * It checks sample arithmetic and wire format, not real-time scheduling quality.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync(new URL('../../frontend/voice/pcm-worklet.js', import.meta.url), 'utf8');
// Cover a matching input rate, a fractional conversion ratio and a 2:1 ratio.
// The 44.1 kHz case is especially sensitive to rounding at render-block edges.
for (const rate of [24000, 44100, 48000]) test(`audio preserves timing across blocks at ${rate} Hz`, () => {
  let Processor;
  const frames = [];
  // Supply only the globals the processor needs. registerProcessor exposes its
  // class to the test; postMessage records buffers rather than using a real port.
  vm.runInNewContext(code, {
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: b => frames.push(b) }; } },
    registerProcessor: (_name, value) => { Processor = value; }
  });
  const worklet = new Processor({ processorOptions: { inputSampleRate: rate } });
  // Feed one second in render-sized blocks, including a shorter final block.
  // A constant half-amplitude input makes the expected PCM value easy to verify.
  for (let start = 0; start < rate; start += 128) worklet.process([[new Float32Array(Math.min(128, rate - start)).fill(0.5)]]);
  // Include the partial frame still held by the processor. One sample of edge
  // tolerance accounts for interpolation's look-ahead neighbour; repeated per-
  // block rounding errors would exceed this allowance by the end of the second.
  const count = frames.length * 480 + worklet.used;
  assert.ok(Math.abs(count - 24000) <= 1, `one second produced ${count} samples`);
  assert.ok(frames.every(b => b.byteLength === 960));
  assert.equal(new DataView(frames[0]).getInt16(0, true), 16384);
});
