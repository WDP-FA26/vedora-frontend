const CAPTURE_SAMPLE_RATE = 24_000
const CAPTURE_WORKLET_URL = "/realtime-capture-worklet.js?v=2"
const CAPTURE_WORKLET_NAME = "vedora-realtime-capture"
/** The worklet posts 20 ms of input at a time, so speech and barge-in reach the server sooner. */
const CAPTURE_WORKLET_CHUNK_SECONDS = 0.02
/** Cap in-flight audio frames at ~800 ms; drop overflow chunks rather than failing the call on spikes. */
const CAPTURE_MAX_PENDING_CHUNKS = Math.max(8, Math.ceil(0.8 / CAPTURE_WORKLET_CHUNK_SECONDS))
const CAPTURE_FALLBACK_CHUNK_SAMPLES = 1024

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
  onError?: (error: Error) => void
}

/**
 * App-owned microphone capture for `experimental_useRealtime` (`capture: false`).
 * Runs `public/realtime-capture-worklet.js` on the audio thread (with `ScriptProcessorNode`
 * fallback), reports input RMS level directly without globals, and drops overflow frames
 * under backpressure.
 */
export class VoiceAudioCapture {
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: AudioWorkletNode | ScriptProcessorNode | null = null
  private sink: GainNode | null = null
  private generation = 0
  private pendingChunks = 0

  start(stream: MediaStream, callbacks: VoiceCaptureCallbacks) {
    this.stop()
    const generation = this.generation
    const ctx = new AudioContext({ sampleRate: CAPTURE_SAMPLE_RATE })
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
      const processor = ctx.createScriptProcessor(CAPTURE_FALLBACK_CHUNK_SAMPLES, 1, 1)
      this.processor = processor
      processor.onaudioprocess = (event) => {
        if (this.generation !== generation || this.context !== ctx) return
        const inputData = new Float32Array(event.inputBuffer.getChannelData(0))
        callbacks.onLevel(computeRmsLevel(inputData))
        const pcm16 = resampleToPcm16(inputData, ctx.sampleRate, CAPTURE_SAMPLE_RATE)
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
            this.sink?.disconnect()
            this.sink = null
            attachScriptProcessor()
          }

          node.port.onmessage = (event: MessageEvent<unknown>) => {
            if (this.generation !== generation || this.context !== ctx) return
            const packet = event.data
            if (!(packet instanceof Int16Array) || packet.length < 2) return
            const sampleCount = packet.length - 1
            callbacks.onLevel(packet[sampleCount] / 32767)
            const encoded = encodePcm16(packet.subarray(0, sampleCount))
            node.port.postMessage(packet, [packet.buffer])
            sendEncoded(encoded)
          }

          source.connect(node)
          node.connect(sink)
          sink.connect(ctx.destination)
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
