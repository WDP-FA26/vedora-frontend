import type { PlannerStateEvent } from "@/features/meal-plan/lib/planner-state-protocol"
import { plainSpokenText } from "@/features/meal-plan/voice/voice-session"
import {
  streamVoiceTurn,
  type VoiceScreen,
  type VoiceScreenCommand,
  type VoiceTurnEvent,
  type VoiceTurnRequest,
} from "@/features/meal-plan/voice/voice-stream"
import type { FarewellTracker, TurnQueue, VoiceCallLedger } from "@/features/meal-plan/voice/voice-call"
import { ApiError } from "@/features/shared/lib/api-client"

export function voiceTurnFailureText(error: unknown) {
  if (error instanceof ApiError && error.code === "AI_QUOTA_EXCEEDED") {
    return "Người dùng đã dùng hết lượt trợ lý AI hiện có, nên yêu cầu này chưa được thực hiện."
  }
  if (error instanceof ApiError && error.status === 429) {
    return "Người dùng gửi yêu cầu quá nhanh nên yêu cầu này chưa được thực hiện; đợi vài giây là thử lại được."
  }
  return "Yêu cầu này chưa xử lý xong vì hệ thống gặp lỗi; một phần có thể đã được lưu và đang hiện trên màn hình."
}

export const SUPERSEDED_NOTE =
  "This task was stopped because the user spoke again; anything already saved remains saved."

export function supersededNote(saved: readonly string[]) {
  if (saved.length === 0) return SUPERSEDED_NOTE
  return `This task was stopped because the user spoke again, but these changes were already saved before it stopped: ${saved.join(" ")} In your next reply, briefly tell the user what was already saved and ask whether to keep it or undo it.`
}
export const OUTDATED_RESULT_NOTE =
  "The user spoke again before this result was delivered, so it may no longer match what they want; their latest words are being handled as an updated request. Do not read this result out on its own:"

type Append = (delegationId: string, channel: "thinking" | "commentary", content: string) => Promise<void>

export type QueueTurn = (turn: { delegationId: string; message: string; revision: boolean }) => Promise<void>

type DelegationDeps = { ledger: VoiceCallLedger; append: Append; queueTurn: QueueTurn }

export async function handleDelegation(delegationId: string, { ledger, append, queueTurn }: DelegationDeps) {
  const seq = ledger.turns.claimDelegation()
  const running = ledger.turns.running()
  let carried = ""
  if (running) {
    ledger.turns.cancel()
    void append(running.delegationId, "thinking", supersededNote(running.saved))
    if (running.revision) carried = running.message
  }
  if (!carried && !(await ledger.utterances.waitForUtterance())) return
  if (!ledger.turns.isLatestDelegation(seq)) return
  const message = [carried, ledger.utterances.takeUtterance()].filter(Boolean).join(" ")
  ledger.turns.enqueue(() => queueTurn({ delegationId, message, revision: false }), seq)
}

export function reviseTurn(delegationId: string, { ledger, queueTurn }: Omit<DelegationDeps, "append">) {
  const seq = ledger.turns.claimDelegation()
  ledger.turns.enqueue(async () => {
    const message = ledger.utterances.takeUtterance()
    if (message) await queueTurn({ delegationId, message, revision: true })
  }, seq)
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

export type RunVoiceTurnOptions = {
  delegationId: string
  message: string
  revision?: boolean
  accessToken: string | null | undefined
  weekStart: string | undefined
  threadId: string
  screen: VoiceScreen | undefined
  turns: TurnQueue
  farewell: FarewellTracker
  append: Append
  hasNewSpeech: () => boolean
  onRevise: () => void
  onScreen: (screen: VoiceScreenCommand) => void
  onState: (state: PlannerStateEvent) => void
  onAbortInvalidate: () => void
  onPendingChange: (delta: 1 | -1) => void
  onEnding: () => void
  onTurnEnd: (threadId: string) => void
  streamTurn?: (token: string, request: VoiceTurnRequest, signal: AbortSignal) => AsyncGenerator<VoiceTurnEvent>
}

export async function runVoiceTurn({
  delegationId,
  message,
  revision = false,
  accessToken,
  weekStart,
  threadId,
  screen,
  turns,
  farewell,
  append,
  hasNewSpeech,
  onRevise,
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

  const controller = turns.begin(delegationId, message, revision)
  let reply = ""
  let summary: string | null = null
  let ended = false
  let saved = false
  let replied = false

  const deliverReply = () => {
    if (replied || controller.signal.aborted) return Promise.resolve()
    replied = true
    const spoken = plainSpokenText(reply) || summary || "Đã xong."
    if (hasNewSpeech()) {
      const noted = append(delegationId, "thinking", `${OUTDATED_RESULT_NOTE} ${spoken}`)
      onRevise()
      return noted
    }
    if (ended) farewell.sent()
    const sent = append(delegationId, "commentary", spoken)
    if (ended) onEnding()
    return sent
  }

  onPendingChange(1)
  try {
    const turn = streamTurn(
      accessToken,
      { weekStart, message, threadId, requestId: revision ? `${delegationId}:${crypto.randomUUID()}` : delegationId, screen },
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
        turns.recordSaved(delegationId, event.text)
        void append(delegationId, "thinking", event.text)
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
    if (controller.signal.aborted || isAbort(cause)) onAbortInvalidate()
    else await append(delegationId, "commentary", voiceTurnFailureText(cause))
  } finally {
    turns.finish(delegationId)
    onPendingChange(-1)
    if (saved) onTurnEnd(threadId)
  }
}
