// AssemblyAI owns the voice session; only single-use tokens reach this client.
export class VoiceBoxOffice {
  constructor({ post, runTool, transcript, state, input = () => {}, devices = () => {} }) {
    Object.assign(this, { post, runTool, transcript, state, input, devices });
    this.active = false;
    this.generation = 0;
    this.sources = new Set();
    this.pendingMessages = [];
    this.agentText = new Map();
  }

  async start(deviceId = '', testOnly = false) {
    if (this.active || this.starting || this.testing) return;
    this.starting = true;
    this.testing = testOnly;
    this.lastFrameAt = this.lastSoundAt = 0;
    this.peakLevel = 0;
    this.lastMeterAt = 0;
    this.state(false, testOnly ? 'Say a few words to test your mic…' : 'Connecting…');
    const generation = ++this.generation;
    const current = () => generation === this.generation;
    this.connectTimer = setTimeout(() => this.stop('Connection timed out. Please try again.'), 30000);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.AudioContext) throw new Error('Use a current browser on localhost to enable your microphone.');
      // Create and resume audio in the click gesture, at the hardware rate.
      this.capture = new AudioContext();
      this.playback = new AudioContext();
      await Promise.all([this.capture.resume(), this.playback.resume()]);
      if (!current()) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: this.constraints(deviceId) });
      if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      this.track = stream.getAudioTracks()[0];
      this.bindTrack();
      // Bluetooth can change the hardware audio route when microphone access starts.
      await Promise.all([this.capture.resume(), this.playback.resume()]);
      if (!current()) return;
      await this.listInputs();
      if (!current()) return;
      await this.capture.audioWorklet.addModule('/pcm-worklet.js');
      if (!current()) return;
      this.mic = this.capture.createMediaStreamSource(stream);
      this.worklet = new AudioWorkletNode(this.capture, 'gogocho-pcm', { processorOptions: { inputSampleRate: this.capture.sampleRate } });
      this.worklet.port.onmessage = ({ data }) => {
        if (!current()) return;
        this.inspectInput(data);
        if (this.active && current()) {
          if (this.ws.bufferedAmount > 192000) { this.stop('The connection is too slow for live audio. Please try again.'); return; }
          this.send({ type: 'input.audio', audio: btoa(String.fromCharCode(...new Uint8Array(data))) });
        }
      };
      // The worklet produces silent output, so the mic is never monitored locally.
      this.mic.connect(this.worklet).connect(this.capture.destination);
      this.captureStartedAt = Date.now();
      this.micTimer = setInterval(() => this.checkInput(), 1000);
      if (testOnly) {
        clearTimeout(this.connectTimer);
        this.starting = false;
        this.testTimer = setTimeout(() => {
          const detected = this.peakLevel >= 0.002;
          this.stop(detected ? 'Microphone detected. Ready to talk.' : 'No sound detected. Check your input.');
        }, 6000);
        return;
      }
      const { token, config } = await this.post('/api/voice-session', {});
      if (!current()) return;
      const url = new URL('wss://agents.assemblyai.com/v1/ws');
      url.searchParams.set('token', token);
      const ws = this.ws = new WebSocket(url);
      ws.onopen = () => { if (current()) this.send({ type: 'session.update', session: config }); };
      ws.onmessage = ({ data }) => {
        if (!current()) return;
        try { this.event(JSON.parse(data), generation); }
        catch { this.stop('The voice service sent an unreadable response. Please reconnect.'); }
      };
      ws.onerror = () => { if (current()) this.stop('Could not connect to AssemblyAI. Please try again.'); };
      ws.onclose = () => { if (current()) this.stop('Conversation disconnected. You can start again.'); };
    } catch (error) {
      if (current()) this.stop(error.name === 'NotAllowedError' ? 'Microphone permission was declined. Allow it in your browser, then try again.' : error.message);
    }
  }

  constraints(deviceId) {
    return { echoCancellation: true, noiseSuppression: false, channelCount: 1, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) };
  }

  async listInputs() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
      this.devices(inputs.map(d => ({ id: d.deviceId, label: d.label || 'Microphone' })), this.track?.getSettings().deviceId);
    } catch { /* Device discovery must not prevent a permitted mic from working. */ }
  }

  bindTrack() {
    this.track.onended = () => this.stop('Microphone disconnected. Choose an input and restart.');
    this.track.onmute = () => this.input(0, 'Microphone muted. Check your input.', true);
  }

  async changeInput(deviceId) {
    if (!this.active) return;
    const generation = this.generation;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: this.constraints(deviceId) });
      if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      const mic = this.capture.createMediaStreamSource(stream);
      mic.connect(this.worklet);
      this.mic.disconnect();
      this.stream.getTracks().forEach(t => { t.onended = null; t.onmute = null; t.stop(); });
      this.stream = stream; this.mic = mic; this.track = stream.getAudioTracks()[0];
      this.bindTrack();
      this.lastFrameAt = this.lastSoundAt = 0; this.peakLevel = 0;
      this.captureStartedAt = Date.now();
      await this.capture.resume();
      await this.listInputs();
    } catch {
      if (stream && stream !== this.stream) stream.getTracks().forEach(t => t.stop());
      this.input(0, 'Could not switch microphone. Check the selected input.', true);
      await this.listInputs();
    }
  }

  inspectInput(buffer) {
    const samples = new DataView(buffer);
    let energy = 0;
    for (let i = 0; i < samples.byteLength; i += 2) energy += (samples.getInt16(i, true) / 32768) ** 2;
    const rms = Math.sqrt(energy / Math.max(1, samples.byteLength / 2));
    const now = Date.now();
    this.lastFrameAt = now;
    this.peakLevel = Math.max(this.peakLevel || 0, rms);
    if (rms >= 0.002) this.lastSoundAt = now;
    if (!this.lastMeterAt || now - this.lastMeterAt >= 100) {
      this.lastMeterAt = now;
      const heard = now - (this.lastSoundAt || 0) < 1500;
      const warning = this.inputWarning(now);
      this.input(Math.min(1, rms * 12), warning || (heard ? 'Input detected' : 'Speak to check your mic'), Boolean(warning));
    }
  }

  checkInput() {
    const warning = this.inputWarning(Date.now());
    if (warning) this.input(0, warning, true);
  }

  inputWarning(now) {
    if (this.track?.muted) return 'Microphone muted. Check your input.';
    if (now - (this.lastFrameAt || this.captureStartedAt) > 4000) return 'Microphone paused. Restart or choose another input.';
    if (now - (this.lastSoundAt || this.captureStartedAt) > 8000) return 'No sound detected. Check your input.';
    return '';
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  event(message, generation) {
    if (message.type === 'session.ready') {
      clearTimeout(this.connectTimer);
      this.starting = false;
      this.active = true;
      this.state(true, 'Connected. Speak when ready.');
      this.sessionTimer = setTimeout(() => this.stop('Your ten-minute demo session has ended.'), 600000);
    } else if (message.type === 'reply.started') {
      this.replyActive = true;
    } else if (message.type === 'reply.audio' && this.active) {
      this.play(message.data);
    } else if (message.type === 'reply.done') {
      this.replyActive = false;
      if (message.status === 'interrupted') this.clearPlayback();
      this.flushMessages();
    } else if (message.type === 'transcript.user' || message.type === 'transcript.user.delta') {
      this.transcript('user', message.text, `user-${message.item_id}`);
    } else if (message.type === 'transcript.agent.delta') {
      const id = `agent-${message.item_id || message.reply_id}`;
      const text = (this.agentText.get(id) || '') + message.delta;
      this.agentText.set(id, text);
      this.transcript('agent', text, id);
    } else if (message.type === 'transcript.agent') {
      const id = `agent-${message.item_id || message.reply_id}`;
      this.agentText.delete(id);
      this.transcript('agent', message.text, id);
    } else if (message.type === 'tool.call') {
      // Both configured tools use hold mode; results resume the reply automatically.
      this.tool(message, generation);
    } else if (message.type === 'session.error' || message.type === 'error') {
      this.stop('AssemblyAI could not continue the conversation. Check API access and credits, then reconnect.');
    } else if (message.type === 'session.ended') {
      this.stop('Conversation ended. Thanks for dropping by.');
    }
  }

  async tool(message, generation) {
    let result, is_error = false;
    try {
      if (!['search_screenings', 'prepare_booking'].includes(message.name)) throw new Error('Unknown cinema tool.');
      result = await this.runTool(message.name, message.arguments);
    } catch (error) { result = { error: error.message }; is_error = true; }
    if (this.active && generation === this.generation) this.send({ type: 'tool.result', call_id: message.call_id, result: JSON.stringify(result), is_error });
  }

  play(data) {
    const raw = atob(data);
    if (!raw.length || raw.length % 2) return;
    const buffer = this.playback.createBuffer(1, raw.length / 2, 24000);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const unsigned = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
      samples[i] = (unsigned >= 32768 ? unsigned - 65536 : unsigned) / 32768;
    }
    const source = this.playback.createBufferSource();
    source.buffer = buffer;
    source.connect(this.playback.destination);
    this.sources.add(source);
    source.onended = () => { source.disconnect(); this.sources.delete(source); };
    this.playAt = Math.max(this.playAt || 0, this.playback.currentTime + 0.015);
    source.start(this.playAt);
    this.playAt += buffer.duration;
  }

  text(content) {
    if (!this.active) return;
    this.transcript('user', content, `typed-${crypto.randomUUID()}`);
    this.pendingMessages.push({ role: 'user', content });
    this.flushMessages();
  }

  context(content) {
    if (!this.active) return;
    this.pendingMessages.push({ role: 'system', content });
    this.flushMessages();
  }

  flushMessages() {
    if (!this.active || this.replyActive || !this.pendingMessages.length) return;
    for (const message of this.pendingMessages.splice(0)) this.send({ type: 'conversation.message', ...message });
    this.replyActive = true;
    this.send({ type: 'reply.create' });
  }

  clearPlayback() {
    for (const source of this.sources) { try { source.stop(); source.disconnect(); } catch { /* Already ended. */ } }
    this.sources.clear();
    this.playAt = 0;
  }

  stop(message = 'Conversation ended. Thanks for dropping by.') {
    ++this.generation;
    this.active = false;
    this.starting = false;
    this.testing = false;
    clearTimeout(this.connectTimer);
    clearTimeout(this.sessionTimer);
    clearTimeout(this.testTimer);
    clearInterval(this.micTimer);
    this.send({ type: 'session.end' });
    if (this.ws) { this.ws.onclose = null; this.ws.onerror = null; this.ws.onmessage = null; this.ws.close(); this.ws = null; }
    this.stream?.getTracks().forEach(track => { track.onended = null; track.onmute = null; track.stop(); });
    this.mic?.disconnect();
    if (this.worklet) { this.worklet.port.onmessage = null; this.worklet.disconnect(); }
    this.clearPlayback();
    this.capture?.close().catch(() => {});
    this.playback?.close().catch(() => {});
    this.capture = this.playback = this.stream = this.mic = this.worklet = null;
    this.track = null;
    this.input(0, message.startsWith('No sound') ? message : '', message.startsWith('No sound'));
    this.replyActive = false;
    this.pendingMessages = [];
    this.agentText.clear();
    this.state(false, message);
  }
}
