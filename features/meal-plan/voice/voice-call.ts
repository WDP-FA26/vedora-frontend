const END_AFTER_SPEECH_MS = 600
export const END_NO_SPEECH_LIMIT_MS = 6000
export const END_LIMIT_MS = 15000
const PLAYBACK_LAG_MS = 1500
export const FAREWELL_CANCEL_GRACE_MS = 800

const FAREWELL_ACK_PHRASES = new Set([
  "ok",
  "oke",
  "okay",
  "uk",
  "u",
  "ừ",
  "ừm",
  "uh",
  "um",
  "vâng",
  "dạ",
  "rồi",
  "bye",
  "bye bye",
  "byebye",
  "tạm biệt",
  "cảm ơn",
  "cảm ơn nhé",
  "cảm ơn nha",
  "nhé",
  "nha",
  "đi",
  "thôi",
  "thôi nhé",
  "được rồi",
])

function normalizeUtteranceFragment(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?…:;"'()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export class FarewellTracker {
  phase: "idle" | "sent" | "speaking" = "idle"
  private sentAt = 0
  private firstArrival = 0
  private lastArrival = 0
  private audioStartMs = 0
  private audioEndMs = 0
  private heardPlayback = false

  reset() {
    this.phase = "idle"
    this.heardPlayback = false
  }

  sent() {
    this.reset()
    this.phase = "sent"
    this.sentAt = Date.now()
  }

  spoke(startMs: number, endMs: number) {
    if (this.phase === "idle") return
    const now = Date.now()
    if (this.phase === "sent") {
      this.phase = "speaking"
      this.firstArrival = now
      this.audioStartMs = startMs
      this.audioEndMs = endMs
    }
    this.lastArrival = now
    this.audioEndMs = Math.max(this.audioEndMs, endMs)
  }

  shouldCancel(text: string, now = Date.now()): boolean {
    if (this.phase === "idle") return false
    if (now - this.sentAt < FAREWELL_CANCEL_GRACE_MS) return false
    const normalized = normalizeUtteranceFragment(text)
    if (normalized.length <= 1) return false
    if (FAREWELL_ACK_PHRASES.has(normalized)) return false
    return true
  }

  done(playing: boolean) {
    const now = Date.now()
    if (this.phase === "idle") return false
    if (this.phase === "sent") {
      return now - this.sentAt >= END_NO_SPEECH_LIMIT_MS
    }
    if (now - this.sentAt >= END_LIMIT_MS) return true
    if (now - this.lastArrival < END_AFTER_SPEECH_MS) return false
    if (playing) this.heardPlayback = true
    if (!playing && this.heardPlayback) return true
    const lag = playing ? PLAYBACK_LAG_MS : 0
    return now >= this.firstArrival + (this.audioEndMs - this.audioStartMs) + END_AFTER_SPEECH_MS + lag
  }
}

declare global {
  var __vedoraReadRealtimeOutputLevel: (() => number) | undefined
}

export type TranscriptFragment = { text: string; startMs: number; endMs: number }

type UtteranceWatcher = { onFragment: () => void; cancel: () => void }

export class UtteranceAssembler {
  private pending: TranscriptFragment[] = []
  private watchers = new Set<UtteranceWatcher>()

  clearWatchers() {
    for (const watcher of [...this.watchers]) watcher.cancel()
  }

  reset() {
    this.clearWatchers()
    this.pending = []
  }

  addFragment(fragment: TranscriptFragment) {
    this.pending.push(fragment)
    for (const watcher of [...this.watchers]) watcher.onFragment()
  }

  takeUtterance() {
    const taken = this.pending.toSorted((a, b) => a.startMs - b.startMs)
    this.pending = []
    return taken.map((fragment) => fragment.text).join("").trim()
  }

  hasUtterance() {
    return this.pending.length > 0
  }

  waitForUtterance(): Promise<boolean> {
    if (this.hasUtterance()) return Promise.resolve(true)

    return new Promise<boolean>((resolve) => {
      const watcher: UtteranceWatcher = {
        onFragment: () => {
          if (!this.hasUtterance()) return
          this.watchers.delete(watcher)
          resolve(true)
        },
        cancel: () => {
          this.watchers.delete(watcher)
          resolve(false)
        },
      }
      this.watchers.add(watcher)
    })
  }
}

type InFlight = { delegationId: string; message: string; revision: boolean; saved: string[]; controller: AbortController }

export class TurnQueue {
  private queue: Promise<void> = Promise.resolve()
  private generation = 0
  private delegationSeq = 0
  private inFlight: InFlight | null = null

  nextCall() {
    this.generation += 1
    this.delegationSeq += 1
  }

  claimDelegation() {
    this.delegationSeq += 1
    return this.delegationSeq
  }

  isLatestDelegation(seq: number) {
    return this.delegationSeq === seq
  }

  enqueue(task: () => Promise<void>, delegationSeq?: number) {
    const generation = this.generation
    const next = this.queue.then(() => {
      if (this.generation !== generation) return
      if (delegationSeq !== undefined && this.delegationSeq !== delegationSeq) return
      return task()
    })
    this.queue = next.catch((error: unknown) => {
      console.error("Voice delegation failed", error)
    })
  }

  idle() {
    return this.queue
  }

  begin(delegationId: string, message: string, revision = false) {
    const controller = new AbortController()
    this.inFlight = { delegationId, message, revision, saved: [], controller }
    return controller
  }

  running(): { delegationId: string; message: string; revision: boolean; saved: readonly string[] } | null {
    if (!this.inFlight) return null
    const { delegationId, message, revision, saved } = this.inFlight
    return { delegationId, message, revision, saved }
  }

  recordSaved(delegationId: string, change: string) {
    if (this.inFlight?.delegationId === delegationId) this.inFlight.saved.push(change)
  }

  finish(delegationId: string) {
    if (this.inFlight?.delegationId === delegationId) this.inFlight = null
  }

  cancel(): string | null {
    const running = this.inFlight
    if (!running) return null
    running.controller.abort()
    this.inFlight = null
    return running.delegationId
  }

  stop() {
    this.generation += 1
    this.delegationSeq += 1
    this.cancel()
  }
}

export class MicrophoneSession {
  private stream: MediaStream | null = null
  private monitoring = false
  private generation = 0
  private level = 0

  readonly readInputLevel = () => (this.monitoring ? this.level : 0)
  readonly readOutputLevel = () => globalThis.__vedoraReadRealtimeOutputLevel?.() ?? 0

  setInputLevel(level: number) {
    this.level = level
  }

  begin() {
    this.generation += 1
    return this.generation
  }

  isCurrent(generation: number) {
    return this.generation === generation
  }

  attach(stream: MediaStream) {
    this.stream = stream
  }

  currentStream(): MediaStream | null {
    return this.stream
  }

  setMonitoring(active: boolean) {
    this.monitoring = active
  }

  release() {
    this.generation += 1
    this.monitoring = false
    this.level = 0
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = null
  }
}

export class VoiceCallLedger {
  readonly utterances = new UtteranceAssembler()
  readonly turns = new TurnQueue()
  readonly mic = new MicrophoneSession()

  readonly readInputLevel = this.mic.readInputLevel
  readonly readOutputLevel = this.mic.readOutputLevel

  reset() {
    this.turns.nextCall()
    this.utterances.reset()
  }

  endCall() {
    this.utterances.clearWatchers()
    this.turns.stop()
    this.mic.release()
  }
}
