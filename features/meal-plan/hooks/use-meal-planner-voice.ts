"use client"

import { useEffect, useState } from "react"
import { experimental_useRealtime } from "@ai-sdk/react"
import { gateway, type Experimental_RealtimeServerEvent } from "ai"
import { useSWRConfig } from "swr"

import type { VoiceOrbState } from "@/components/ui/voice-orb"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { MY_DIETARY_KEY, MY_NUTRITION_KEY } from "@/features/dietary/dietary"
import { isMealLogKey } from "@/features/meal-plan/meal-log"
import { isMealPlanKey } from "@/features/meal-plan/meal-plan"
import {
  appendableText,
  finishedActions,
  pendingWebSearch,
  progressLine,
  replyText,
  streamVoiceTurn,
  VOICE_MAX_SECONDS,
  VOICE_MODEL_ID,
  VOICE_SESSION_ROUTE,
  voiceEffects,
  voiceErrorText,
  voicePageContext,
  voiceSessionConfig,
  type VoiceEffects,
  type VoiceWebSearchRequest,
} from "@/features/meal-plan/voice"
import { ApiError } from "@/features/shared/lib/api-client"

/** Created once: a new model object would replace the hook's session. */
const model = gateway.experimental_realtime(VOICE_MODEL_ID)

/** How long to wait for the last words of an utterance after GPT-Live delegates. */
const TRANSCRIPT_GRACE_MS = 800
/** Saved changes are said aloud only once a turn has run this long; quick turns just answer. */
const PROGRESS_AFTER_MS = 6000
/**
 * How long the orb stays "speaking" after playback stops. A late audio chunk briefly empties
 * the queue mid-sentence; without this the orb would flip to listening and back.
 */
const SPEAKING_HOLD_MS = 250
/** Audio the player may hold before it pauses; generous, since RAM is cheap and Gateway p99 is not. */
const MAX_PLAYBACK_BUFFER_SECONDS = 60

type TranscriptFragment = { text: string; startMs: number; endMs: number }
type InFlight = { delegationId: string; controller: AbortController; startedAt: number }

/**
 * Bookkeeping of one voice call that never drives rendering: the microphone and its
 * level meter, the user's transcript since the last delegation, the delegation in
 * flight (cancelled when the user speaks again), a web search waiting for a yes or
 * no, and the queue that runs delegations one at a time so the thread stays in order.
 */
class VoiceCallLedger {
  private fragments: TranscriptFragment[] = []
  private consumedUntil = -1
  private queue: Promise<void> = Promise.resolve()
  private inFlight: InFlight | null = null
  private webSearch: VoiceWebSearchRequest | null = null
  private stream: MediaStream | null = null
  private audio: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private samples = new Float32Array(0)
  private micGeneration = 0

  /** Stable getter passed to `VoiceOrb` so its 60 fps loop never forces React re-renders. */
  readonly readInputLevel = () => this.inputLevel()

  reset() {
    this.fragments = []
    this.consumedUntil = -1
    this.webSearch = null
  }

  addFragment(fragment: TranscriptFragment) {
    this.fragments.push(fragment)
  }

  /** Where the newest user transcript ends, in session milliseconds; -1 before any. */
  latestEndMs() {
    return this.fragments.at(-1)?.endMs ?? -1
  }

  /** The user's words since the last delegation, as one message. */
  takeUtterance() {
    const fresh = this.fragments.filter((fragment) => fragment.endMs > this.consumedUntil)
    const last = fresh.at(-1)
    if (last) this.consumedUntil = last.endMs
    return fresh.map((fragment) => fragment.text).join("").trim()
  }

  enqueue(task: () => Promise<void>) {
    this.queue = this.queue.then(task)
  }

  /** Marks a delegation as running; its controller stops the API request. */
  begin(delegationId: string) {
    const controller = new AbortController()
    this.inFlight = { delegationId, controller, startedAt: Date.now() }
    return controller
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
    this.audio = new AudioContext()
    this.analyser = this.audio.createAnalyser()
    this.analyser.fftSize = 512
    this.audio.createMediaStreamSource(stream).connect(this.analyser)
    this.samples = new Float32Array(this.analyser.fftSize)
  }

  /** A 0–1 level of the microphone, read once per animation frame by the orb. */
  inputLevel() {
    if (!this.analyser) return 0
    this.analyser.getFloatTimeDomainData(this.samples)
    let sum = 0
    for (const sample of this.samples) sum += sample * sample
    return Math.min(1, Math.sqrt(sum / this.samples.length) * 4)
  }

  /** Pauses the meter's AudioContext when the orb is not listening, saving CPU and battery. */
  setMonitoring(active: boolean) {
    if (!this.audio) return
    if (active && this.audio.state === "suspended") void this.audio.resume()
    else if (!active && this.audio.state === "running") void this.audio.suspend()
  }

  releaseMicrophone() {
    this.micGeneration += 1
    void this.audio?.close()
    this.audio = null
    this.analyser = null
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = null
  }
}

function failureText(error: unknown) {
  if (error instanceof ApiError && error.code === "AI_QUOTA_EXCEEDED") {
    return "Người dùng đã dùng hết lượt trợ lý AI hiện có, nên yêu cầu này chưa được thực hiện."
  }
  if (error instanceof ApiError && error.status === 429) {
    return "Người dùng gửi yêu cầu quá nhanh nên yêu cầu này chưa được thực hiện; mời họ đợi một chút rồi nói lại."
  }
  return "Yêu cầu này chưa xử lý xong vì hệ thống gặp lỗi; một phần có thể đã được lưu. Mời người dùng xem lại màn hình và thử lại sau ít phút."
}

/** Whether a tool changed saved data or asked to open something, as opposed to only reading. */
function touchesScreen(effects: VoiceEffects) {
  if (effects.focus) return true
  return effects.planChanged || effects.logChanged || effects.nutritionChanged || effects.dietaryChanged
}

/**
 * `value`, but it stays true for `holdMs` after `value` turns false, so a short drop does
 * not show. A drop longer than that is shown.
 */
function useHeldTrue(value: boolean, holdMs: number) {
  const [held, setHeld] = useState(value)
  // Adjusting state while rendering: React re-renders right away, before painting.
  if (value && !held) setHeld(true)
  useEffect(() => {
    if (value || !held) return
    const timer = setTimeout(() => setHeld(false), holdMs)
    return () => clearTimeout(timer)
  }, [value, held, holdMs])
  return value || held
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

async function openVoiceCall({
  ledger,
  connect,
  onError,
  onStarted,
}: {
  ledger: VoiceCallLedger
  connect: (options: { stream: MediaStream }) => Promise<void>
  onError: (message: string) => void
  onStarted: (startedAt: number) => void
}) {
  ledger.reset()
  const generation = ledger.beginMicrophone()

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch {
    if (ledger.isCurrentMicrophone(generation)) {
      onError("Trình duyệt chưa cho phép dùng micro. Hãy bật quyền micro cho trang này rồi thử lại.")
    }
    return
  }
  if (!ledger.isCurrentMicrophone(generation)) {
    for (const track of stream.getTracks()) track.stop()
    return
  }
  ledger.attachMicrophone(stream)
  onStarted(Date.now())
  await connect({ stream })
}

type VoiceOptions = {
  /** The week on screen, the planner's default week. */
  weekStart?: string
  today?: string
  /** The chat thread on screen: voice turns are saved into it, so the chat shows them. */
  threadId: string
  /** Called as each tool that changes or opens something finishes, to show it in the planner UI. */
  onEffects: (effects: VoiceEffects) => void
  /** Called when a turn the API took up ends (answered, failed or cancelled), to reload the chat thread. */
  onTurnEnd: (threadId: string) => void
  /** Called when the user ends the voice session. */
  onClose: () => void
}

/**
 * The meal planner's voice agent: GPT-Live through Vercel AI Gateway for the
 * conversation, and the planner agent on vedora-api for the work. GPT-Live
 * delegates; this hook streams the user's transcribed words to the API, mirrors
 * each tool as it finishes, and hands the result back to be spoken.
 */
export function useMealPlannerVoice({ weekStart, today, threadId, onEffects, onTurnEnd, onClose }: VoiceOptions) {
  const { accessToken, user } = useAuth()
  const { mutate } = useSWRConfig()
  // Built once per mount: a new object would replace the session.
  const [sessionConfig] = useState(() => voiceSessionConfig(user?.fullName))
  const [pending, setPending] = useState(0)
  /** Whether the user has said anything this call; the suggestions show until then. */
  const [heard, setHeard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  /**
   * Whether this attempt has reached "connected". The SDK starts out "disconnected", so
   * without this the call would count as ended before it began.
   */
  const [wasConnected, setWasConnected] = useState(false)
  const [ledger] = useState(() => new VoiceCallLedger())

  const realtime = experimental_useRealtime({
    model,
    api: { token: VOICE_SESSION_ROUTE },
    sessionConfig,
    // The SDK keeps every server event, audio chunks included, and re-renders on each one;
    // the planner reads none of them, so keeping one stops it holding seconds of audio.
    maxEvents: 1,
    // The SDK pauses playback once this much audio is queued (default 2s). A slow AI Gateway
    // can deliver several seconds at once after a stall; barge-in still clears the queue at once.
    maxPlaybackBufferSeconds: MAX_PLAYBACK_BUFFER_SECONDS,
    onEvent: handleEvent,
    onError: (cause) => setError(voiceErrorText(cause.message)),
  })

  function append(delegationId: string | null, channel: "thinking" | "commentary", content: string) {
    return realtime.sendEvent({
      type: "context-append",
      delegationId,
      content: appendableText(content),
      providerOptions: { openai: { channel } },
    })
  }

  function handleEvent(event: Experimental_RealtimeServerEvent) {
    if (event.type === "session-started" && weekStart && today) {
      void append(null, "thinking", voicePageContext(weekStart, today))
      return
    }
    if (event.type === "transcript-fragment") {
      if (event.speaker === "user") {
        ledger.addFragment({ text: event.delta, startMs: event.startMs, endMs: event.endMs })
        setHeard(true)
      }
      return
    }
    if (event.type === "delegation-created") {
      // New words supersede the work still running: stop it, keep what it saved.
      const superseded = ledger.cancel()
      if (superseded) {
        void append(superseded, "thinking", "Việc này đã dừng vì người dùng nói tiếp; những gì đã lưu vẫn giữ.")
      }
      const delegationId = event.delegationId
      const offsetMs = event.offsetMs
      ledger.enqueue(() => runDelegation(delegationId, offsetMs))
    }
  }

  /** Waits briefly for transcript fragments that end at the delegation point. */
  async function waitForTranscript(offsetMs: number | undefined) {
    if (offsetMs === undefined) return
    const deadline = Date.now() + TRANSCRIPT_GRACE_MS
    while (Date.now() < deadline) {
      if (ledger.latestEndMs() >= offsetMs) return
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  function refresh(effects: VoiceEffects) {
    if (effects.planChanged) void mutate(isMealPlanKey)
    if (effects.logChanged) void mutate(isMealLogKey)
    if (effects.nutritionChanged) {
      void mutate((key) => Array.isArray(key) && key[0] === MY_NUTRITION_KEY)
    }
    if (effects.dietaryChanged) {
      void mutate((key) => Array.isArray(key) && key[0] === MY_DIETARY_KEY)
    }
  }

  async function runDelegation(delegationId: string, offsetMs: number | undefined) {
    await waitForTranscript(offsetMs)
    const message = ledger.takeUtterance()
    if (!message) {
      await append(delegationId, "commentary", "Chưa nghe rõ người dùng nói gì; mời họ nói lại yêu cầu.")
      return
    }
    if (!accessToken || !weekStart) {
      await append(delegationId, "commentary", failureText(null))
      return
    }

    const controller = ledger.begin(delegationId)
    const seen = new Set<string>()
    let reply = ""
    let webSearch: VoiceWebSearchRequest | null = null
    // The API saves the user message before it streams, so the thread exists once a reply starts.
    let saved = false
    setPending((count) => count + 1)
    try {
      const turn = streamVoiceTurn(
        accessToken,
        {
          weekStart,
          message,
          threadId,
          requestId: delegationId,
          webSearchRequest: ledger.takeWebSearchRequest(),
        },
        controller.signal
      )
      for await (const update of turn) {
        saved = true
        const fresh = finishedActions(update).filter((action) => !seen.has(action.toolCallId))
        for (const action of fresh) {
          seen.add(action.toolCallId)
          const effects = voiceEffects([action])
          refresh(effects)
          if (touchesScreen(effects)) onEffects(effects)
          const line = progressLine(action)
          if (line && ledger.runningFor(delegationId) > PROGRESS_AFTER_MS) {
            void append(delegationId, "commentary", line)
          }
        }
        reply = replyText(update)
        webSearch = pendingWebSearch(update)
      }
      ledger.awaitWebSearchAnswer(webSearch)
      if (webSearch) {
        await append(
          delegationId,
          "commentary",
          `${reply ? `${reply} ` : ""}Cần tìm thêm trên web: ${webSearch.reason}. Hỏi người dùng có đồng ý để tìm không.`
        )
      } else {
        await append(delegationId, "commentary", reply || "Đã xong.")
      }
    } catch (cause) {
      // A cancelled turn was superseded or the call ended; the next turn speaks.
      if (!isAbort(cause)) await append(delegationId, "commentary", failureText(cause))
    } finally {
      ledger.finish(delegationId)
      setPending((count) => count - 1)
      if (saved) onTurnEnd(threadId)
    }
  }

  const connectRealtime = realtime.connect
  const closeRealtime = realtime.close

  async function start() {
    setError(null)
    setHeard(false)
    setWasConnected(false)
    await openVoiceCall({
      ledger,
      connect: connectRealtime,
      onError: setError,
      onStarted: setStartedAt,
    })
  }

  async function end() {
    ledger.cancel()
    try {
      await closeRealtime()
    } finally {
      ledger.releaseMicrophone()
      setStartedAt(null)
      onClose()
    }
  }

  async function toggleMute() {
    const muted = realtime.session?.isInputMuted ?? false
    await realtime.sendEvent({ type: muted ? "input-audio-unmute" : "input-audio-mute" })
  }

  useEffect(() => {
    void openVoiceCall({
      ledger,
      connect: connectRealtime,
      onError: setError,
      onStarted: setStartedAt,
    })
    return () => {
      ledger.cancel()
      ledger.releaseMicrophone()
    }
  }, [ledger, connectRealtime])

  // A forgotten call ends on its own.
  const connected = realtime.status === "connected"
  // Adjusting state while rendering: React re-renders right away, before painting.
  if (connected && !wasConnected) setWasConnected(true)
  useEffect(() => {
    if (!connected) return
    const timer = setTimeout(() => void closeRealtime(), VOICE_MAX_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [connected, closeRealtime])

  // The microphone and any running turn belong to the call, so they stop when it ends on its own.
  const ended = (wasConnected && realtime.status === "disconnected") || realtime.status === "error"
  useEffect(() => {
    if (!ended) return
    ledger.cancel()
    ledger.releaseMicrophone()
  }, [ended, ledger])

  const muted = realtime.session?.isInputMuted ?? false
  const speaking = useHeldTrue(connected && !muted && realtime.isPlaying, SPEAKING_HOLD_MS)
  let orbState: VoiceOrbState = "idle"
  if (realtime.status === "error" || error) orbState = "error"
  // Waiting for the microphone or the session counts as connecting, not as ended.
  else if (realtime.status === "connecting" || !wasConnected) orbState = "connecting"
  else if (connected && muted) orbState = "muted"
  else if (connected && speaking) orbState = "speaking"
  else if (connected && pending > 0) orbState = "thinking"
  else if (connected) orbState = "listening"

  const monitoring = orbState === "listening"
  useEffect(() => {
    ledger.setMonitoring(monitoring)
  }, [ledger, monitoring])

  return {
    status: realtime.status,
    orbState,
    muted,
    heard,
    error,
    startedAt,
    inputLevel: ledger.readInputLevel,
    start,
    end,
    toggleMute,
  }
}

export type MealPlannerVoice = ReturnType<typeof useMealPlannerVoice>
