/**
 * Bookkeeping of one meal planner voice call, kept apart from the React hook
 * (`hooks/use-meal-planner-voice.ts`) so it can be tested on its own.
 */

import type { VoiceWebSearchRequest } from "@/features/meal-plan/voice"

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
/** Safety net: hang up this long after the farewell was sent, whatever the signals say. */
const END_LIMIT_MS = 20000
/** How far playback may trail the farewell's transcript while the player still reports playing. */
const PLAYBACK_LAG_MS = 1500

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

  /** Whether the farewell has been heard to the end (or the safety net ran out). */
  done(playing: boolean) {
    const now = Date.now()
    if (this.phase === "idle") return false
    if (now - this.sentAt >= END_LIMIT_MS) return true
    if (this.phase !== "speaking") return false
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
  var __vedoraRealtimeInputLevel: number | undefined
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
type InFlight = { delegationId: string; message: string; controller: AbortController; startedAt: number }

/**
 * Bookkeeping of one voice call that never drives rendering: the microphone and its
 * level meter, the user's transcript since the last delegation, the delegation in
 * flight (cancelled when the user speaks again), a web search waiting for a yes or
 * no, and the queue that runs delegations one at a time so the thread stays in order.
 */
export class VoiceCallLedger {
  private fragments: TranscriptFragment[] = []
  private consumedUntil = -1
  private lastArrival = 0
  private queue: Promise<void> = Promise.resolve()
  /** Counts calls; queued work from an earlier call is dropped instead of run. */
  private call = 0
  private inFlight: InFlight | null = null
  private webSearch: VoiceWebSearchRequest | null = null
  private stream: MediaStream | null = null
  private monitoring = false
  private micGeneration = 0

  /** Stable getters passed to `VoiceOrb` so its 60 fps loop never forces React re-renders. */
  readonly readInputLevel = () => this.inputLevel()
  readonly readOutputLevel = () => globalThis.__vedoraReadRealtimeOutputLevel?.() ?? 0

  /** Starts a new call: what the last one left queued no longer runs. */
  reset() {
    this.call += 1
    this.fragments = []
    this.consumedUntil = -1
    this.webSearch = null
  }

  addFragment(fragment: TranscriptFragment) {
    this.fragments.push(fragment)
    this.lastArrival = Date.now()
  }

  /**
   * The words of the utterance a delegation fired on, as one message. GPT-Live often
   * delegates before the user finishes, so the utterance is the run of words around
   * `offsetMs` with no pause longer than `UTTERANCE_PAUSE_MS`, trailing words included.
   * Earlier words it answered itself (small talk, "xong chưa") are dropped, and later
   * words, after a pause, wait for their own delegation.
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

  /** When the newest transcript fragment arrived, in `Date.now()` milliseconds. */
  lastFragmentAt() {
    return this.lastArrival
  }

  /**
   * Whether the words a delegation fired on can be taken now. The transcript must reach the
   * delegation point (`offsetMs`); then a finished sentence goes at once, and otherwise the
   * words go once none arrived for `TRANSCRIPT_SETTLE_MS`.
   */
  utteranceReady(offsetMs: number | undefined, now: number) {
    const last = this.fragments.at(-1)
    if (!last) return false
    if (offsetMs !== undefined && last.endMs < offsetMs) return false
    if (SENTENCE_END.test(last.text)) return true
    return now - this.lastArrival >= TRANSCRIPT_SETTLE_MS
  }

  /**
   * Runs `task` after the tasks before it, unless the call ended first. A task that fails
   * does not stop the ones after it: every later delegation would go unanswered.
   */
  enqueue(task: () => Promise<void>) {
    const call = this.call
    const next = this.queue.then(() => {
      if (this.call !== call) return
      return task()
    })
    this.queue = next.catch((error: unknown) => {
      console.error("Voice delegation failed", error)
    })
  }

  /** Waits for every queued task; for tests. */
  idle() {
    return this.queue
  }

  /** The call ended: stops the running delegation, drops the queued ones and releases the microphone. */
  endCall() {
    this.call += 1
    this.cancel()
    this.releaseMicrophone()
  }

  /** Marks a delegation as running; its controller stops the API request. */
  begin(delegationId: string, message: string) {
    const controller = new AbortController()
    this.inFlight = { delegationId, message, controller, startedAt: Date.now() }
    return controller
  }

  /** The delegation the API is working on, if any. */
  running(): { delegationId: string; message: string } | null {
    if (!this.inFlight) return null
    return { delegationId: this.inFlight.delegationId, message: this.inFlight.message }
  }

  /** How long the running delegation has taken so far, in milliseconds. */
  runningFor(delegationId: string) {
    if (this.inFlight?.delegationId !== delegationId) return 0
    return Date.now() - this.inFlight.startedAt
  }

  finish(delegationId: string) {
    if (this.inFlight?.delegationId === delegationId) this.inFlight = null
  }

  /** Stops the running delegation, if any, and returns its id. */
  cancel(): string | null {
    const running = this.inFlight
    if (!running) return null
    running.controller.abort()
    this.inFlight = null
    return running.delegationId
  }

  awaitWebSearchAnswer(request: VoiceWebSearchRequest | null) {
    this.webSearch = request
  }

  /** The web search the next words answer, once. */
  takeWebSearchRequest() {
    const request = this.webSearch
    this.webSearch = null
    return request ?? undefined
  }

  /** Marks a new microphone acquisition so stale getUserMedia resolutions can be discarded. */
  beginMicrophone() {
    this.micGeneration += 1
    return this.micGeneration
  }

  isCurrentMicrophone(generation: number) {
    return this.micGeneration === generation
  }

  attachMicrophone(stream: MediaStream) {
    this.stream = stream
  }

  /** A 0–1 level of the microphone, read once per animation frame by the orb. */
  inputLevel() {
    return this.monitoring ? (globalThis.__vedoraRealtimeInputLevel ?? 0) : 0
  }

  /** Pauses reading the microphone level when the orb is not listening. */
  setMonitoring(active: boolean) {
    this.monitoring = active
  }

  releaseMicrophone() {
    this.micGeneration += 1
    this.monitoring = false
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = null
  }
}
