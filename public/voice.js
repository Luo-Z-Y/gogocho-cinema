// AssemblyAI owns the voice session; only single-use tokens reach this client.
export class VoiceBoxOffice {
  constructor({ post, runTool, transcript, state }) {
    Object.assign(this, { post, runTool, transcript, state });
    this.active = false;
    this.generation = 0;
    this.sources = new Set();
    this.pendingMessages = [];
    this.agentText = new Map();
  }

  async start() {
    if (this.active || this.starting) return;
    this.starting = true;
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, channelCount: 1 } });
      if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      await this.capture.audioWorklet.addModule('/pcm-worklet.js');
      if (!current()) return;
      this.mic = this.capture.createMediaStreamSource(stream);
      this.worklet = new AudioWorkletNode(this.capture, 'gogocho-pcm', { processorOptions: { inputSampleRate: this.capture.sampleRate } });
      this.worklet.port.onmessage = ({ data }) => {
        if (this.active && current()) {
          if (this.ws.bufferedAmount > 192000) { this.stop('The connection is too slow for live audio. Please try again.'); return; }
          this.send({ type: 'input.audio', audio: btoa(String.fromCharCode(...new Uint8Array(data))) });
        }
      };
      // The worklet produces silent output, so the mic is never monitored locally.
      this.mic.connect(this.worklet).connect(this.capture.destination);
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

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  event(message, generation) {
    if (message.type === 'session.ready') {
      clearTimeout(this.connectTimer);
      this.starting = false;
      this.active = true;
      this.state(true, 'Listening. You can interrupt or type below.');
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
    clearTimeout(this.connectTimer);
    clearTimeout(this.sessionTimer);
    this.send({ type: 'session.end' });
    if (this.ws) { this.ws.onclose = null; this.ws.onerror = null; this.ws.onmessage = null; this.ws.close(); this.ws = null; }
    this.stream?.getTracks().forEach(track => track.stop());
    this.mic?.disconnect();
    if (this.worklet) { this.worklet.port.onmessage = null; this.worklet.disconnect(); }
    this.clearPlayback();
    this.capture?.close().catch(() => {});
    this.playback?.close().catch(() => {});
    this.capture = this.playback = this.stream = this.mic = this.worklet = null;
    this.replyActive = false;
    this.pendingMessages = [];
    this.agentText.clear();
    this.state(false, message);
  }
}
