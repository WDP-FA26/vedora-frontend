/**
 * Generative soundtrack for the landing story, synthesized with Web Audio so
 * there are no audio files to load. The particle scene calls `update` every
 * frame with the same progress, scroll velocity, and clock it renders with,
 * so the sound stays locked to what's on screen.
 */

// One open voicing per story stage: leaf, heart, globe, cards, sprout.
const CHORDS = [
  [146.83, 220.0, 293.66, 369.99], // D3 A3 D4 F#4
  [130.81, 196.0, 261.63, 329.63], // C3 G3 C4 E4
  [110.0, 164.81, 246.94, 329.63], // A2 E3 B3 E4
  [123.47, 185.0, 246.94, 293.66], // B2 F#3 B3 D4
  [146.83, 220.0, 329.63, 440.0], // D3 A3 E4 A4
]

/** Overall heartbeat loudness. */
const HEART_LEVEL = 1

// Pentatonic bell for each stage the cloud settles into.
const CHIMES = [587.33, 659.25, 739.99, 880.0, 987.77]

export type SoundFrame = {
  /** Story position, 0–4. */
  progress: number
  /** Scroll speed, 0–1. */
  velocity: number
  /** Scene clock in seconds. */
  time: number
  /** 0 when the user prefers reduced motion (the heart doesn't beat). */
  motion: number
}

export class Soundscape {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private send!: GainNode
  private voices: OscillatorNode[] = []
  private sources: AudioScheduledSourceNode[] = []
  private windGain!: GainNode
  private windFilter!: BiquadFilterNode
  private noise!: AudioBuffer
  private heartBus!: GainNode
  private enabled = false
  private stage = -1
  private lastPhase = 0

  async start() {
    if (!this.ctx) this.build()
    const ctx = this.ctx!
    this.enabled = true
    await ctx.resume()
    this.master.gain.cancelScheduledValues(ctx.currentTime)
    this.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.6)
  }

  async stop() {
    const ctx = this.ctx
    if (!ctx) return
    this.enabled = false
    this.master.gain.cancelScheduledValues(ctx.currentTime)
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.2)
    await new Promise((resolve) => setTimeout(resolve, 800))
    if (!this.enabled) await ctx.suspend()
  }

  dispose() {
    document.removeEventListener("visibilitychange", this.onVisibility)
    this.sources.forEach((source) => source.stop())
    void this.ctx?.close()
    this.ctx = null
  }

  update({ progress, velocity, time, motion }: SoundFrame) {
    const ctx = this.ctx
    if (!ctx || !this.enabled) return
    const now = ctx.currentTime

    // Change stage only once progress is clearly past the midpoint, so
    // hovering on a boundary doesn't ring the chime over and over.
    if (this.stage === -1) {
      this.stage = Math.round(progress)
      this.retune(this.stage, 0.01)
    } else if (Math.abs(progress - this.stage) > 0.6) {
      this.stage = Math.round(progress)
      this.retune(this.stage, 0.9)
      this.chime(this.stage)
    }

    this.windGain.gain.setTargetAtTime(velocity * 0.14, now, 0.12)
    this.windFilter.frequency.setTargetAtTime(380 + velocity * 1800, now, 0.12)

    // Same "lub-dub" timing as the heart in the particle shader.
    const phase = (time * 0.85) % 1
    const near = Math.max(0, 1 - Math.abs(progress - 1) * 1.1) * motion
    if (near > 0.05) {
      if (phase < this.lastPhase) this.heartSound(near, "lub")
      else if (this.lastPhase < 0.2 && phase >= 0.2) this.heartSound(near, "dub")
    }
    this.lastPhase = phase
  }

  private onVisibility = () => {
    if (!this.ctx || !this.enabled) return
    if (document.hidden) void this.ctx.suspend()
    else void this.ctx.resume()
  }

  private build() {
    const ctx = new AudioContext()
    this.ctx = ctx

    const compressor = ctx.createDynamicsCompressor()
    compressor.connect(ctx.destination)
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(compressor)

    // A soft feedback echo that gives the chimes some air.
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.32
    const feedback = ctx.createGain()
    feedback.gain.value = 0.38
    const damp = ctx.createBiquadFilter()
    damp.type = "lowpass"
    damp.frequency.value = 2400
    this.send = ctx.createGain()
    this.send.gain.value = 0.5
    this.send.connect(delay)
    delay.connect(damp)
    damp.connect(feedback)
    feedback.connect(delay)
    damp.connect(this.master)

    // Pad: two slightly detuned oscillators per note through a breathing
    // lowpass filter.
    const padFilter = ctx.createBiquadFilter()
    padFilter.type = "lowpass"
    padFilter.frequency.value = 850
    padFilter.Q.value = 0.6
    const padGain = ctx.createGain()
    padGain.gain.value = 0.055
    padFilter.connect(padGain)
    padGain.connect(this.master)

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 320
    lfo.connect(lfoDepth)
    lfoDepth.connect(padFilter.frequency)
    lfo.start()
    this.sources.push(lfo)

    for (const note of CHORDS[0]) {
      for (const [type, detune] of [
        ["triangle", -6],
        ["sine", 7],
      ] as const) {
        const osc = ctx.createOscillator()
        osc.type = type
        osc.frequency.value = note
        osc.detune.value = detune
        const gain = ctx.createGain()
        gain.gain.value = 1 / 8
        osc.connect(gain)
        gain.connect(padFilter)
        osc.start()
        this.voices.push(osc)
        this.sources.push(osc)
      }
    }

    // Wind: looped noise through a band-pass that opens with scroll speed.
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const samples = this.noise.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
    const wind = ctx.createBufferSource()
    wind.buffer = this.noise
    wind.loop = true
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = "bandpass"
    this.windFilter.frequency.value = 380
    this.windFilter.Q.value = 0.8
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0
    wind.connect(this.windFilter)
    this.windFilter.connect(this.windGain)
    this.windGain.connect(this.master)
    wind.start()
    this.sources.push(wind)

    // Heartbeat bus. Saturation adds warm harmonics so the beat carries on
    // laptop and phone speakers, which play little below ~200 Hz; the lowpass
    // keeps it muffled, as if heard through a chest.
    this.heartBus = ctx.createGain()
    const drive = 3
    const curve = new Float32Array(1024)
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1
      curve[i] = Math.tanh(drive * x) / Math.tanh(drive)
    }
    const saturate = ctx.createWaveShaper()
    saturate.curve = curve
    saturate.oversample = "2x"
    const muffle = ctx.createBiquadFilter()
    muffle.type = "lowpass"
    muffle.frequency.value = 850
    muffle.Q.value = 0.6
    const heartOut = ctx.createGain()
    heartOut.gain.value = HEART_LEVEL
    this.heartBus.connect(saturate)
    saturate.connect(muffle)
    muffle.connect(heartOut)
    heartOut.connect(this.master)

    document.addEventListener("visibilitychange", this.onVisibility)
  }

  /** Glide the pad to the stage's chord. */
  private retune(stage: number, glide: number) {
    const ctx = this.ctx!
    const chord = CHORDS[Math.min(Math.max(stage, 0), CHORDS.length - 1)]
    this.voices.forEach((osc, i) => {
      osc.frequency.setTargetAtTime(chord[Math.floor(i / 2)], ctx.currentTime, glide)
    })
  }

  private chime(stage: number) {
    const ctx = this.ctx!
    const now = ctx.currentTime
    const root = CHIMES[Math.min(Math.max(stage, 0), CHIMES.length - 1)]

    // Fundamental plus an inharmonic partial reads as a bell.
    for (const [ratio, level] of [
      [1, 0.07],
      [2.76, 0.02],
    ]) {
      const osc = ctx.createOscillator()
      osc.frequency.value = root * ratio
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(level, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6)
      osc.connect(gain)
      gain.connect(this.master)
      gain.connect(this.send)
      osc.start(now)
      osc.stop(now + 2.7)
    }
  }

  /**
   * One heart sound: a soft-edged thud rather than a drum hit. The body sits
   * around 100 Hz so small speakers can play it, with a sub an octave down
   * for headphones. "Lub" is longer and lower; "dub" shorter and higher.
   */
  private heartSound(strength: number, kind: "lub" | "dub") {
    const ctx = this.ctx!
    const now = ctx.currentTime
    const lub = kind === "lub"
    const pitch = lub ? 95 : 108
    const level = (lub ? 0.8 : 0.62) * strength
    const length = lub ? 0.2 : 0.14

    // A sine that sags only slightly in pitch, with a rounded attack so
    // there's no click.
    const tone = (frequency: number, gainLevel: number, attack: number, tau: number) => {
      const osc = ctx.createOscillator()
      osc.frequency.setValueAtTime(frequency * 1.12, now)
      osc.frequency.exponentialRampToValueAtTime(frequency, now + length * 0.6)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(gainLevel, now + attack)
      gain.gain.setTargetAtTime(0, now + attack + 0.01, tau)
      osc.connect(gain)
      gain.connect(this.heartBus)
      osc.start(now)
      osc.stop(now + length + 0.4)
    }
    tone(pitch, level, 0.015, length / 4) // body
    tone(pitch / 2, level * 0.7, 0.02, length / 3.5) // sub

    // Noise through a low band-pass gives the thud its flesh.
    const thud = ctx.createBufferSource()
    thud.buffer = this.noise
    const thudFilter = ctx.createBiquadFilter()
    thudFilter.type = "bandpass"
    thudFilter.frequency.value = 180
    thudFilter.Q.value = 1.4
    const thudGain = ctx.createGain()
    thudGain.gain.setValueAtTime(0, now)
    thudGain.gain.linearRampToValueAtTime(level * 1.2, now + 0.01)
    thudGain.gain.setTargetAtTime(0, now + 0.015, length / 7)
    thud.connect(thudFilter)
    thudFilter.connect(thudGain)
    thudGain.connect(this.heartBus)
    thud.start(now, Math.random() * 1.5, length + 0.2)
  }
}
