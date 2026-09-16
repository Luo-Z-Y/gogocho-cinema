class CinemaPCM extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ratio = options.processorOptions.inputSampleRate / 24000;
    this.samples = [];
    this.position = 0;
    this.frame = new ArrayBuffer(960); // 20 ms of mono, signed PCM16 at 24 kHz.
    this.view = new DataView(this.frame);
    this.used = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    this.samples.push(...input);
    // Preserve fractional position across render blocks, including 44.1 kHz devices.
    while (this.position + 1 < this.samples.length) {
      const index = Math.floor(this.position), fraction = this.position - index;
      const value = this.samples[index] * (1 - fraction) + this.samples[index + 1] * fraction;
      this.view.setInt16(this.used * 2, Math.max(-32768, Math.min(32767, Math.round(value * 32767))), true);
      this.used++;
      if (this.used === 480) {
        this.port.postMessage(this.frame, [this.frame]);
        this.frame = new ArrayBuffer(960);
        this.view = new DataView(this.frame);
        this.used = 0;
      }
      this.position += this.ratio;
    }
    const consumed = Math.min(Math.floor(this.position), this.samples.length - 1);
    this.samples.splice(0, consumed);
    this.position -= consumed;
    return true;
  }
}
registerProcessor('gogocho-pcm', CinemaPCM);
