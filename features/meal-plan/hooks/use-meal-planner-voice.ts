"use client"

import { useEffect, useRef, useState } from "react"
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
  VOICE_RECIPE_CLOSED_CONTEXT,
  VOICE_SESSION_ROUTE,
  voiceEffects,
  voiceErrorText,
  voicePageContext,
  voiceRecipeContext,
  voiceSessionConfig,
  classifyInterruption,
  type VoiceEffects,
  type VoiceInterruption,
  type VoiceOpenRecipe,
  type VoiceScreen,
  type VoiceWebSearchRequest,
} from "@/features/meal-plan/voice"
import { FarewellTracker, VoiceCallLedger } from "@/features/meal-plan/voice-call"
import { ApiError } from "@/features/shared/lib/api-client"

/** Created once: a new model object would replace the hook's session. */
const model = gateway.experimental_realtime(VOICE_MODEL_ID)

/** The longest wait for the last words of an utterance after GPT-Live delegates. */
const TRANSCRIPT_GRACE_MS = 3000
/** Saved changes are said aloud only once a turn has run this long; quick turns just answer. */
const PROGRESS_AFTER_MS = 6000
/**
 * A saved change is said aloud only when the reply has not followed it within this long, so
 * GPT-Live does not say the change and then the reply that repeats it. GPT-Live knows of the
 * change from the start (`thinking`) and can answer "xong chưa" with it.
 */
const PROGRESS_SPEAK_DELAY_MS = 2000
/**
 * How long the orb stays "speaking" after playback stops. A late audio chunk briefly empties
 * the queue mid-sentence; without this the orb would flip to listening and back.
 */
const SPEAKING_HOLD_MS = 250
/** How often the farewell's progress is checked while the call is ending. */
const END_CHECK_MS = 200
/** Audio the player may hold before it pauses; generous, since RAM is cheap and Gateway p99 is not. */
const MAX_PLAYBACK_BUFFER_SECONDS = 60

/** Latest billed duration snapshot from AI Gateway alongside the local time it arrived. */
export type VoiceUsageAnchor = { seconds: number; at: number }

function usageSnapshot(seconds: number): VoiceUsageAnchor {
  return { seconds, at: Date.now() }
}

function failureText(error: unknown) {
  if (error instanceof ApiError && error.code === "AI_QUOTA_EXCEEDED") {
    return "Người dùng đã dùng hết lượt trợ lý AI hiện có, nên yêu cầu này chưa được thực hiện."
  }
  if (error instanceof ApiError && error.status === 429) {
    return "Người dùng gửi yêu cầu quá nhanh nên yêu cầu này chưa được thực hiện; đợi vài giây là thử lại được."
  }
  return "Yêu cầu này chưa xử lý xong vì hệ thống gặp lỗi; một phần có thể đã được lưu và đang hiện trên màn hình."
}

/** Whether a tool changed saved data or asked to open something, as opposed to only reading. */
function touchesScreen(effects: VoiceEffects) {
  if (effects.focus || effects.close) return true
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

type SendRealtimeEvent = ReturnType<typeof experimental_useRealtime>["sendEvent"]

/**
 * Tells GPT-Live something. The SDK throws, even synchronously, once the session stops taking
 * events (the call is closing, ended or failed); there is no one left to tell then, and the
 * SDK reports transport failures through `onError` itself.
 */
async function sendContext(
  sendEvent: SendRealtimeEvent,
  delegationId: string | null,
  channel: "thinking" | "commentary",
  content: string
) {
  try {
    await sendEvent({
      type: "context-append",
      delegationId,
      content: appendableText(content),
      providerOptions: { openai: { channel } },
    })
  } catch (error) {
    console.warn("Voice context not sent", error)
  }
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

async function openVoiceCall({
  ledger,
  connect,
  onError,
}: {
  ledger: VoiceCallLedger
  connect: (options: { stream: MediaStream }) => Promise<void>
  onError: (message: string) => void
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
  /** What the page shows right now, sent with each turn so the agent can refer to it. */
  getScreen: () => VoiceScreen | null
  openRecipe?: VoiceOpenRecipe | null
}

/**
 * The meal planner's voice agent: GPT-Live through Vercel AI Gateway for the
 * conversation, and the planner agent on vedora-api for the work. GPT-Live
 * delegates; this hook streams the user's transcribed words to the API, mirrors
 * each tool as it finishes, and hands the result back to be spoken.
 */
export function useMealPlannerVoice({
  weekStart,
  today,
  threadId,
  onEffects,
  onTurnEnd,
  onClose,
  getScreen,
  openRecipe,
}: VoiceOptions) {
  const { accessToken, user } = useAuth()
  const { mutate } = useSWRConfig()
  // Built once per mount: a new object would replace the session.
  const [sessionConfig] = useState(() => voiceSessionConfig(user?.fullName))
  const [pending, setPending] = useState(0)
  /** The agent asked to hang up: the call ends once its farewell has been spoken. */
  const [ending, setEnding] = useState(false)
  const [farewell] = useState(() => new FarewellTracker())
  /** Whether the user has said anything this call; the suggestions show until then. */
  const [heard, setHeard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usageAnchor, setUsageAnchor] = useState<VoiceUsageAnchor | null>(null)
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

  const sendRealtimeEvent = realtime.sendEvent
  function append(delegationId: string | null, channel: "thinking" | "commentary", content: string) {
    return sendContext(sendRealtimeEvent, delegationId, channel, content)
  }

  function handleEvent(event: Experimental_RealtimeServerEvent) {
    if (event.type === "session-started") {
      setUsageAnchor(usageSnapshot(0))
      if (weekStart && today) {
        void append(null, "thinking", voicePageContext(weekStart, today))
      }
      return
    }
    if (event.type === "session-usage" || event.type === "session-closed") {
      if (event.usage) {
        setUsageAnchor(usageSnapshot(event.usage.seconds))
      }
      return
    }
    if (event.type === "transcript-fragment") {
      if (event.speaker === "user") {
        ledger.addFragment({ text: event.delta, startMs: event.startMs, endMs: event.endMs })
        setHeard(true)
        // Speaking again while the call is ending means the user is not done.
        if (farewell.phase !== "idle" && event.delta.trim().length > 1) keepTalking()
      } else {
        farewell.spoke(event.startMs, event.endMs)
      }
      return
    }
    if (event.type === "delegation-created") {
      void delegate(event.delegationId, event.offsetMs)
    }
  }

  /**
   * Takes the words of one delegation and decides when they run. With nothing running they
   * run now. Words spoken while a turn runs are read first: a progress check is answered
   * without stopping the work, a correction or "stop" cancels it (what it saved stays), and a
   * separate request waits its turn.
   */
  async function delegate(delegationId: string, offsetMs: number | undefined) {
    await waitForTranscript(offsetMs)
    const message = ledger.takeUtterance(offsetMs)
    const running = ledger.running()
    if (!running || !message || !accessToken) {
      ledger.enqueue(() => runDelegation(delegationId, message))
      return
    }
    let action: VoiceInterruption = "supersede"
    try {
      action = await classifyInterruption(accessToken, { running: running.message, utterance: message })
    } catch {
      // Without a reading, stopping is safer than finishing a request the user may have changed.
    }
    if (action === "progress" && ledger.running()?.delegationId === running.delegationId) {
      await append(
        delegationId,
        "commentary",
        "Việc người dùng nhờ trước đó vẫn đang chạy, chưa có kết quả."
      )
      return
    }
    if (action === "supersede") {
      const superseded = ledger.cancel()
      if (superseded) {
        void append(superseded, "thinking", "Việc này đã dừng vì người dùng sửa hoặc dừng yêu cầu; những gì đã lưu vẫn giữ.")
      }
    }
    ledger.enqueue(() => runDelegation(delegationId, message))
  }

  /**
   * Waits for the last words of the utterance: GPT-Live often delegates mid-sentence, so
   * this waits until `ledger.utteranceReady` (the transcript reached the delegation point
   * and the sentence ended or went quiet), at most `TRANSCRIPT_GRACE_MS`.
   */
  async function waitForTranscript(offsetMs: number | undefined) {
    const deadline = Date.now() + TRANSCRIPT_GRACE_MS
    while (Date.now() < deadline) {
      if (ledger.utteranceReady(offsetMs, Date.now())) return
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }

  /**
   * Reloads everything a voice turn can change. A turn cancelled mid-stream may have saved
   * changes whose tool results never reached the browser, so its effects are unknown.
   */
  function refreshAll() {
    refresh({
      focus: null,
      close: null,
      planChanged: true,
      logChanged: true,
      nutritionChanged: true,
      dietaryChanged: true,
      endCall: false,
    })
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

  async function runDelegation(delegationId: string, message: string) {
    if (!message) {
      await append(delegationId, "commentary", "Không nhận được lời người dùng cho yêu cầu này.")
      return
    }
    if (!accessToken || !weekStart) {
      await append(delegationId, "commentary", failureText(null))
      return
    }

    const controller = ledger.begin(delegationId, message)
    const seen = new Set<string>()
    let reply = ""
    let webSearch: VoiceWebSearchRequest | null = null
    let ended = false
    // The API saves the user message before it streams, so the thread exists once a reply starts.
    let saved = false
    let spokenProgress: ReturnType<typeof setTimeout> | undefined
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
          screen: getScreen() ?? undefined,
        },
        controller.signal
      )
      for await (const update of turn) {
        saved = true
        const fresh = finishedActions(update).filter((action) => !seen.has(action.toolCallId))
        for (const action of fresh) {
          seen.add(action.toolCallId)
          const effects = voiceEffects([action])
          if (effects.endCall) ended = true
          refresh(effects)
          if (touchesScreen(effects)) onEffects(effects)
          const line = progressLine(action)
          if (line) {
            void append(delegationId, "thinking", line)
            clearTimeout(spokenProgress)
            spokenProgress = setTimeout(() => {
              if (ledger.runningFor(delegationId) > PROGRESS_AFTER_MS) void append(delegationId, "commentary", line)
            }, PROGRESS_SPEAK_DELAY_MS)
          }
        }
        reply = replyText(update)
        webSearch = pendingWebSearch(update)
      }
      // The reply is next; a progress line after it would only repeat it.
      clearTimeout(spokenProgress)
      ledger.awaitWebSearchAnswer(webSearch)
      // Marked before the farewell is sent: GPT-Live can acknowledge it before `append` resolves.
      if (ended) farewell.sent()
      if (webSearch) {
        await append(
          delegationId,
          "commentary",
          `${reply ? `${reply} ` : ""}Cần tìm trên web: ${webSearch.reason}. Chưa tìm vì cần người dùng đồng ý.`
        )
      } else {
        await append(delegationId, "commentary", reply || "Đã xong.")
      }
      if (ended) setEnding(true)
    } catch (cause) {
      // A cancelled turn was superseded or the call ended; the next turn speaks. The API may
      // still have saved changes the stream never showed, so reload what it could touch. The
      // error a cancelled stream throws is not always an AbortError, so the signal decides.
      if (controller.signal.aborted || isAbort(cause)) refreshAll()
      else await append(delegationId, "commentary", failureText(cause))
    } finally {
      clearTimeout(spokenProgress)
      ledger.finish(delegationId)
      setPending((count) => count - 1)
      if (saved) onTurnEnd(threadId)
    }
  }

  const connectRealtime = realtime.connect
  const closeRealtime = realtime.close

  async function start() {
    setError(null)
    setEnding(false)
    farewell.reset()
    setHeard(false)
    setWasConnected(false)
    setUsageAnchor(null)
    await openVoiceCall({
      ledger,
      connect: connectRealtime,
      onError: setError,
    })
  }

  async function end() {
    ledger.endCall()
    try {
      await closeRealtime()
    } finally {
      setUsageAnchor(null)
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
    })
    return () => ledger.endCall()
  }, [ledger, connectRealtime])

  // The farewell is the reply of the turn that asked to hang up: hang up once it has played.
  const endRef = useRef(end)
  const playingRef = useRef(false)
  useEffect(() => {
    endRef.current = end
    playingRef.current = realtime.isPlaying
  })
  useEffect(() => {
    if (!ending) return
    const timer = setInterval(() => {
      if (farewell.done(playingRef.current)) void endRef.current()
    }, END_CHECK_MS)
    return () => clearInterval(timer)
  }, [ending, farewell])

  /** The user wants to keep talking: the call stays open. */
  function keepTalking() {
    farewell.reset()
    setEnding(false)
  }

  // A forgotten call ends on its own.
  const connected = realtime.status === "connected"
  // Adjusting state while rendering: React re-renders right away, before painting.
  if (connected && !wasConnected) setWasConnected(true)
  const lastSentRecipeKey = useRef<string | null>(null)
  useEffect(() => {
    if (!connected) {
      lastSentRecipeKey.current = null
      return
    }
    if (openRecipe) {
      const key = `${openRecipe.id}:${openRecipe.ingredients.length}:${openRecipe.steps.length}`
      if (lastSentRecipeKey.current === key) return
      lastSentRecipeKey.current = key
      void sendContext(sendRealtimeEvent, null, "thinking", voiceRecipeContext(openRecipe))
      return
    }
    if (lastSentRecipeKey.current !== null) {
      lastSentRecipeKey.current = null
      void sendContext(sendRealtimeEvent, null, "thinking", VOICE_RECIPE_CLOSED_CONTEXT)
    }
  }, [connected, openRecipe, sendRealtimeEvent])
  const usedSeconds = usageAnchor?.seconds ?? 0
  useEffect(() => {
    if (!connected) return
    const remainingMs = Math.max(0, (VOICE_MAX_SECONDS - usedSeconds) * 1000)
    if (remainingMs === 0) {
      void closeRealtime()
      return
    }
    const timer = setTimeout(() => void closeRealtime(), remainingMs)
    return () => clearTimeout(timer)
  }, [connected, usedSeconds, closeRealtime])

  // The microphone and any running turn belong to the call, so they stop when it ends on its own.
  const ended = (wasConnected && realtime.status === "disconnected") || realtime.status === "error"
  useEffect(() => {
    if (!ended) return
    ledger.endCall()
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
    usage: usageAnchor,
    inputLevel: ledger.readInputLevel,
    outputLevel: ledger.readOutputLevel,
    ending,
    keepTalking,
    start,
    end,
    toggleMute,
  }
}

export type MealPlannerVoice = ReturnType<typeof useMealPlannerVoice>
