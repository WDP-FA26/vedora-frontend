/**
 * Microphone capture for the realtime voice agent, loaded by the patched `ai` package
 * (see patches/ai@7.0.181.patch). Runs on the audio thread and posts the input in chunks
 * of `chunkSamples` (Float32Array, mono) so the main thread only encodes and sends them.
 */
class RealtimeCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.chunkSamples = options.processorOptions?.chunkSamples ?? 1024
    this.chunk = new Float32Array(this.chunkSamples)
    this.filled = 0
  }

  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel) return true

    let read = 0
    while (read < channel.length) {
      const count = Math.min(channel.length - read, this.chunkSamples - this.filled)
      this.chunk.set(channel.subarray(read, read + count), this.filled)
      this.filled += count
      read += count
      if (this.filled === this.chunkSamples) {
        this.port.postMessage(this.chunk, [this.chunk.buffer])
        this.chunk = new Float32Array(this.chunkSamples)
        this.filled = 0
      }
    }
    return true
  }
}

registerProcessor("vedora-realtime-capture", RealtimeCaptureProcessor)
