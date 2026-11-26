import type { DeepFilterNetAudioWorkletHandle } from "@workadventure/noise-suppression/deepfilternet"

import { attachDeepFilterNode, DEEPFILTER_SAMPLE_RATE } from "@/features/meal-plan/voice-deepfilter"

const CAPTURE_SAMPLE_RATE = 24_000
const CAPTURE_WORKLET_URL = "/realtime-capture-worklet.js?v=2"
const CAPTURE_WORKLET_NAME = "vedora-realtime-capture"
/** The worklet posts 20 ms of input at a time, so speech and barge-in reach the server sooner. */
const CAPTURE_WORKLET_CHUNK_SECONDS = 0.02
/** Cap in-flight audio frames at ~800 ms; drop overflow chunks rather than failing the call on spikes. */
const CAPTURE_MAX_PENDING_CHUNKS = Math.max(8, Math.ceil(0.8 / CAPTURE_WORKLET_CHUNK_SECONDS))
const CAPTURE_FALLBACK_CHUNK_SAMPLES = 1024

export const MIC_THRESHOLD_MIN_DB = -70
export const MIC_THRESHOLD_MAX_DB = -10
/** Default manual threshold at 40% of the [-70, -10] dB sensitivity range. */
export const DEFAULT_MIC_THRESHOLD_DB = -46
const NOISE_FLOOR_INITIAL_DB = -58
const NOISE_FLOOR_MIN_DB = -75
const NOISE_FLOOR_MAX_DB = -25
const AUTO_MIN_THRESHOLD_DB = -52
const AUTO_MAX_THRESHOLD_DB = -24
const AUTO_HEADROOM_DB = 10
const GATE_HYSTERESIS_DB = 6
export const GATE_HOLD_MS = 260
const MIN_DB = -100
const MIC_SETTINGS_STORAGE_KEY = "vedora:voice-mic-settings"

export type VoiceMicSettings = {
  autoSensitivity: boolean
  thresholdDb: number
  aiDenoise: boolean
}

export type VoiceAiDenoiseStatus = "off" | "loading" | "active" | "overloaded" | "error"

export type VoiceMicMeterSnapshot = {
  levelDb: number
  thresholdDb: number
  open: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function defaultVoiceMicSettings(): VoiceMicSettings {
  return {
    autoSensitivity: true,
    thresholdDb: DEFAULT_MIC_THRESHOLD_DB,
    aiDenoise: false,
  }
}

export function loadVoiceMicSettings(): VoiceMicSettings {
  const defaults = defaultVoiceMicSettings()
  if (typeof window === "undefined") return defaults
  try {
    const raw = window.localStorage.getItem(MIC_SETTINGS_STORAGE_KEY)
    if (!raw) return defaults
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return defaults
    const record = parsed as Record<string, unknown>
    const autoSensitivity =
      typeof record.autoSensitivity === "boolean" ? record.autoSensitivity : defaults.autoSensitivity
    const thresholdDb =
      typeof record.thresholdDb === "number" && Number.isFinite(record.thresholdDb)
        ? clamp(Math.round(record.thresholdDb), MIC_THRESHOLD_MIN_DB, MIC_THRESHOLD_MAX_DB)
        : defaults.thresholdDb
    const aiDenoise = typeof record.aiDenoise === "boolean" ? record.aiDenoise : defaults.aiDenoise
    return { autoSensitivity, thresholdDb, aiDenoise }
  } catch {
    return defaults
  }
}

export function saveVoiceMicSettings(settings: VoiceMicSettings): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(MIC_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage quota / privacy-mode errors.
  }
}

export function pcm16RmsDb(samples: Int16Array): number {
  if (samples.length === 0) return MIN_DB
  let sum = 0
  for (let i = 0; i < samples.length; i += 1) {
    const normalized = samples[i] / 32768
    sum += normalized * normalized
  }
  const rms = Math.sqrt(sum / samples.length)
  if (rms <= 1e-5) return MIN_DB
  return Math.max(MIN_DB, 20 * Math.log10(rms))
}

/**
 * Discord-style input sensitivity noise gate with automatic ambient noise floor tracking,
 * hysteresis, and hangover hold so soft word endings are preserved while steady room/fan
 * noise is replaced with clean digital silence before reaching GPT-Live.
 */
export class VoiceNoiseGate {
  private auto: boolean
  private manualThresholdDb: number
  private noiseFloorDb = NOISE_FLOOR_INITIAL_DB
  private open = false
  private holdUntil = 0
  private lastLevelDb = MIN_DB

  constructor(settings: Pick<VoiceMicSettings, "autoSensitivity" | "thresholdDb"> = defaultVoiceMicSettings()) {
    this.auto = settings.autoSensitivity
    this.manualThresholdDb = clamp(settings.thresholdDb, MIC_THRESHOLD_MIN_DB, MIC_THRESHOLD_MAX_DB)
  }

  configure(settings: Pick<VoiceMicSettings, "autoSensitivity" | "thresholdDb">): void {
    this.auto = settings.autoSensitivity
    this.manualThresholdDb = clamp(settings.thresholdDb, MIC_THRESHOLD_MIN_DB, MIC_THRESHOLD_MAX_DB)
  }

  reset(): void {
    this.noiseFloorDb = NOISE_FLOOR_INITIAL_DB
    this.open = false
    this.holdUntil = 0
    this.lastLevelDb = MIN_DB
  }

  effectiveThresholdDb(): number {
    if (!this.auto) return this.manualThresholdDb
    return clamp(this.noiseFloorDb + AUTO_HEADROOM_DB, AUTO_MIN_THRESHOLD_DB, AUTO_MAX_THRESHOLD_DB)
  }

  processDb(levelDb: number, now = Date.now()): boolean {
    const clampedDb = clamp(levelDb, MIN_DB, 0)
    this.lastLevelDb = clampedDb

    // Track ambient noise floor asymmetrically: fall quickly in silence, rise slowly on steady room noise
    // (capped below typical speech levels so loud speech bursts never drag the floor up).
    if (clampedDb < this.noiseFloorDb) {
      this.noiseFloorDb += (clampedDb - this.noiseFloorDb) * 0.08
    } else if (clampedDb <= NOISE_FLOOR_MAX_DB) {
      this.noiseFloorDb += (clampedDb - this.noiseFloorDb) * 0.015
    }
    this.noiseFloorDb = clamp(this.noiseFloorDb, NOISE_FLOOR_MIN_DB, NOISE_FLOOR_MAX_DB)

    const openDb = this.effectiveThresholdDb()
    const closeDb = openDb - GATE_HYSTERESIS_DB

    if (clampedDb >= openDb) {
      this.open = true
      this.holdUntil = now + GATE_HOLD_MS
      return true
    }

    if (this.open) {
      if (clampedDb >= closeDb) {
        this.holdUntil = now + GATE_HOLD_MS
        return true
      }
      if (now < this.holdUntil) {
        return true
      }
      this.open = false
    }

    return false
  }

  processSamples(samples: Int16Array, now = Date.now()): boolean {
    return this.processDb(pcm16RmsDb(samples), now)
  }

  snapshot(): VoiceMicMeterSnapshot {
    return {
      levelDb: this.lastLevelDb,
      thresholdDb: this.effectiveThresholdDb(),
      open: this.open,
    }
  }
}

function resampleToPcm16(samples: Float32Array, fromRate: number, toRate: number): Int16Array {
  const outLength = fromRate === toRate ? samples.length : Math.max(1, Math.round((samples.length * toRate) / fromRate))
  const pcm16 = new Int16Array(outLength)
  const ratio = samples.length / outLength
  for (let i = 0; i < outLength; i += 1) {
    const pos = i * ratio
    const idx = Math.floor(pos)
    const frac = pos - idx
    const s0 = samples[idx] ?? 0
    const s1 = samples[Math.min(idx + 1, samples.length - 1)] ?? s0
    const clamped = Math.max(-1, Math.min(1, s0 + (s1 - s0) * frac))
    pcm16[i] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767)
  }
  return pcm16
}

function encodePcm16(pcm16: Int16Array): string {
  const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength)
  const withBase64 = bytes as Uint8Array & { toBase64?: () => string }
  if (typeof withBase64.toBase64 === "function") return withBase64.toBase64()
  const chunkSize = 32_768
  let binary = ""
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...slice)
  }
  return btoa(binary)
}

function computeRmsLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i += 1) {
    sum += samples[i] * samples[i]
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 4)
}

export type VoiceCaptureCallbacks = {
  onAudio: (base64Pcm16: string) => Promise<void> | void
  onLevel: (level: number) => void
  isMuted: () => boolean
  aiDenoise?: boolean
  onAiDenoiseStatus?: (status: VoiceAiDenoiseStatus) => void
  onError?: (error: Error) => void
}

/**
 * App-owned microphone capture for `experimental_useRealtime` (`capture: false`).
 * Runs `public/realtime-capture-worklet.js` on the audio thread (with `ScriptProcessorNode`
 * fallback), optionally inserts a 48 kHz DeepFilterNet3 denoiser ahead of capture,
 * reports input RMS level directly without globals, and drops overflow frames
 * under backpressure.
 */
export class VoiceAudioCapture {
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private deepFilter: DeepFilterNetAudioWorkletHandle | null = null
  private processor: AudioWorkletNode | ScriptProcessorNode | null = null
  private sink: GainNode | null = null
  private generation = 0
  private pendingChunks = 0
  private readonly gate = new VoiceNoiseGate()
  private readonly silenceCache = new Map<number, string>()

  configureGate(settings: VoiceMicSettings): void {
    this.gate.configure(settings)
  }

  readMeter(): VoiceMicMeterSnapshot {
    return this.gate.snapshot()
  }

  private silenceChunk(sampleCount: number): string {
    const cached = this.silenceCache.get(sampleCount)
    if (cached !== undefined) return cached
    const encoded = encodePcm16(new Int16Array(sampleCount))
    this.silenceCache.set(sampleCount, encoded)
    return encoded
  }

  start(stream: MediaStream, callbacks: VoiceCaptureCallbacks) {
    this.stop()
    this.gate.reset()
    const generation = this.generation
    const useAiDenoise = Boolean(callbacks.aiDenoise) && typeof AudioWorkletNode !== "undefined"
    const ctx = new AudioContext({
      sampleRate: useAiDenoise ? DEEPFILTER_SAMPLE_RATE : CAPTURE_SAMPLE_RATE,
    })
    this.context = ctx
    ctx.resume().catch((error: unknown) => {
      if (this.generation === generation) {
        callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    })

    const source = ctx.createMediaStreamSource(stream)
    this.source = source

    const sendEncoded = (encoded: string) => {
      if (this.generation !== generation || callbacks.isMuted()) return
      if (this.pendingChunks >= CAPTURE_MAX_PENDING_CHUNKS) return
      this.pendingChunks += 1
      Promise.resolve(callbacks.onAudio(encoded)).finally(() => {
        if (this.generation === generation) {
          this.pendingChunks = Math.max(0, this.pendingChunks - 1)
        }
      })
    }

    const attachScriptProcessor = () => {
      if (this.generation !== generation || this.context !== ctx) return
      callbacks.onAiDenoiseStatus?.(useAiDenoise ? "error" : "off")
      const processor = ctx.createScriptProcessor(CAPTURE_FALLBACK_CHUNK_SAMPLES, 1, 1)
      this.processor = processor
      processor.onaudioprocess = (event) => {
        if (this.generation !== generation || this.context !== ctx) return
        const inputData = new Float32Array(event.inputBuffer.getChannelData(0))
        const pcm16 = resampleToPcm16(inputData, ctx.sampleRate, CAPTURE_SAMPLE_RATE)
        const gateOpen = this.gate.processSamples(pcm16)
        callbacks.onLevel(gateOpen ? computeRmsLevel(inputData) : 0)
        sendEncoded(gateOpen ? encodePcm16(pcm16) : this.silenceChunk(pcm16.length))
      }
      source.connect(processor)
      processor.connect(ctx.destination)
    }

    if (typeof AudioWorkletNode === "undefined" || ctx.audioWorklet == null) {
      attachScriptProcessor()
      return
    }

    void ctx.audioWorklet
      .addModule(CAPTURE_WORKLET_URL)
      .then(() => {
        if (this.generation !== generation || this.context !== ctx) return
        try {
          const node = new AudioWorkletNode(ctx, CAPTURE_WORKLET_NAME, {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            channelCount: 1,
            channelCountMode: "explicit",
            processorOptions: {
              targetSampleRate: CAPTURE_SAMPLE_RATE,
              chunkSeconds: CAPTURE_WORKLET_CHUNK_SECONDS,
            },
          })
          const sink = ctx.createGain()
          sink.gain.value = 0
          this.processor = node
          this.sink = sink

          node.onprocessorerror = () => {
            if (this.generation !== generation || this.processor !== node) return
            node.onprocessorerror = null
            node.port.onmessage = null
            node.port.close()
            node.disconnect()
            this.deepFilter?.dispose()
            this.deepFilter = null
            this.sink?.disconnect()
            this.sink = null
            attachScriptProcessor()
          }

          node.port.onmessage = (event: MessageEvent<unknown>) => {
            if (this.generation !== generation || this.context !== ctx) return
            const packet = event.data
            if (!(packet instanceof Int16Array) || packet.length < 2) return
            const sampleCount = packet.length - 1
            const samples = packet.subarray(0, sampleCount)
            const gateOpen = this.gate.processSamples(samples)
            callbacks.onLevel(gateOpen ? packet[sampleCount] / 32767 : 0)
            const encoded = gateOpen ? encodePcm16(samples) : this.silenceChunk(sampleCount)
            node.port.postMessage(packet, [packet.buffer])
            sendEncoded(encoded)
          }

          source.connect(node)
          node.connect(sink)
          sink.connect(ctx.destination)

          if (!useAiDenoise) {
            callbacks.onAiDenoiseStatus?.("off")
            return
          }
          if (ctx.sampleRate !== DEEPFILTER_SAMPLE_RATE) {
            callbacks.onAiDenoiseStatus?.("error")
            return
          }

          callbacks.onAiDenoiseStatus?.("loading")
          const bypassDeepFilter = (status: VoiceAiDenoiseStatus) => {
            if (this.generation !== generation || this.context !== ctx) return
            if (this.deepFilter) {
              try {
                source.disconnect(this.deepFilter.node)
              } catch {
                // Already disconnected.
              }
              this.deepFilter.dispose()
              this.deepFilter = null
            }
            try {
              source.connect(node)
            } catch {
              // Already connected.
            }
            callbacks.onAiDenoiseStatus?.(status)
          }

          void attachDeepFilterNode(ctx, {
            onOverload: () => bypassDeepFilter("overloaded"),
          })
            .then((handle) => {
              if (this.generation !== generation || this.context !== ctx) {
                handle.dispose()
                return
              }
              this.deepFilter = handle
              try {
                source.disconnect(node)
              } catch {
                // Ignore if already disconnected.
              }
              source.connect(handle.node)
              handle.node.connect(node)
              void handle.ready
                .then(() => {
                  if (this.generation === generation && this.deepFilter === handle) {
                    callbacks.onAiDenoiseStatus?.("active")
                  }
                })
                .catch(() => {
                  bypassDeepFilter("error")
                })
            })
            .catch(() => {
              bypassDeepFilter("error")
            })
        } catch {
          attachScriptProcessor()
        }
      })
      .catch(() => {
        attachScriptProcessor()
      })
  }

  stop() {
    this.generation += 1
    this.pendingChunks = 0
    this.gate.reset()
    if (this.deepFilter) {
      this.deepFilter.dispose()
      this.deepFilter = null
    }
    if (this.processor) {
      if ("onaudioprocess" in this.processor) {
        this.processor.onaudioprocess = null
      }
      if ("onprocessorerror" in this.processor) {
        this.processor.onprocessorerror = null
      }
      if ("port" in this.processor && this.processor.port) {
        this.processor.port.onmessage = null
        this.processor.port.close()
      }
      this.processor.disconnect()
    }
    this.sink?.disconnect()
    this.source?.disconnect()
    void this.context?.close().catch(() => undefined)
    this.processor = null
    this.sink = null
    this.source = null
    this.context = null
  }
}
