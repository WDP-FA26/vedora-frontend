"use client"

import { useEffect, useRef, useState } from "react"
import { experimental_useRealtime } from "@ai-sdk/react"
import { gateway, type Experimental_RealtimeServerEvent } from "ai"
import { useSWRConfig } from "swr"

import type { VoiceOrbState } from "@/components/ui/voice-orb"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  applyPlannerState,
  invalidateAllPlannerState,
} from "@/features/meal-plan/lib/planner-state-protocol"
import { FarewellTracker, VoiceCallLedger } from "@/features/meal-plan/voice/voice-call"
import {
  loadVoiceMicSettings,
  saveVoiceMicSettings,
  VoiceAudioCapture,
  type VoiceAiDenoiseStatus,
  type VoiceMicSettings,
} from "@/features/meal-plan/voice/voice-capture"
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
} from "@/features/meal-plan/voice/voice-session"
import type { VoiceScreen, VoiceScreenCommand } from "@/features/meal-plan/voice/voice-stream"
import { handleDelegation, reviseTurn, runVoiceTurn } from "@/features/meal-plan/voice/voice-turn-runner"

const model = gateway.experimental_realtime(VOICE_MODEL_ID)

const SPEAKING_HOLD_MS = 250
const END_CHECK_MS = 200
const MAX_PLAYBACK_BUFFER_SECONDS = 60

export type VoiceUsageAnchor = { seconds: number; at: number }

function usageSnapshot(seconds: number): VoiceUsageAnchor {
  return { seconds, at: Date.now() }
}

function useHeldTrue(value: boolean, holdMs: number) {
  const [held, setHeld] = useState(value)
  if (value && !held) setHeld(true)
  useEffect(() => {
    if (value || !held) return
    const timer = setTimeout(() => setHeld(false), holdMs)
    return () => clearTimeout(timer)
  }, [value, held, holdMs])
  return value || held
}

type SendRealtimeEvent = ReturnType<typeof experimental_useRealtime>["sendEvent"]

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
  void track
    .applyConstraints({
      noiseSuppression: !aiDenoiseActive,
      autoGainControl: !aiDenoiseActive,
    })
    .catch(() => {
    })
}

async function openVoiceCall({
  ledger,
  capture,
  connect,
  sendEvent,
  isMuted,
  aiDenoise,
  onAiDenoiseStatus,
  onError,
}: {
  ledger: VoiceCallLedger
  capture: VoiceAudioCapture
  connect: (options: { stream?: MediaStream; capture?: boolean }) => Promise<void>
  sendEvent: SendRealtimeEvent
  isMuted: () => boolean
  aiDenoise: boolean
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
      }
    },
    onLevel: (level) => ledger.mic.setInputLevel(level),
    isMuted,
    aiDenoise,
    onAiDenoiseStatus,
  })
}

type VoiceOptions = {
  weekStart?: string
  today?: string
  threadId: string
  onScreen: (screen: VoiceScreenCommand) => void
  onTurnEnd: (threadId: string) => void
  onClose: () => void
  getScreen: () => VoiceScreen | null
  openRecipe?: VoiceOpenRecipe | null
}

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
  const [sessionConfig] = useState(() => voiceSessionConfig(user?.fullName))
  const [sessionApi] = useState(() => ({ token: voiceSessionRoute(threadId) }))
  const [pending, setPending] = useState(0)
  const [ending, setEnding] = useState(false)
  const [farewell] = useState(() => new FarewellTracker())
  const [heard, setHeard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usageAnchor, setUsageAnchor] = useState<VoiceUsageAnchor | null>(null)
  const [wasConnected, setWasConnected] = useState(false)
  const [ledger] = useState(() => new VoiceCallLedger())
  const [capture] = useState(() => new VoiceAudioCapture())
  const [micSettings, setMicSettings] = useState<VoiceMicSettings>(loadVoiceMicSettings)
  const [aiDenoiseStatus, setAiDenoiseStatus] = useState<VoiceAiDenoiseStatus>("off")
  const micSettingsRef = useRef(micSettings)

  useEffect(() => {
    micSettingsRef.current = micSettings
  }, [micSettings])

  function handleAiDenoiseStatus(status: VoiceAiDenoiseStatus) {
    setAiDenoiseStatus(status)
    if (status === "overloaded" || status === "error") {
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
        }
      },
      onLevel: (level) => ledger.mic.setInputLevel(level),
      isMuted: () => mutedRef.current,
      aiDenoise: settings.aiDenoise,
      onAiDenoiseStatus: handleAiDenoiseStatus,
    })
  }

  function updateMicSettings(patch: Partial<VoiceMicSettings>) {
    const prev = micSettingsRef.current
    const next: VoiceMicSettings = { ...prev, ...patch }
    const needsCaptureRestart = next.aiDenoise !== prev.aiDenoise
    micSettingsRef.current = next
    saveVoiceMicSettings(next)
    setMicSettings(next)
    if (needsCaptureRestart) {
      restartCapture(next)
    }
  }

  function readMicLevelDb() {
    return capture.readLevelDb()
  }

  const realtime = experimental_useRealtime({
    model,
    api: sessionApi,
    sessionConfig,
    maxEvents: 1,
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
        if (farewell.shouldCancel(event.delta)) keepTalking()
      } else {
        farewell.spoke(event.startMs, event.endMs)
      }
      return
    }
    if (event.type === "delegation-created") {
      if (farewell.phase !== "idle") keepTalking()
      void handleDelegation(event.delegationId, { ledger, append, queueTurn })
    }
  }

  function queueTurn({ delegationId, message, revision }: { delegationId: string; message: string; revision: boolean }) {
    return runVoiceTurn({
      delegationId,
      message,
      revision,
      accessToken,
      weekStart,
      threadId,
      screen: getScreen() ?? undefined,
      turns: ledger.turns,
      farewell,
      append,
      hasNewSpeech: () => ledger.utterances.hasUtterance(),
      onRevise: () => reviseTurn(delegationId, { ledger, queueTurn }),
      onScreen,
      onState: (state) => applyPlannerState(mutate, state),
      onAbortInvalidate: invalidateAll,
      onPendingChange: (delta) => setPending((count) => count + delta),
      onEnding: () => setEnding(true),
      onTurnEnd,
    })
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

  function keepTalking() {
    farewell.reset()
    setEnding(false)
  }

  const connected = realtime.status === "connected"
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
    readMicLevelDb,
    ending,
    keepTalking,
    start,
    end,
    toggleMute,
  }
}

export type MealPlannerVoice = ReturnType<typeof useMealPlannerVoice>
