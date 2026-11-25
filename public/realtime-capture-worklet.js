/**
 * Microphone capture for the realtime voice agent, loaded by the patched `ai` package
 * (see patches/ai@7.0.181.patch). Runs on the audio thread: resamples to `targetSampleRate`,
 * encodes Float32 samples to Int16 PCM, packs chunk RMS level into the trailing Int16 slot,
 * and recycles transferred Int16Array packets via a pool for near-zero GC pressure.
 */
const MAX_POOL_SIZE = 8
const INITIAL_POOL_SIZE = 4

class RealtimeCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const opts = options.processorOptions ?? {}
    this.targetSampleRate = opts.targetSampleRate ?? sampleRate
    this.chunkSeconds = opts.chunkSeconds ?? 0.02
    this.outputChunkSamples = Math.max(1, Math.round(this.targetSampleRate * this.chunkSeconds))
    this.packetLength = this.outputChunkSamples + 1
    this.ratio = sampleRate / this.targetSampleRate

    this.pool = []
    for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
      this.pool.push(new Int16Array(this.packetLength))
    }
    this.transferList = [null]

    this.port.onmessage = (event) => {
      if (event.data instanceof Int16Array && event.data.length === this.packetLength) {
        if (this.pool.length < MAX_POOL_SIZE) {
          this.pool.push(event.data)
        }
      }
    }

    this.chunk = this.acquireChunk()
    this.filled = 0
    this.sumSquares = 0
    this.rmsCount = 0
    this.srcPos = 0
    this.prevSample = 0
  }

  acquireChunk() {
    return this.pool.pop() ?? new Int16Array(this.packetLength)
  }

  pushSample(rawSample) {
    const s = rawSample < -1 ? -1 : rawSample > 1 ? 1 : rawSample
    this.sumSquares += s * s
    this.rmsCount += 1
    this.chunk[this.filled++] = s < 0 ? s * 32768 : s * 32767

    if (this.filled === this.outputChunkSamples) {
      const level = this.rmsCount > 0 ? Math.min(1, Math.sqrt(this.sumSquares / this.rmsCount) * 4) : 0
      this.chunk[this.outputChunkSamples] = Math.round(level * 32767)
      const finished = this.chunk
      this.transferList[0] = finished.buffer
      this.port.postMessage(finished, this.transferList)
      this.transferList[0] = null
      this.chunk = this.acquireChunk()
      this.filled = 0
      this.sumSquares = 0
      this.rmsCount = 0
    }
  }

  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel || channel.length === 0) return true

    const n = channel.length
    if (this.ratio === 1) {
      for (let i = 0; i < n; i++) {
        this.pushSample(channel[i])
      }
      return true
    }

    if (this.ratio === 2 && (n & 1) === 0) {
      for (let i = 0; i < n; i += 2) {
        this.pushSample((channel[i] + channel[i + 1]) * 0.5)
      }
      return true
    }

    while (this.srcPos < n - 1) {
      const idx = Math.floor(this.srcPos)
      const frac = this.srcPos - idx
      const s0 = idx < 0 ? this.prevSample : channel[idx]
      const s1 = channel[idx + 1]
      this.pushSample(s0 + (s1 - s0) * frac)
      this.srcPos += this.ratio
    }
    this.prevSample = channel[n - 1]
    this.srcPos -= n
    return true
  }
}

registerProcessor("vedora-realtime-capture", RealtimeCaptureProcessor)
