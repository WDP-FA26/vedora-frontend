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
const MAX_CAPTIONS = 2
/** Saved changes are said aloud only once a turn has run this long; quick turns just answer. */
const PROGRESS_AFTER_MS = 6000

type TranscriptFragment = { text: string; startMs: number; endMs: number }
export type VoiceCaption = { id: number; speaker: "user" | "assistant"; text: string }
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
  private captionId = 0
  private inFlight: InFlight | null = null
  private webSearch: VoiceWebSearchRequest | null = null
  private stream: MediaStream | null = null
  private audio: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private samples = new Float32Array(0)

  reset() {
    this.fragments = []
    this.consumedUntil = -1
    this.webSearch = null
  }

  nextCaptionId() {
    this.captionId += 1
    return this.captionId
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

  releaseMicrophone() {
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

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

type VoiceOptions = {
  /** The week on screen, the planner's default week. */
  weekStart?: string
  today?: string
  /** The chat thread on screen: voice turns are saved into it, so the chat shows them. */
  threadId: string
  /** Called as each tool finishes, to open what it points at in the planner UI. */
  onFocus: (effects: VoiceEffects) => void
  /** Called when a turn ends (answered, failed or cancelled), to reload the chat thread. */
  onTurnEnd: (threadId: string) => void
}

/**
 * The meal planner's voice agent: GPT-Live through Vercel AI Gateway for the
 * conversation, and the planner agent on vedora-api for the work. GPT-Live
 * delegates; this hook streams the user's transcribed words to the API, mirrors
 * each tool as it finishes, and hands the result back to be spoken.
 */
export function useMealPlannerVoice({ weekStart, today, threadId, onFocus, onTurnEnd }: VoiceOptions) {
  const { accessToken, user } = useAuth()
  const { mutate } = useSWRConfig()
  // Built once per mount: a new object would replace the session.
  const [sessionConfig] = useState(() => voiceSessionConfig(user?.fullName))
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(0)
  const [captions, setCaptions] = useState<VoiceCaption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [ledger] = useState(() => new VoiceCallLedger())

  const realtime = experimental_useRealtime({
    model,
    api: { token: VOICE_SESSION_ROUTE },
    sessionConfig,
    onEvent: handleEvent,
    onError: (cause) => setError(cause.message),
  })

  function addCaption(speaker: VoiceCaption["speaker"], delta: string) {
    setCaptions((current) => {
      const last = current.at(-1)
      if (last && last.speaker === speaker) {
        return [...current.slice(0, -1), { ...last, text: last.text + delta }]
      }
      const next = [...current, { id: ledger.nextCaptionId(), speaker, text: delta }]
      return next.slice(-MAX_CAPTIONS)
    })
  }

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
      }
      addCaption(event.speaker, event.delta)
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
        const fresh = finishedActions(update).filter((action) => !seen.has(action.toolCallId))
        for (const action of fresh) {
          seen.add(action.toolCallId)
          const effects = voiceEffects([action])
          refresh(effects)
          if (effects.focus) onFocus(effects)
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
      onTurnEnd(threadId)
    }
  }

  async function start() {
    setOpen(true)
    setError(null)
    setCaptions([])
    ledger.reset()

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch {
      setError("Trình duyệt chưa cho phép dùng micro. Hãy bật quyền micro cho trang này rồi thử lại.")
      return
    }
    ledger.attachMicrophone(stream)
    setStartedAt(Date.now())
    await realtime.connect({ stream })
  }

  async function end() {
    ledger.cancel()
    try {
      await realtime.close()
    } finally {
      ledger.releaseMicrophone()
      setStartedAt(null)
      setOpen(false)
    }
  }

  async function toggleMute() {
    const muted = realtime.session?.isInputMuted ?? false
    await realtime.sendEvent({ type: muted ? "input-audio-unmute" : "input-audio-mute" })
  }

  // A forgotten call ends on its own.
  const connected = realtime.status === "connected"
  useEffect(() => {
    if (!connected) return
    const timer = setTimeout(() => void realtime.close(), VOICE_MAX_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [connected, realtime])

  // The microphone and any running turn belong to the call, so they stop when it ends on its own.
  const ended = realtime.status === "disconnected" || realtime.status === "error"
  useEffect(() => {
    if (!ended) return
    ledger.cancel()
    ledger.releaseMicrophone()
  }, [ended, ledger])

  useEffect(
    () => () => {
      ledger.cancel()
      ledger.releaseMicrophone()
    },
    [ledger]
  )

  const muted = realtime.session?.isInputMuted ?? false
  let orbState: VoiceOrbState = "idle"
  if (realtime.status === "connecting") orbState = "connecting"
  else if (realtime.status === "error" || error) orbState = "error"
  else if (realtime.status === "connected" && muted) orbState = "muted"
  else if (realtime.status === "connected" && realtime.isPlaying) orbState = "speaking"
  else if (realtime.status === "connected" && pending > 0) orbState = "thinking"
  else if (realtime.status === "connected") orbState = "listening"

  return {
    open,
    status: realtime.status,
    orbState,
    muted,
    captions,
    error,
    startedAt,
    inputLevel: () => ledger.inputLevel(),
    start,
    end,
    toggleMute,
  }
}

export type MealPlannerVoice = ReturnType<typeof useMealPlannerVoice>
