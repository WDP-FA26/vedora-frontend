/**
 * Bookkeeping of one meal planner voice call, split into focused, testable units
 * (`UtteranceAssembler`, `TurnQueue`, `MicrophoneSession`, `FarewellTracker`) and
 * composed by `VoiceCallLedger`.
 */

/** A pause longer than this between words starts a new utterance. */
const UTTERANCE_PAUSE_MS = 2000
/**
 * Without a sentence end, the user has finished speaking once no new words arrived for this
 * long. Every delegation waits up to this long before the API sees it, so it stays short.
 */
export const TRANSCRIPT_SETTLE_MS = 350
/** The transcript ends a sentence: GPT-Live punctuates what it heard as finished. */
const SENTENCE_END = /[.?!…]["')\]]*\s*$/
/** After the farewell has played, how long to wait before hanging up, so its last word is not cut. */
const END_AFTER_SPEECH_MS = 600
/** Safety net when GPT-Live never emits a farewell transcript after `endCall`. */
export const END_NO_SPEECH_LIMIT_MS = 6000
/** Safety net: hang up this long after the farewell was sent, whatever the signals say. */
export const END_LIMIT_MS = 15000
/** How far playback may trail the farewell's transcript while the player still reports playing. */
const PLAYBACK_LAG_MS = 1500
/** Ignore late-arriving user fragments from the end-call utterance itself right after `sent()`. */
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

/**
 * Follows the farewell the agent asked to hang up after, from GPT-Live's own events. Its
 * transcript arrives as the audio streams, and each piece carries `start_ms`/`end_ms`, so
 * the farewell's length is known: the call ends once that much audio has had time to play
 * and no more words come, or as soon as the player reports it has stopped.
 */
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

  /** GPT-Live spoke; after the farewell was sent that is the farewell (its words can arrive before the acknowledgment). */
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

  /**
   * Whether an incoming user transcript fragment means the user genuinely wants to keep
   * talking, rather than a late trailing fragment of their end-call command or a brief
   * goodbye acknowledgement ("ok", "bye", "cảm ơn").
   */
  shouldCancel(text: string, now = Date.now()): boolean {
    if (this.phase === "idle") return false
    if (now - this.sentAt < FAREWELL_CANCEL_GRACE_MS) return false
    const normalized = normalizeUtteranceFragment(text)
    if (normalized.length <= 1) return false
    if (FAREWELL_ACK_PHRASES.has(normalized)) return false
    return true
  }

  /** Whether the farewell has been heard to the end (or the safety net ran out). */
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
    // The player can lag the stream (its jitter buffer) or never report a stop, so the
    // farewell's own length decides, with room for that lag while it still reports playing.
    const lag = playing ? PLAYBACK_LAG_MS : 0
    return now >= this.firstArrival + (this.audioEndMs - this.audioStartMs) + END_AFTER_SPEECH_MS + lag
  }
}

declare global {
  var __vedoraReadRealtimeOutputLevel: (() => number) | undefined
}

export type TranscriptFragment = { text: string; startMs: number; endMs: number }

/** The last fragment that started at or before `offsetMs`, or the first one when none did. */
function lastIndexStartedBy(fragments: TranscriptFragment[], offsetMs: number) {
  let index = fragments.length > 0 ? 0 : -1
  for (const [i, fragment] of fragments.entries()) {
    if (fragment.startMs <= offsetMs) index = i
  }
  return index
}

type UtteranceWatcher = { onFragment: () => void; cancel: () => void }

/**
 * Reassembles user transcript fragments from GPT-Live into per-delegation utterances.
 * Required by AI Gateway's GPT-Live client delegation protocol, which carries an ID and
 * `offsetMs` rather than the spoken text.
 */
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

  /**
   * The words of the utterance a delegation fired on, as one message. GPT-Live often
   * delegates before the user finishes, so the utterance is the run of words around
   * `offsetMs` with no pause longer than `UTTERANCE_PAUSE_MS`, trailing words included.
   */
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

/**
 * Serializes delegated voice turns so the chat thread stays ordered, tracks the
 * currently running turn's `AbortController`, and drops stale queued work when a call ends.
 */
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

/**
 * Owns the active microphone `MediaStream`, generation guard against stale `getUserMedia`
 * resolutions, and 60 fps level getters for `VoiceOrb`.
 */
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

/**
 * Composes the non-rendering state of one voice call: transcript assembly, turn
 * serialization/cancellation, and microphone lifecycle.
 */
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
