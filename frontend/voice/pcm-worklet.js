/**
 * Audio-thread adapter from the browser capture rate to the provider's format.
 *
 * Read mono float samples, linearly interpolate at 24 kHz, and transfer 20 ms
 * signed PCM16 frames to the main thread. No network or DOM work belongs here.
 * Outputs remain untouched (silent), so connecting this node to the destination
 * keeps processing alive without playing the microphone through the speakers.
 * Linear interpolation is a simple timing-preserving conversion, not a full
 * band-limited resampling filter; real audio quality needs separate checks.
 */
class CinemaPCM extends AudioWorkletProcessor {
  constructor(options) {
    super();
    // How far to advance through input samples for each output sample. At 48 kHz
    // this is 2; at 44.1 kHz it is fractional and must survive render boundaries.
    this.ratio = options.processorOptions.inputSampleRate / 24000;
    this.samples = [];
    this.position = 0;
    // 24,000 samples/s * 0.020 s = 480 samples; signed 16-bit mono uses two bytes
    // each. DataView fixes the wire byte order independently of host endianness.
    this.frame = new ArrayBuffer(960); // 20 ms of mono, signed PCM16 at 24 kHz.
    this.view = new DataView(this.frame);
    this.used = 0;
  }
  /**
   * Web Audio calls this for successive render blocks. Use only the first input's
   * first channel, matching the mono getUserMedia request. Returning true keeps
   * the processor available even when a render block has no connected input.
   */
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    this.samples.push(...input);
    // Interpolation needs two neighbouring samples. Keep fractional position and
    // an unconsumed boundary sample across calls instead of restarting rounding
    // for every render block, which would change audio timing over time.
    while (this.position + 1 < this.samples.length) {
      const index = Math.floor(this.position), fraction = this.position - index;
      const value = this.samples[index] * (1 - fraction) + this.samples[index + 1] * fraction;
      // Convert float amplitude to the signed 16-bit range, clamp peaks, and
      // write little-endian samples. The index is in bytes, not sample numbers.
      this.view.setInt16(this.used * 2, Math.max(-32768, Math.min(32767, Math.round(value * 32767))), true);
      this.used++;
      if (this.used === 480) {
        // Transfer ownership instead of copying each frame. The old buffer is
        // detached in the worklet, so allocate fresh storage before continuing.
        this.port.postMessage(this.frame, [this.frame]);
        this.frame = new ArrayBuffer(960);
        this.view = new DataView(this.frame);
        this.used = 0;
      }
      this.position += this.ratio;
    }
    // Discard consumed input but retain a neighbour for the next interpolation.
    // Rebase the fractional cursor to the shortened array; a partly filled output
    // frame stays in this.used until later input completes its 480 samples.
    const consumed = Math.min(Math.floor(this.position), this.samples.length - 1);
    this.samples.splice(0, consumed);
    this.position -= consumed;
    return true;
  }
}
// This name must match AudioWorkletNode(..., 'gogocho-pcm') in voice/client.js.
registerProcessor('gogocho-pcm', CinemaPCM);
