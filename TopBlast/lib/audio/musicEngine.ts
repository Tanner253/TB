'use client'

/**
 * Generative bullish groove — synthesized live with WebAudio, no audio files.
 *
 * An upbeat 118 BPM house-style loop over C — G — Am — F:
 *  - four-on-the-floor kick with a punchy pitch drop
 *  - claps on 2 & 4, driving offbeat hats
 *  - pumping offbeat saw bass through a lowpass
 *  - bright chord stabs and a melodic 16th-note lead
 * Everything routes through a master gain so it sits behind the UI. Scheduling
 * uses the standard look-ahead pattern so the loop is sample-accurate and
 * survives tab throttling.
 */

const BPM = 118
const BEAT = 60 / BPM
const BAR = BEAT * 4
const LOOKAHEAD_MS = 120
const SCHEDULE_AHEAD = 0.4

/** C major progression: C — G — Am — F (freqs in Hz, midi-ish voicings) */
const CHORDS: number[][] = [
  [261.63, 329.63, 392.0, 523.25], // C
  [246.94, 293.66, 392.0, 493.88], // G
  [220.0, 261.63, 329.63, 440.0], // Am
  [174.61, 261.63, 349.23, 440.0], // F
]
const BASS: number[] = [65.41, 49.0, 55.0, 43.65] // C2 G1 A1 F1
/** Melodic 16th-note lead patterns per chord (scale degrees over two octaves). */
const LEADS: number[][] = [
  [523.25, 659.25, 783.99, 659.25, 1046.5, 783.99, 659.25, 523.25],
  [493.88, 587.33, 783.99, 987.77, 783.99, 587.33, 987.77, 783.99],
  [440.0, 523.25, 659.25, 880.0, 659.25, 523.25, 880.0, 659.25],
  [523.25, 698.46, 880.0, 1046.5, 880.0, 698.46, 1046.5, 1396.9],
]

export const MUSIC_STATE_EVENT = 'tb-musicstate'
const WANTED_KEY = 'tb-music'
const VOLUME_KEY = 'tb-music-vol'
/** Full-volume master level — user volume (0..1) scales this. */
const BASE_GAIN = 0.34

class MusicEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private nextBarTime = 0
  private barIndex = 0
  private volume = 0.7
  private volumeLoaded = false
  playing = false

  /** Music is on by default; 'off' in storage means the user muted it. */
  isWanted(): boolean {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(WANTED_KEY) !== 'off'
    } catch {
      return true
    }
  }

  setWanted(on: boolean) {
    try {
      localStorage.setItem(WANTED_KEY, on ? 'on' : 'off')
    } catch {
      /* non-persistent */
    }
    if (on) this.start()
    else this.stop()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MUSIC_STATE_EVENT, { detail: { playing: this.playing } }))
    }
  }

  getVolume(): number {
    if (!this.volumeLoaded && typeof window !== 'undefined') {
      this.volumeLoaded = true
      try {
        const stored = parseFloat(localStorage.getItem(VOLUME_KEY) ?? '')
        if (!Number.isNaN(stored)) this.volume = Math.min(1, Math.max(0, stored))
      } catch {
        /* keep default */
      }
    }
    return this.volume
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v))
    this.volumeLoaded = true
    try {
      localStorage.setItem(VOLUME_KEY, String(this.volume))
    } catch {
      /* non-persistent */
    }
    if (this.ctx && this.master && this.playing) {
      const t = this.ctx.currentTime
      const target = Math.max(0.0001, BASE_GAIN * this.volume)
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setTargetAtTime(target, t, 0.1)
    }
  }

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null
    try {
      type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext }
      const Ctor = window.AudioContext || (window as AudioWindow).webkitAudioContext
      if (!Ctor) return null
      if (!this.ctx) {
        this.ctx = new Ctor()
        const master = this.ctx.createGain()
        master.gain.value = 0
        const warmth = this.ctx.createBiquadFilter()
        warmth.type = 'lowpass'
        warmth.frequency.value = 9500
        warmth.Q.value = 0.4
        master.connect(warmth).connect(this.ctx.destination)
        this.master = master
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch {
      return null
    }
  }

  start() {
    const ctx = this.ensureCtx()
    if (!ctx || !this.master || this.playing) return
    this.playing = true
    this.barIndex = 0
    this.nextBarTime = ctx.currentTime + 0.1
    // fade in
    this.master.gain.cancelScheduledValues(ctx.currentTime)
    this.master.gain.setValueAtTime(0.0001, ctx.currentTime)
    this.master.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, BASE_GAIN * this.getVolume()),
      ctx.currentTime + 2.5
    )
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS)
    this.schedule()
  }

  stop() {
    if (!this.playing) return
    this.playing = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.ctx && this.master) {
      const t = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setValueAtTime(this.master.gain.value, t)
      this.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
    }
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx || !this.playing) return
    while (this.nextBarTime < ctx.currentTime + SCHEDULE_AHEAD + BAR) {
      this.scheduleBar(this.nextBarTime, this.barIndex % 4)
      this.nextBarTime += BAR
      this.barIndex += 1
    }
  }

  private noiseBurst(
    ctx: AudioContext,
    dest: AudioNode,
    ts: number,
    { len, filterType, freq, gain, q = 1 }: { len: number; filterType: BiquadFilterType; freq: number; gain: number; q?: number }
  ) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let s = 0; s < data.length; s++) {
      data[s] = (Math.random() * 2 - 1) * (1 - s / data.length) ** 2
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = filterType
    filter.frequency.value = freq
    filter.Q.value = q
    const g = ctx.createGain()
    g.gain.value = gain
    noise.connect(filter).connect(g).connect(dest)
    noise.start(ts)
  }

  private scheduleBar(t0: number, chordIdx: number) {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const chord = CHORDS[chordIdx]
    const lead = LEADS[chordIdx]
    const bar = this.barIndex

    // — kick: four on the floor, punchy pitch drop
    for (let i = 0; i < 4; i++) {
      const ts = t0 + i * BEAT
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(165, ts)
      osc.frequency.exponentialRampToValueAtTime(46, ts + 0.09)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.28, ts)
      g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.22)
      osc.connect(g).connect(master)
      osc.start(ts)
      osc.stop(ts + 0.25)
    }

    // — clap on 2 & 4
    for (const beat of [1, 3]) {
      this.noiseBurst(ctx, master, t0 + beat * BEAT, {
        len: 0.14,
        filterType: 'bandpass',
        freq: 1350,
        gain: 0.11,
        q: 1.1,
      })
    }

    // — driving hats: 8ths, offbeats open & louder
    for (let i = 0; i < 8; i++) {
      const off = i % 2 === 1
      this.noiseBurst(ctx, master, t0 + i * (BEAT / 2), {
        len: off ? 0.1 : 0.045,
        filterType: 'highpass',
        freq: 8200,
        gain: off ? 0.055 : 0.03,
      })
    }

    // — pumping offbeat saw bass (house style), root with octave pop on beat 4
    for (let i = 0; i < 4; i++) {
      const ts = t0 + (i + 0.5) * BEAT
      const root = BASS[chordIdx]
      const freq = i === 3 && bar % 2 === 1 ? root * 2 : root
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      const sub = ctx.createOscillator()
      sub.type = 'sine'
      sub.frequency.value = freq
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 620
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, ts)
      g.gain.exponentialRampToValueAtTime(0.17, ts + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ts + BEAT * 0.55)
      osc.connect(lp)
      sub.connect(lp)
      lp.connect(g).connect(master)
      osc.start(ts)
      sub.start(ts)
      osc.stop(ts + BEAT * 0.6)
      sub.stop(ts + BEAT * 0.6)
    }

    // — bright chord stabs on the offbeats (skip one for groove)
    for (const beat of [0.5, 1.5, 2.5]) {
      const ts = t0 + beat * BEAT
      for (const freq of chord) {
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.value = freq
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(2600, ts)
        lp.frequency.exponentialRampToValueAtTime(900, ts + 0.16)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, ts)
        g.gain.exponentialRampToValueAtTime(0.028, ts + 0.012)
        g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.2)
        osc.connect(lp).connect(g).connect(master)
        osc.start(ts)
        osc.stop(ts + 0.24)
      }
    }

    // — melodic lead: 16ths in the back half of every other bar, 8ths otherwise
    const leadEveryBar = bar % 4 >= 2 // builds energy across the 4-bar phrase
    const steps = leadEveryBar ? 16 : 8
    for (let i = 0; i < steps; i++) {
      if (!leadEveryBar && i % 2 === 1) continue
      const ts = t0 + i * (BAR / steps)
      const note = lead[(i + bar) % lead.length]
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = note
      const det = ctx.createOscillator()
      det.type = 'triangle'
      det.frequency.value = note * 1.004
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 3400
      const g = ctx.createGain()
      const vel = i % 4 === 0 ? 0.045 : 0.03
      g.gain.setValueAtTime(0.0001, ts)
      g.gain.exponentialRampToValueAtTime(vel, ts + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.16)
      osc.connect(lp)
      det.connect(lp)
      lp.connect(g).connect(master)
      osc.start(ts)
      det.start(ts)
      osc.stop(ts + 0.2)
      det.stop(ts + 0.2)
    }

    // — riser sparkle at the end of each 4-bar phrase
    if (bar % 4 === 3) {
      const ts = t0 + 3 * BEAT
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ts)
      osc.frequency.exponentialRampToValueAtTime(1760, ts + BEAT)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, ts)
      g.gain.exponentialRampToValueAtTime(0.03, ts + 0.05)
      g.gain.exponentialRampToValueAtTime(0.0001, ts + BEAT)
      osc.connect(g).connect(master)
      osc.start(ts)
      osc.stop(ts + BEAT + 0.05)
    }
  }
}

export const musicEngine = new MusicEngine()
