/**
 * Browser voice transport and audio lifecycle, independent of page markup.
 *
 * AssemblyAI manages the conversation; this class captures PCM, plays replies
 * and bridges explicit tool events to the application's validated HTTP API.
 * Only a temporary token reaches this module, never the permanent provider key.
 * All visible UI work is delegated to callbacks supplied by frontend/app.js.
 */
export class VoiceBoxOffice {
  /**
   * post/runTool are async application adapters. transcript/state/input/devices
   * report changes to the UI; optional diagnostics callbacks also let unit tests
   * exercise protocol behaviour without a DOM or physical microphone.
   */
  constructor({ post, runTool, transcript, state, input = () => {}, devices = () => {} }) {
    Object.assign(this, { post, runTool, transcript, state, input, devices });
    this.active = false;
    // A generation identifies a capture/conversation attempt. Incrementing it
    // invalidates old setup completions and late tool delivery to a closed session.
    this.generation = 0;
    // Keep scheduled audio nodes so an interruption can stop queued speech too.
    this.sources = new Set();
    // Typed input/application context wait until the active reply has finished.
    this.pendingMessages = [];
    // Accumulate agent transcript fragments by item ID until the final snapshot.
    this.agentText = new Map();
  }

  /**
   * Start either a six-second local mic test or one provider conversation.
   * Capture is shared by both modes, but testOnly returns before token/socket
   * creation. Check the generation after awaits: permission prompts and network
   * requests may finish after the user has already ended this attempt.
   */
  async start(deviceId = '', testOnly = false) {
    // Block duplicate clicks while permission, device setup or a test is pending.
    if (this.active || this.starting || this.testing) return;
    this.starting = true;
    this.testing = testOnly;
    this.lastFrameAt = this.lastSoundAt = 0;
    this.peakLevel = 0;
    this.lastMeterAt = 0;
    this.state(false, testOnly ? 'Say a few words to test your mic…' : 'Connecting…');
    // Capture this attempt's identity rather than reading only the active flag:
    // a later conversation may already be active when an old await completes.
    const generation = ++this.generation;
    const current = () => generation === this.generation;
    this.connectTimer = setTimeout(() => this.stop('Connection timed out. Please try again.'), 30000);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.AudioContext) throw new Error('Use a current browser on localhost to enable your microphone.');
      // Create/resume contexts within the click gesture for browser autoplay
      // rules. Capture runs at its actual device/context rate; the worklet will
      // resample it to 24 kHz. Playback uses a separate scheduling clock/graph.
      this.capture = new AudioContext();
      this.playback = new AudioContext();
      await Promise.all([this.capture.resume(), this.playback.resume()]);
      if (!current()) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: this.constraints(deviceId) });
      if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      this.track = stream.getAudioTracks()[0];
      this.bindTrack();
      // Permission can change the hardware route, especially with Bluetooth.
      // Resume again after getUserMedia rather than assuming the earlier resume
      // survived that change. Late-acquired streams above are stopped immediately.
      await Promise.all([this.capture.resume(), this.playback.resume()]);
      if (!current()) return;
      await this.listInputs();
      if (!current()) return;
      await this.capture.audioWorklet.addModule(new URL('./pcm-worklet.js', import.meta.url));
      if (!current()) return;
      // Connect capture to the separately loaded audio-thread processor. Each
      // port message is one transferred 20 ms PCM frame, not a transcript.
      this.mic = this.capture.createMediaStreamSource(stream);
      this.worklet = new AudioWorkletNode(this.capture, 'gogocho-pcm', { processorOptions: { inputSampleRate: this.capture.sampleRate } });
      this.worklet.port.onmessage = ({ data }) => {
        if (!current()) return;
        // Measure input during setup/testing too, but transmit only after the
        // provider has marked this session ready. Test mic never becomes active.
        this.inspectInput(data);
        if (this.active && current()) {
          // Bound queued socket bytes rather than allowing ever-growing latency.
          // The queue includes JSON/base64 overhead, not just raw audio samples.
          if (this.ws.bufferedAmount > 192000) { this.stop('The connection is too slow for live audio. Please try again.'); return; }
          this.send({ type: 'input.audio', audio: btoa(String.fromCharCode(...new Uint8Array(data))) });
        }
      };
      // Connecting to the destination keeps the processing graph running. The
      // worklet never writes to its audio output, so this does not monitor the
      // microphone through the speakers; only PCM messages leave the worklet.
      this.mic.connect(this.worklet).connect(this.capture.destination);
      this.captureStartedAt = Date.now();
      this.micTimer = setInterval(() => this.checkInput(), 1000);
      // Local diagnostics use peak input over the whole test, not merely the
      // final frame. Return here so no provider token is requested or consumed.
      if (testOnly) {
        clearTimeout(this.connectTimer);
        this.starting = false;
        this.testTimer = setTimeout(() => {
          const detected = this.peakLevel >= 0.002;
          this.stop(detected ? 'Microphone detected. Ready to talk.' : 'No sound detected. Check your input.');
        }, 6000);
        return;
      }
      // The server exchanges its private key for this short-lived token. Do not
      // log the socket URL: it contains the temporary credential in its query.
      // Send the non-secret session configuration only once the socket is open.
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

  /**
   * Request mono capture with echo cancellation. Avoid browser noise suppression
   * here so quiet input is not additionally gated. An explicit device uses an
   * exact constraint; an empty ID intentionally leaves selection to the system.
   */
  constraints(deviceId) {
    return { echoCancellation: true, noiseSuppression: false, channelCount: 1, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) };
  }

  /**
   * Best-effort device discovery, not microphone capture. Labels may be absent
   * before permission; report usable fallbacks and the current track's actual ID.
   * Failure to enumerate should not terminate otherwise working capture.
   */
  async listInputs() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
      this.devices(inputs.map(d => ({ id: d.deviceId, label: d.label || 'Microphone' })), this.track?.getSettings().deviceId);
    } catch { /* Device discovery must not prevent a permitted mic from working. */ }
  }

  /** A disconnected track ends capture; a muted track gets a distinct warning. */
  bindTrack() {
    this.track.onended = () => this.stop('Microphone disconnected. Choose an input and restart.');
    this.track.onmute = () => this.input(0, 'Microphone muted. Check your input.', true);
  }

  /**
   * Switch only the capture source within an active conversation. Reuse its
   * worklet and provider socket, avoiding another token/session charge. A stream
   * obtained after stop() belongs to an obsolete generation and must be released.
   */
  async changeInput(deviceId) {
    if (!this.active) return;
    const generation = this.generation;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: this.constraints(deviceId) });
      if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      // Prepare the replacement before retiring the previous track. Remove its
      // handlers first so our intentional stop is not reported as disconnection.
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
      // Release an unused replacement without stopping whichever stream is now
      // installed. A failure before handover can leave the original input usable.
      if (stream && stream !== this.stream) stream.getTracks().forEach(t => t.stop());
      this.input(0, 'Could not switch microphone. Check the selected input.', true);
      await this.listInputs();
    }
  }

  /**
   * Measure normalised RMS energy from little-endian signed PCM16. This detects
   * input level, not speech or transcription quality. Track frame arrival and
   * above-threshold sound independently so a stalled worklet is not called silent.
   */
  inspectInput(buffer) {
    const samples = new DataView(buffer);
    let energy = 0;
    for (let i = 0; i < samples.byteLength; i += 2) energy += (samples.getInt16(i, true) / 32768) ** 2;
    const rms = Math.sqrt(energy / Math.max(1, samples.byteLength / 2));
    const now = Date.now();
    this.lastFrameAt = now;
    this.peakLevel = Math.max(this.peakLevel || 0, rms);
    if (rms >= 0.002) this.lastSoundAt = now;
    // Audio arrives roughly 50 times/second; cap UI updates near 10/second.
    // The display gain below affects only the meter, not the transmitted samples.
    if (!this.lastMeterAt || now - this.lastMeterAt >= 100) {
      this.lastMeterAt = now;
      const heard = now - (this.lastSoundAt || 0) < 1500;
      const warning = this.inputWarning(now);
      this.input(Math.min(1, rms * 12), warning || (heard ? 'Input detected' : 'Speak to check your mic'), Boolean(warning));
    }
  }

  /** Timer-based checks still run if a stalled capture stops delivering frames. */
  checkInput() {
    const warning = this.inputWarning(Date.now());
    if (warning) this.input(0, warning, true);
  }

  /**
   * Prefer hardware mute, then no frames for >4 s, then no sound for >8 s.
   * Capture start/switch supplies the grace-period baseline before the first
   * sample. Empty string means no warning, not proof of intelligible speech.
   */
  inputWarning(now) {
    if (this.track?.muted) return 'Microphone muted. Check your input.';
    if (now - (this.lastFrameAt || this.captureStartedAt) > 4000) return 'Microphone paused. Restart or choose another input.';
    if (now - (this.lastSoundAt || this.captureStartedAt) > 8000) return 'No sound detected. Check your input.';
    return '';
  }

  /**
   * Send protocol JSON only on an open socket. Do not require active here:
   * stop() clears active before sending its final session.end message.
   */
  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  /**
   * Route provider events without coupling the protocol to page elements.
   * Audio, transcripts and tool requests arrive separately; displaying a
   * transcript does not itself invoke a tool or run application code.
   */
  event(message, generation) {
    // Only readiness enables outgoing microphone frames. The browser timer is
    // an additional guardrail alongside the provider-side session-duration cap.
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
      // Provider interruption does not automatically cancel AudioBufferSources
      // already scheduled in our browser; clear those before sending queued text.
      this.replyActive = false;
      if (message.status === 'interrupted') this.clearPlayback();
      this.flushMessages();
    } else if (message.type === 'transcript.user' || message.type === 'transcript.user.delta') {
      this.transcript('user', message.text, `user-${message.item_id}`);
    } else if (message.type === 'transcript.agent.delta') {
      // Agent deltas append to a stable row. A final transcript replaces that
      // row with the authoritative complete text and releases the partial cache.
      const id = `agent-${message.item_id || message.reply_id}`;
      const text = (this.agentText.get(id) || '') + message.delta;
      this.agentText.set(id, text);
      this.transcript('agent', text, id);
    } else if (message.type === 'transcript.agent') {
      const id = `agent-${message.item_id || message.reply_id}`;
      this.agentText.delete(id);
      this.transcript('agent', message.text, id);
    } else if (message.type === 'tool.call') {
      // Both configured tools use hold mode; results resume the reply themselves.
      // tool() awaits HTTP internally without blocking other socket events.
      this.tool(message, generation);
    } else if (message.type === 'session.error' || message.type === 'error') {
      this.stop('AssemblyAI could not continue the conversation. Check API access and credits, then reconnect.');
    } else if (message.type === 'session.ended') {
      this.stop('Conversation ended. Thanks for dropping by.');
    }
  }

  /**
   * Validate the browser-side tool allowlist, then delegate execution to runTool.
   * The backend validates again. Match the response with call_id, encode the
   * returned object as the protocol's JSON string, and mark errors explicitly.
   * A result arriving after this session ends is not sent to a later session;
   * this guard does not roll back an HTTP operation that has already executed.
   */
  async tool(message, generation) {
    let result, is_error = false;
    try {
      if (!['search_screenings', 'prepare_booking'].includes(message.name)) throw new Error('Unknown cinema tool.');
      result = await this.runTool(message.name, message.arguments);
    } catch (error) { result = { error: error.message }; is_error = true; }
    if (this.active && generation === this.generation) this.send({ type: 'tool.result', call_id: message.call_id, result: JSON.stringify(result), is_error });
  }

  /**
   * Decode a base64 reply chunk as little-endian, mono 24 kHz PCM16. Ignore empty
   * or incomplete sample pairs, then create a float buffer; the browser resamples
   * that 24 kHz buffer to the playback device's rate when necessary.
   */
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
    // Append chunks to the end of queued speech instead of overlapping them.
    // A short lead-in avoids scheduling in the past after a network gap; it is
    // not a guarantee about the conversation's total end-to-end latency.
    this.playAt = Math.max(this.playAt || 0, this.playback.currentTime + 0.015);
    source.start(this.playAt);
    this.playAt += buffer.duration;
  }

  /** Show typed input immediately but queue its provider message if replying. */
  text(content) {
    if (!this.active) return;
    this.transcript('user', content, `typed-${crypto.randomUUID()}`);
    this.pendingMessages.push({ role: 'user', content });
    this.flushMessages();
  }

  /**
   * Queue application-supplied context, such as a successful explicit demo
   * confirmation. Unlike typed input, it is not rendered as a visitor utterance.
   */
  context(content) {
    if (!this.active) return;
    this.pendingMessages.push({ role: 'system', content });
    this.flushMessages();
  }

  /**
   * Deliver queued user/system messages as one batch and request one new reply.
   * This path is for injected conversation messages, not hold-mode tool results:
   * those resume the existing reply automatically and must not call reply.create.
   */
  flushMessages() {
    if (!this.active || this.replyActive || !this.pendingMessages.length) return;
    for (const message of this.pendingMessages.splice(0)) this.send({ type: 'conversation.message', ...message });
    this.replyActive = true;
    this.send({ type: 'reply.create' });
  }

  /** Stop both playing and scheduled speech; reset the append-only audio clock. */
  clearPlayback() {
    for (const source of this.sources) { try { source.stop(); source.disconnect(); } catch { /* Already ended. */ } }
    this.sources.clear();
    this.playAt = 0;
  }

  /**
   * Shared cleanup for an explicit end, timeout, mic test, error or navigation.
   * Invalidate pending setup first, then signal the provider while its socket is
   * still open. Detach callbacks before closing/stopping resources to avoid
   * reporting our own teardown as a new disconnection. AudioContext.close is
   * asynchronous; resources may already be closing, so its rejections are ignored.
   */
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
