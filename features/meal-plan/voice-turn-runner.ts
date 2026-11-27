import type { PlannerStateEvent } from "@/features/meal-plan/planner-state-protocol"
import {
  streamVoiceTurn,
  type VoiceScreen,
  type VoiceScreenCommand,
  type VoiceTurnEvent,
  type VoiceTurnRequest,
} from "@/features/meal-plan/voice"
import type { FarewellTracker, TurnQueue } from "@/features/meal-plan/voice-call"
import { ApiError } from "@/features/shared/lib/api-client"

/** Saved changes are said aloud only once a turn has run this long; quick turns just answer. */
export const PROGRESS_AFTER_MS = 6000
/**
 * A saved change is said aloud only when the reply has not followed it within this long, so
 * GPT-Live does not say the change and then the reply that repeats it.
 */
export const PROGRESS_SPEAK_DELAY_MS = 2000

export function voiceTurnFailureText(error: unknown) {
  if (error instanceof ApiError && error.code === "AI_QUOTA_EXCEEDED") {
    return "Người dùng đã dùng hết lượt trợ lý AI hiện có, nên yêu cầu này chưa được thực hiện."
  }
  if (error instanceof ApiError && error.status === 429) {
    return "Người dùng gửi yêu cầu quá nhanh nên yêu cầu này chưa được thực hiện; đợi vài giây là thử lại được."
  }
  return "Yêu cầu này chưa xử lý xong vì hệ thống gặp lỗi; một phần có thể đã được lưu và đang hiện trên màn hình."
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

export type RunVoiceTurnOptions = {
  delegationId: string
  message: string
  accessToken: string | null | undefined
  weekStart: string | undefined
  threadId: string
  screen: VoiceScreen | undefined
  turns: TurnQueue
  farewell: FarewellTracker
  append: (delegationId: string, channel: "thinking" | "commentary", content: string) => Promise<void>
  onScreen: (screen: VoiceScreenCommand) => void
  onState: (state: PlannerStateEvent) => void
  onAbortInvalidate: () => void
  onPendingChange: (delta: 1 | -1) => void
  onEnding: () => void
  onTurnEnd: (threadId: string) => void
  streamTurn?: (token: string, request: VoiceTurnRequest, signal: AbortSignal) => AsyncGenerator<VoiceTurnEvent>
}

/**
 * Executes a single delegated voice turn: streams `POST /meal-plan/voice/turns`,
 * mirrors `data-state` and `data-screen` live, relays progress to GPT-Live, and
 * delivers the final spoken reply as soon as `ready` arrives.
 */
export async function runVoiceTurn({
  delegationId,
  message,
  accessToken,
  weekStart,
  threadId,
  screen,
  turns,
  farewell,
  append,
  onScreen,
  onState,
  onAbortInvalidate,
  onPendingChange,
  onEnding,
  onTurnEnd,
  streamTurn = streamVoiceTurn,
}: RunVoiceTurnOptions) {
  if (!message) {
    await append(delegationId, "commentary", "Không nhận được lời người dùng cho yêu cầu này.")
    return
  }
  if (!accessToken || !weekStart) {
    await append(delegationId, "commentary", voiceTurnFailureText(null))
    return
  }

  const controller = turns.begin(delegationId, message)
  let reply = ""
  let summary: string | null = null
  let ended = false
  let saved = false
  let replied = false
  let spokenProgress: ReturnType<typeof setTimeout> | undefined

  const deliverReply = () => {
    if (replied) return Promise.resolve()
    replied = true
    clearTimeout(spokenProgress)
    // Marked before the farewell is sent: GPT-Live can acknowledge it before `append` resolves.
    if (ended) farewell.sent()
    const spoken = reply.trim() || summary || "Đã xong."
    const sent = append(delegationId, "commentary", spoken)
    if (ended) onEnding()
    return sent
  }

  onPendingChange(1)
  try {
    const turn = streamTurn(
      accessToken,
      { weekStart, message, threadId, requestId: delegationId, screen },
      controller.signal
    )
    for await (const event of turn) {
      saved = true
      if (event.type === "state") {
        onState(event.state)
        continue
      }
      if (event.type === "screen") {
        onScreen(event.screen)
        continue
      }
      if (event.type === "progress") {
        void append(delegationId, "thinking", event.text)
        clearTimeout(spokenProgress)
        spokenProgress = setTimeout(() => {
          if (turns.runningFor(delegationId) > PROGRESS_AFTER_MS) {
            void append(delegationId, "commentary", event.text)
          }
        }, PROGRESS_SPEAK_DELAY_MS)
        continue
      }
      if (event.type === "summary") {
        summary = event.text
        continue
      }
      if (event.type === "end-call") {
        ended = true
        continue
      }
      if (event.type === "text") {
        reply += event.delta
        continue
      }
      if (event.type === "ready") {
        void deliverReply()
      }
    }
    if (!replied) {
      await deliverReply()
    }
  } catch (cause) {
    // A cancelled turn was superseded or the call ended; the next turn speaks. The API may
    // still have saved changes the stream never showed, so reload what it could touch.
    if (controller.signal.aborted || isAbort(cause)) onAbortInvalidate()
    else await append(delegationId, "commentary", voiceTurnFailureText(cause))
  } finally {
    clearTimeout(spokenProgress)
    turns.finish(delegationId)
    onPendingChange(-1)
    if (saved) onTurnEnd(threadId)
  }
}
