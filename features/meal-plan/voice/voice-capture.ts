import type { DeepFilterNetAudioWorkletHandle } from "@workadventure/noise-suppression/deepfilternet"

import { attachDeepFilterNode, DEEPFILTER_SAMPLE_RATE } from "@/features/meal-plan/voice/voice-deepfilter"

const CAPTURE_SAMPLE_RATE = 24_000
const CAPTURE_WORKLET_URL = "/realtime-capture-worklet.js?v=2"
const CAPTURE_WORKLET_NAME = "vedora-realtime-capture"
const CAPTURE_WORKLET_CHUNK_SECONDS = 0.02
const CAPTURE_MAX_PENDING_CHUNKS = Math.max(8, Math.ceil(0.8 / CAPTURE_WORKLET_CHUNK_SECONDS))
const CAPTURE_FALLBACK_CHUNK_SAMPLES = 1024

const MIN_DB = -100
const MIC_SETTINGS_STORAGE_KEY = "vedora:voice-mic-settings"

export type VoiceMicSettings = {
  aiDenoise: boolean
}

export type VoiceAiDenoiseStatus = "off" | "loading" | "active" | "overloaded" | "error"

export function defaultVoiceMicSettings(): VoiceMicSettings {
  return { aiDenoise: false }
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
    const aiDenoise = typeof record.aiDenoise === "boolean" ? record.aiDenoise : defaults.aiDenoise
    return { aiDenoise }
  } catch {
    return defaults
  }
}

export function saveVoiceMicSettings(settings: VoiceMicSettings): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(MIC_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
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

export class VoiceAudioCapture {
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private deepFilter: DeepFilterNetAudioWorkletHandle | null = null
  private processor: AudioWorkletNode | ScriptProcessorNode | null = null
  private sink: GainNode | null = null
  private generation = 0
  private pendingChunks = 0
  private levelDb = MIN_DB

  readLevelDb(): number {
    return this.levelDb
  }

  start(stream: MediaStream, callbacks: VoiceCaptureCallbacks) {
    this.stop()
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
        this.levelDb = pcm16RmsDb(pcm16)
        callbacks.onLevel(computeRmsLevel(inputData))
        sendEncoded(encodePcm16(pcm16))
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
            this.levelDb = pcm16RmsDb(samples)
            callbacks.onLevel(packet[sampleCount] / 32767)
            const encoded = encodePcm16(samples)
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
              }
              this.deepFilter.dispose()
              this.deepFilter = null
            }
            try {
              source.connect(node)
            } catch {
            }
            callbacks.onAiDenoiseStatus?.(status)
          }

          void attachDeepFilterNode(ctx, {
            usePauseGate: false,
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
    this.levelDb = MIN_DB
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
