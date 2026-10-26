export class Sound {
  constructor() { this.ctx = null; this.volume = 0.7; this.mode = 'off'; this.chase = 0; this.last = {}; this.lv = {}; this.bedT = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(c.destination);
    const n = c.sampleRate;
    this.noiseBuf = c.createBuffer(1, n, n);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const mk = (type, f) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f; g.gain.value = 0;
      o.connect(g); g.connect(this.master); o.start();
      return { o, g };
    };
    this.bed = { hum: mk('sine', 60), buzz: mk('sawtooth', 120), menuA: mk('triangle', 55), menuB: mk('sine', 82.4), ch1: mk('sawtooth', 58), ch2: mk('square', 87) };
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  level(name, target, dt) {
    const cur = this.lv[name] || 0;
    const next = cur + (target - cur) * Math.min(1, dt * 3);
    this.lv[name] = next;
    this.bed[name].g.gain.value = next;
  }

  tick(dt, t) {
    if (!this.ctx) return;
    const play = this.mode === 'play', menu = this.mode === 'menu';
    this.bedT -= dt;
    if (this.bedT <= 0) { this.bedT = 0.08 + Math.random() * 0.2; this.buzzK = Math.random() < 0.12 ? 3 : 1; }
    this.level('hum', play ? 0.05 : 0, dt);
    this.level('buzz', (play ? 0.008 : menu ? 0.004 : 0) * (this.buzzK || 1), dt);
    this.level('menuA', menu ? 0.07 : 0, dt);
    this.level('menuB', menu ? 0.04 : 0, dt);
    const k = play ? this.chase : 0;
    const pulse = 0.6 + 0.4 * Math.sin(t * (3 + 5 * k));
    this.level('ch1', k * 0.09 * pulse, dt);
    this.level('ch2', k * 0.03 * pulse, dt);
    this.bed.ch1.o.frequency.value = 58 + k * 30;
  }

  listen(p, yaw) {
    if (!this.ctx) return;
    const l = this.ctx.listener, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else { l.setPosition(p.x, p.y, p.z); l.setOrientation(fx, 0, fz, 0, 1, 0); }
  }

  spatial(pos) {
    if (!pos) return this.master;
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
    p.refDistance = 4; p.rolloffFactor = 1.3; p.maxDistance = 120;
    const y = pos.y === undefined ? 1 : Math.max(pos.y, 1);
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, y, pos.z);
    p.connect(this.master);
    return p;
  }

  tone(f, d, type = 'sine', v = 0.2, to = null, dest = null, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + d + 0.05);
  }

  hit(d, f, v, dest, type = 'lowpass') {
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; fl.type = type; fl.frequency.value = f;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl); fl.connect(g); g.connect(dest || this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }

  play(name, pos = null) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.04) return;
    this.last[name] = now;
    const o = this.spatial(pos);
    switch (name) {
      case 'step': this.hit(0.08, 500, 0.2, o); break;
      case 'wetstep': this.hit(0.14, 1200, 0.3, o); break;
      case 'tstep': this.hit(0.14, 220, 0.6, o); break;
      case 'notebook': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.1, null, o, i * 0.07)); break;
      case 'correct': this.tone(660, 0.1, 'square', 0.12); this.tone(880, 0.18, 'square', 0.12, null, null, 0.1); break;
      case 'wrong': this.tone(180, 0.4, 'sawtooth', 0.25, 80); break;
      case 'pickup': this.tone(440, 0.08, 'square', 0.12); this.tone(660, 0.12, 'square', 0.12, null, null, 0.08); break;
      case 'door': this.hit(0.25, 300, 0.4, o); this.tone(90, 0.25, 'square', 0.1, 60, o); break;
      case 'thud': this.hit(0.3, 140, 0.6, o); break;
      case 'creak': this.tone(80, 0.8, 'sawtooth', 0.05, 150, o); break;
      case 'bell': this.tone(1568, 1.2, 'sine', 0.35, null, o); this.tone(2349, 1, 'sine', 0.15, null, o); break;
      case 'whistle': this.tone(2200, 0.5, 'sine', 0.2, 1700, o); break;
      case 'sweep': this.tone(200, 2.2, 'sawtooth', 0.16, 1400, o); break;
      case 'whoosh': this.hit(0.9, 900, 0.5, o); break;
      case 'boost': this.tone(300, 0.4, 'square', 0.12, 900); break;
      case 'jolt': this.hit(0.9, 3000, 0.6, o, 'highpass'); this.tone(70, 0.9, 'sawtooth', 0.5, 30); this.tone(1200, 0.5, 'square', 0.2, 300); break;
      case 'alarm': for (let i = 0; i < 8; i++) this.tone(i % 2 ? 880 : 620, 0.22, 'square', 0.13, null, o, i * 0.25); break;
      case 'win': [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.18, null, o, i * 0.18)); break;
      default: break;
    }
  }
}
