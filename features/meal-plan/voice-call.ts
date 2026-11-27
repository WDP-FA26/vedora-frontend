const UTTERANCE_PAUSE_MS = 2000
export const TRANSCRIPT_SETTLE_MS = 350
const SENTENCE_END = /[.?!…]["')\]]*\s*$/
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

function lastIndexStartedBy(fragments: TranscriptFragment[], offsetMs: number) {
  let index = fragments.length > 0 ? 0 : -1
  for (const [i, fragment] of fragments.entries()) {
    if (fragment.startMs <= offsetMs) index = i
  }
  return index
}

type UtteranceWatcher = { onFragment: () => void; cancel: () => void }

export class UtteranceAssembler {
  private fragments: TranscriptFragment[] = []
  private consumedUntil = -1
  private lastArrival = 0
  private watchers = new Set<UtteranceWatcher>()

  clearWatchers() {
    for (const watcher of [...this.watchers]) watcher.cancel()
  }

  reset() {
    this.clearWatchers()
    this.fragments = []
    this.consumedUntil = -1
  }

  addFragment(fragment: TranscriptFragment) {
    this.fragments.push(fragment)
    this.lastArrival = Date.now()
    for (const watcher of [...this.watchers]) watcher.onFragment()
  }

  lastFragmentAt() {
    return this.lastArrival
  }

  takeUtterance(offsetMs: number | undefined) {
    const fresh = this.fragments.filter((fragment) => fragment.endMs > this.consumedUntil)
    const anchor = offsetMs === undefined ? fresh.length - 1 : lastIndexStartedBy(fresh, offsetMs)
    if (anchor < 0) return ""
    let first = anchor
    while (first > 0 && fresh[first].startMs - fresh[first - 1].endMs < UTTERANCE_PAUSE_MS) first -= 1
    let last = anchor
    while (last < fresh.length - 1 && fresh[last + 1].startMs - fresh[last].endMs < UTTERANCE_PAUSE_MS) last += 1
    const taken = fresh.slice(first, last + 1)
    this.consumedUntil = taken[taken.length - 1].endMs
    return taken.map((fragment) => fragment.text).join("").trim()
  }

  utteranceReady(offsetMs: number | undefined, now: number) {
    const last = this.fragments.at(-1)
    if (!last) return false
    if (offsetMs !== undefined && last.endMs < offsetMs) return false
    if (SENTENCE_END.test(last.text)) return true
    return now - this.lastArrival >= TRANSCRIPT_SETTLE_MS
  }

  waitForUtterance(offsetMs: number | undefined, graceMs: number): Promise<boolean> {
    if (this.utteranceReady(offsetMs, Date.now())) return Promise.resolve(true)

    return new Promise<boolean>((resolve) => {
      let settled = false
      let settleTimer: ReturnType<typeof setTimeout> | undefined
      const graceTimer = setTimeout(() => done(true), graceMs)

      const done = (active: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(graceTimer)
        clearTimeout(settleTimer)
        this.watchers.delete(watcher)
        resolve(active)
      }

      const schedule = () => {
        clearTimeout(settleTimer)
        settleTimer = undefined
        const now = Date.now()
        if (this.utteranceReady(offsetMs, now)) {
          done(true)
          return
        }
        const last = this.fragments.at(-1)
        if (!last) return
        if (offsetMs !== undefined && last.endMs < offsetMs) return
        const waitMs = Math.max(0, TRANSCRIPT_SETTLE_MS - (now - this.lastArrival))
        settleTimer = setTimeout(() => {
          if (this.utteranceReady(offsetMs, Date.now())) done(true)
        }, waitMs)
      }

      const watcher: UtteranceWatcher = {
        onFragment: schedule,
        cancel: () => done(false),
      }
      this.watchers.add(watcher)
      schedule()
    })
  }
}

type InFlight = { delegationId: string; message: string; controller: AbortController; startedAt: number }

export class TurnQueue {
  private queue: Promise<void> = Promise.resolve()
  private generation = 0
  private inFlight: InFlight | null = null

  nextCall() {
    this.generation += 1
  }

  enqueue(task: () => Promise<void>) {
    const generation = this.generation
    const next = this.queue.then(() => {
      if (this.generation !== generation) return
      return task()
    })
    this.queue = next.catch((error: unknown) => {
      console.error("Voice delegation failed", error)
    })
  }

  idle() {
    return this.queue
  }

  begin(delegationId: string, message: string) {
    const controller = new AbortController()
    this.inFlight = { delegationId, message, controller, startedAt: Date.now() }
    return controller
  }

  running(): { delegationId: string; message: string } | null {
    if (!this.inFlight) return null
    return { delegationId: this.inFlight.delegationId, message: this.inFlight.message }
  }

  runningFor(delegationId: string) {
    if (this.inFlight?.delegationId !== delegationId) return 0
    return Date.now() - this.inFlight.startedAt
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
