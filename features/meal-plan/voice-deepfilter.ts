import type { DeepFilterNetAudioWorkletHandle } from "@workadventure/noise-suppression/deepfilternet"

export const DEEPFILTER_SAMPLE_RATE = 48_000
export const DEEPFILTER_MODULE_URL = "/deepfilternet/deepfilternet-worklet-processor.js"
export const DEEPFILTER_WASM_URL = "/deepfilternet/df_bg.wasm"
export const DEEPFILTER_MODEL_URL = "/deepfilternet/DeepFilterNet3_onnx.tar.gz"

const DEEPFILTER_PRELOAD_URLS = [
  DEEPFILTER_MODULE_URL,
  DEEPFILTER_WASM_URL,
  DEEPFILTER_MODEL_URL,
] as const

type NetworkInfo = {
  saveData?: boolean
  effectiveType?: string
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number
}

let preloaded = false

/** Whether the browser environment supports running DeepFilterNet3 in an AudioWorklet. */
export function isDeepFilterSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof WebAssembly !== "undefined" &&
    typeof AudioWorkletNode !== "undefined"
  )
}

function shouldSkipPreload(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection
  if (!connection) return false
  if (connection.saveData) return true
  return connection.effectiveType === "slow-2g" || connection.effectiveType === "2g"
}

type LowPriorityRequestInit = RequestInit & {
  priority?: "low" | "high" | "auto"
}

/**
 * Quietly warms the DeepFilterNet3 worklet, WASM binary, and ONNX tarball into the browser's
 * immutable HTTP cache during idle time on the meal planner page. Fetches sequentially at low
 * network priority so it never competes with page API/images or holds all assets in RAM at once,
 * and skips slow/save-data connections.
 */
export function preloadDeepFilterAssets(): void {
  if (preloaded || !isDeepFilterSupported() || shouldSkipPreload()) return
  preloaded = true

  const start = () => {
    void (async () => {
      const init: LowPriorityRequestInit = {
        credentials: "same-origin",
        priority: "low",
      }
      for (const url of DEEPFILTER_PRELOAD_URLS) {
        try {
          const response = await fetch(url, init)
          if (response.ok) {
            await response.arrayBuffer()
          }
        } catch {
          // Non-fatal: the toggle will fetch on demand if preload fails.
        }
      }
    })()
  }

  const idleWindow = window as IdleWindow
  if (typeof idleWindow.requestIdleCallback === "function") {
    idleWindow.requestIdleCallback(start, { timeout: 4000 })
    return
  }
  window.setTimeout(start, 2500)
}

/**
 * Loads `@workadventure/noise-suppression/deepfilternet` lazily and creates a 48 kHz
 * AudioWorklet node synchronized with the mic pipeline:
 * - `postGain: true` replaces browser AGC (which is turned off on the mic when AI denoise is on,
 *   so AGC does not amplify room noise before the denoiser).
 * - When `usePauseGate` is true (Auto sensitivity), uses DeepFilterNet3's low-latency pause gate
 *   (`pauseGateLookaheadFrames: 1`, +10 ms instead of +30 ms). When manual dB threshold is used,
 *   disables the internal pause gate so the user's dB slider has single-gate control.
 */
export async function attachDeepFilterNode(
  ctx: AudioContext,
  options: { usePauseGate?: boolean; onOverload?: (load: number) => void } = {}
): Promise<DeepFilterNetAudioWorkletHandle> {
  const { createDeepFilterNetAudioWorklet } = await import(
    "@workadventure/noise-suppression/deepfilternet"
  )
  const usePauseGate = options.usePauseGate ?? true
  return createDeepFilterNetAudioWorklet(ctx, {
    moduleUrl: DEEPFILTER_MODULE_URL,
    wasmUrl: DEEPFILTER_WASM_URL,
    modelUrl: DEEPFILTER_MODEL_URL,
    speechAttenuationDb: 25,
    pauseAttenuationDb: usePauseGate ? 45 : 25,
    pauseGateLookaheadFrames: 1,
    postGain: true,
    bypassUntilReady: true,
    onOverload: options.onOverload,
  })
}
