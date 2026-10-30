export class AudioFX {
  context?: AudioContext;
  enabled = true;
  lastShot = 0;
  unlock() {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) this.unlock();
    return this.enabled;
  }
  tone(
    frequency: number,
    length: number,
    volume: number,
    type: OscillatorType = "sine",
    end = frequency,
    delay = 0,
  ) {
    const c = this.context;
    if (!c || !this.enabled || c.state !== "running") return;
    const o = c.createOscillator(),
      v = c.createGain(),
      t = c.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(frequency, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + length);
    v.gain.setValueAtTime(0.001, t);
    v.gain.linearRampToValueAtTime(volume, t + 0.008);
    v.gain.exponentialRampToValueAtTime(0.001, t + length);
    o.connect(v);
    v.connect(c.destination);
    o.start(t);
    o.stop(t + length + 0.02);
  }
  play(kind: string) {
    if (kind === "shoot") {
      const now = this.context?.currentTime || 0;
      if (now - this.lastShot < 0.09) return;
      this.lastShot = now;
      this.tone(550, 0.075, 0.028, "triangle", 190);
    }
    if (kind === "hit") this.tone(120, 0.06, 0.025, "square", 60);
    if (kind === "hurt" || kind === "death")
      this.tone(130, 0.26, 0.065, "sawtooth", 35);
    if (kind === "dash") this.tone(200, 0.15, 0.025, "triangle", 600);
    if (kind === "coin") this.tone(1200, 0.12, 0.025, "sine", 1700);
    if (kind === "item" || kind === "clear" || kind === "win") {
      [440, 554, 659, 880].forEach((f, i) =>
        this.tone(f, 0.3, 0.03, "sine", f, i * 0.09),
      );
    }
    if (kind === "heal" || kind === "shield")
      this.tone(650, 0.24, 0.035, "sine", 1000);
    if (kind === "phase") this.tone(100, 0.7, 0.06, "sawtooth", 38);
    if (kind === "room") this.tone(75, 0.35, 0.035, "triangle", 40);
  }
}
