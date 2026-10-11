export class GameAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfx: GainNode | null = null;
  music: GainNode | null = null;
  muted = false;
  private amb: OscillatorNode | null = null;
  private ambGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx.gain.value = 0.7;
      this.music.gain.value = 0.22;
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise();
      this.startAmb();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(v: boolean) {
    this.muted = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? 0 : 1, this.ctx!.currentTime, 0.02);
  }

  private makeNoise() {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private startAmb() {
    if (!this.ctx || !this.music || !this.noise) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.08;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    src.connect(f);
    f.connect(g);
    g.connect(this.music);
    src.start();
    this.ambGain = g;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = 72;
    const og = this.ctx.createGain();
    og.gain.value = 0.012;
    o.connect(og);
    og.connect(this.music);
    o.start();
    this.amb = o;

    const rg = this.ctx.createGain();
    rg.gain.value = 0;
    const rs = this.ctx.createBufferSource();
    rs.buffer = this.noise;
    rs.loop = true;
    const hf = this.ctx.createBiquadFilter();
    hf.type = "highpass";
    hf.frequency.value = 1800;
    rs.connect(hf);
    hf.connect(rg);
    rg.connect(this.music);
    rs.start();
    this.rainGain = rg;
  }

  setRain(on: boolean) {
    if (!this.rainGain || !this.ctx) return;
    this.rainGain.gain.setTargetAtTime(on ? 0.12 : 0, this.ctx.currentTime, 0.4);
  }

  setNight(night: boolean) {
    if (!this.ambGain || !this.ctx) return;
    this.ambGain.gain.setTargetAtTime(night ? 0.14 : 0.08, this.ctx.currentTime, 0.8);
  }

  private beep(freq: number, dur: number, type: OscillatorType, vol = 0.12, slide = 0) {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(vol = 0.18, dur = 0.08, cutoff = 1200) {
    if (!this.ctx || !this.sfx || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + dur);
  }

  chop() {
    this.burst(0.22, 0.09, 900);
    this.beep(140, 0.08, "square", 0.05, -60);
  }
  mine() {
    this.burst(0.2, 0.1, 500);
    this.beep(90, 0.1, "sawtooth", 0.06, -30);
  }
  swing() {
    this.burst(0.1, 0.06, 1800);
  }
  shoot() {
    this.burst(0.32, 0.07, 700);
    this.beep(220, 0.05, "square", 0.08, -160);
  }
  bow() {
    this.beep(420, 0.06, "triangle", 0.08, -200);
  }
  hit() {
    this.beep(180, 0.07, "square", 0.1, -80);
  }
  hurt() {
    this.beep(110, 0.18, "sawtooth", 0.12, -50);
  }
  pickup() {
    this.beep(660, 0.08, "sine", 0.08, 120);
  }
  craft() {
    this.beep(520, 0.1, "triangle", 0.07);
    this.beep(740, 0.12, "sine", 0.05);
  }
  eat() {
    this.burst(0.08, 0.12, 400);
  }
  step() {
    this.burst(0.045, 0.05, 280);
  }
  ui() {
    this.beep(480, 0.04, "sine", 0.05);
  }
  explode() {
    this.burst(0.45, 0.28, 180);
    this.beep(70, 0.3, "sawtooth", 0.14, -40);
  }
  place() {
    this.beep(200, 0.08, "square", 0.07);
    this.burst(0.1, 0.08, 600);
  }
}
