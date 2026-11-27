"use client"

import { useEffect, useRef, useState } from "react"
import { experimental_useRealtime } from "@ai-sdk/react"
import { gateway, type Experimental_RealtimeServerEvent } from "ai"
import { useSWRConfig } from "swr"

import type { VoiceOrbState } from "@/components/ui/voice-orb"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  appendableText,
  VOICE_MAX_SECONDS,
  VOICE_MODEL_ID,
  VOICE_RECIPE_CLOSED_CONTEXT,
  voiceErrorText,
  voicePageContext,
  voiceRecipeContext,
  voiceSessionConfig,
  voiceSessionRoute,
  type VoiceOpenRecipe,
  type VoiceScreen,
  type VoiceScreenCommand,
} from "@/features/meal-plan/voice"
import { FarewellTracker, VoiceCallLedger } from "@/features/meal-plan/voice-call"
import {
  loadVoiceMicSettings,
  saveVoiceMicSettings,
  VoiceAudioCapture,
  type VoiceAiDenoiseStatus,
  type VoiceMicSettings,
} from "@/features/meal-plan/voice-capture"
import {
  applyPlannerState,
  invalidateAllPlannerState,
} from "@/features/meal-plan/planner-state-protocol"
import { runVoiceTurn } from "@/features/meal-plan/voice-turn-runner"

/** Created once: a new model object would replace the hook's session. */
const model = gateway.experimental_realtime(VOICE_MODEL_ID)

/** The longest wait for the last words of an utterance after GPT-Live delegates. */
const TRANSCRIPT_GRACE_MS = 3000
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

function syncBrowserMicDsp(stream: MediaStream | null, aiDenoiseActive: boolean) {
  const track = stream?.getAudioTracks()[0]
  if (!track || typeof track.applyConstraints !== "function") return
  // Disable browser NS & AGC while DeepFilterNet3 handles denoising + postGain;
  // re-enable them when AI denoise is off or falls back.
  void track
    .applyConstraints({
      noiseSuppression: !aiDenoiseActive,
      autoGainControl: !aiDenoiseActive,
    })
    .catch(() => {
      // Ignore browsers that reject dynamic constraint updates on an active track.
    })
}

async function openVoiceCall({
  ledger,
  capture,
  connect,
  sendEvent,
  isMuted,
  aiDenoise,
  aiDenoisePauseGate,
  onAiDenoiseStatus,
  onError,
}: {
  ledger: VoiceCallLedger
  capture: VoiceAudioCapture
  connect: (options: { stream?: MediaStream; capture?: boolean }) => Promise<void>
  sendEvent: SendRealtimeEvent
  isMuted: () => boolean
  aiDenoise: boolean
  aiDenoisePauseGate: boolean
  onAiDenoiseStatus: (status: VoiceAiDenoiseStatus) => void
  onError: (message: string) => void
}) {
  capture.stop()
  ledger.reset()
  const generation = ledger.mic.begin()

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        // Avoid amplifying or double-processing noise before DeepFilterNet3 (which provides postGain).
        noiseSuppression: !aiDenoise,
        autoGainControl: !aiDenoise,
      },
    })
  } catch {
    if (ledger.mic.isCurrent(generation)) {
      onError("Trình duyệt chưa cho phép dùng micro. Hãy bật quyền micro cho trang này rồi thử lại.")
    }
    return
  }
  if (!ledger.mic.isCurrent(generation)) {
    for (const track of stream.getTracks()) track.stop()
    return
  }
  ledger.mic.attach(stream)
  await connect({ capture: false })
  if (!ledger.mic.isCurrent(generation)) return
  capture.start(stream, {
    onAudio: async (audio) => {
      try {
        await sendEvent({ type: "input-audio-append", audio })
      } catch {
        // Session closed or closing; transport errors are reported via `onError`.
      }
    },
    onLevel: (level) => ledger.mic.setInputLevel(level),
    isMuted,
    aiDenoise,
    aiDenoisePauseGate,
    onAiDenoiseStatus,
  })
}

type VoiceOptions = {
  /** The week on screen, the planner's default week. */
  weekStart?: string
  today?: string
  /** The chat thread on screen: voice turns are saved into it, so the chat shows them. */
  threadId: string
  /** Called as each `data-screen` command arrives, to open, close, or scroll the planner UI. */
  onScreen: (screen: VoiceScreenCommand) => void
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
 * each `data-screen` / `data-refresh` event as it arrives, and hands the result
 * back to be spoken.
 */
export function useMealPlannerVoice({
  weekStart,
  today,
  threadId,
  onScreen,
  onTurnEnd,
  onClose,
  getScreen,
  openRecipe,
}: VoiceOptions) {
  const { accessToken, user } = useAuth()
  const { mutate } = useSWRConfig()
  // Built once per mount: a new object would replace the session.
  const [sessionConfig] = useState(() => voiceSessionConfig(user?.fullName))
  const [sessionApi] = useState(() => ({ token: voiceSessionRoute(threadId) }))
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
  const [capture] = useState(() => new VoiceAudioCapture())
  const [micSettings, setMicSettings] = useState<VoiceMicSettings>(loadVoiceMicSettings)
  const [aiDenoiseStatus, setAiDenoiseStatus] = useState<VoiceAiDenoiseStatus>("off")
  const micSettingsRef = useRef(micSettings)

  useEffect(() => {
    micSettingsRef.current = micSettings
    capture.configureGate(micSettings)
  }, [capture, micSettings])

  function handleAiDenoiseStatus(status: VoiceAiDenoiseStatus) {
    setAiDenoiseStatus(status)
    if (status === "overloaded" || status === "error") {
      // Restore browser NS + AGC when DeepFilterNet3 falls back so mic is never left raw.
      syncBrowserMicDsp(ledger.mic.currentStream(), false)
    }
  }

  function restartCapture(settings: VoiceMicSettings) {
    const stream = ledger.mic.currentStream()
    if (!stream) return
    syncBrowserMicDsp(stream, settings.aiDenoise)
    capture.start(stream, {
      onAudio: async (audio) => {
        try {
          await sendRealtimeEvent({ type: "input-audio-append", audio })
        } catch {
          // Session closed or closing; transport errors are reported via `onError`.
        }
      },
      onLevel: (level) => ledger.mic.setInputLevel(level),
      isMuted: () => mutedRef.current,
      aiDenoise: settings.aiDenoise,
      aiDenoisePauseGate: settings.autoSensitivity,
      onAiDenoiseStatus: handleAiDenoiseStatus,
    })
  }

  function updateMicSettings(patch: Partial<VoiceMicSettings>) {
    const prev = micSettingsRef.current
    const next: VoiceMicSettings = { ...prev, ...patch }
    const needsCaptureRestart =
      next.aiDenoise !== prev.aiDenoise ||
      (next.aiDenoise && next.autoSensitivity !== prev.autoSensitivity)
    micSettingsRef.current = next
    saveVoiceMicSettings(next)
    setMicSettings(next)
    if (needsCaptureRestart) {
      restartCapture(next)
    }
  }

  function readMicMeter() {
    return capture.readMeter()
  }

  const realtime = experimental_useRealtime({
    model,
    api: sessionApi,
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
  const mutedRef = useRef(false)
  useEffect(() => {
    mutedRef.current = realtime.session?.isInputMuted ?? false
  })

  function append(delegationId: string | null, channel: "thinking" | "commentary", content: string) {
    return sendContext(sendRealtimeEvent, delegationId, channel, content)
  }

  function invalidateAll() {
    invalidateAllPlannerState(mutate)
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
        ledger.utterances.addFragment({ text: event.delta, startMs: event.startMs, endMs: event.endMs })
        setHeard(true)
        // Speaking something substantive while the call is ending means the user is not done.
        if (farewell.shouldCancel(event.delta)) keepTalking()
      } else {
        farewell.spoke(event.startMs, event.endMs)
      }
      return
    }
    if (event.type === "delegation-created") {
      if (farewell.phase !== "idle") keepTalking()
      void delegate(event.delegationId, event.offsetMs)
    }
  }

  async function delegate(delegationId: string, offsetMs: number | undefined) {
    if (!(await ledger.utterances.waitForUtterance(offsetMs, TRANSCRIPT_GRACE_MS))) return
    const message = ledger.utterances.takeUtterance(offsetMs)
    if (ledger.turns.running() && message) {
      const superseded = ledger.turns.cancel()
      if (superseded) {
        void append(
          superseded,
          "thinking",
          "This task was stopped because the user spoke again; anything already saved remains saved."
        )
      }
    }
    ledger.turns.enqueue(() =>
      runVoiceTurn({
        delegationId,
        message,
        accessToken,
        weekStart,
        threadId,
        screen: getScreen() ?? undefined,
        turns: ledger.turns,
        farewell,
        append,
        onScreen,
        onState: (state) => applyPlannerState(mutate, state),
        onAbortInvalidate: invalidateAll,
        onPendingChange: (delta) => setPending((count) => count + delta),
        onEnding: () => setEnding(true),
        onTurnEnd,
      })
    )
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
      capture,
      connect: connectRealtime,
      sendEvent: sendRealtimeEvent,
      isMuted: () => mutedRef.current,
      aiDenoise: micSettingsRef.current.aiDenoise,
      aiDenoisePauseGate: micSettingsRef.current.autoSensitivity,
      onAiDenoiseStatus: handleAiDenoiseStatus,
      onError: setError,
    })
  }

  async function end() {
    capture.stop()
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
      capture,
      connect: connectRealtime,
      sendEvent: sendRealtimeEvent,
      isMuted: () => mutedRef.current,
      aiDenoise: micSettingsRef.current.aiDenoise,
      aiDenoisePauseGate: micSettingsRef.current.autoSensitivity,
      onAiDenoiseStatus: (status) => {
        setAiDenoiseStatus(status)
        if (status === "overloaded" || status === "error") {
          syncBrowserMicDsp(ledger.mic.currentStream(), false)
        }
      },
      onError: setError,
    })
    return () => {
      capture.stop()
      ledger.endCall()
    }
  }, [ledger, capture, connectRealtime, sendRealtimeEvent])

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
  const lastWeekContextRef = useRef<string | null>(null)
  useEffect(() => {
    if (!connected || !weekStart || !today) {
      lastWeekContextRef.current = null
      return
    }
    const key = `${weekStart}:${today}`
    if (lastWeekContextRef.current === key) return
    lastWeekContextRef.current = key
    void sendContext(sendRealtimeEvent, null, "thinking", voicePageContext(weekStart, today))
  }, [connected, weekStart, today, sendRealtimeEvent])

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
    capture.stop()
    ledger.endCall()
  }, [ended, capture, ledger])

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
    ledger.mic.setMonitoring(monitoring)
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
    micSettings,
    aiDenoiseStatus,
    updateMicSettings,
    readMicMeter,
    ending,
    keepTalking,
    start,
    end,
    toggleMute,
  }
}

export type MealPlannerVoice = ReturnType<typeof useMealPlannerVoice>
