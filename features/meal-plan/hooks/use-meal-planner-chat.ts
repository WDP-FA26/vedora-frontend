"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { APICallError, DefaultChatTransport, isToolUIPart, type UIMessage } from "ai"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import {
  DAY_LABELS,
  deleteChatThread,
  fetchChatThread,
  fetchChatThreads,
  MEAL_PLANNER_CHAT_THREADS_KEY,
  MEAL_PLANNER_CHAT_URL,
  proposalSchema,
  SECTION_LABELS,
  updateChatThread,
  type ChatMessageRecord,
  type ChatThreadSummary,
  type MealPlanProposal,
  type SyncChatMessageInput,
} from "@/features/meal-plan/meal-plan"

/** Mirror `MealPlannerChatDto` in vedora-api. */
const CONTEXT_MESSAGES = 10
const MAX_TEXT_LENGTH = 4000
const MAX_SYNC_MESSAGES = 100
const THREAD_LIST_URL = `${MEAL_PLANNER_CHAT_THREADS_KEY}?limit=50`

export type ProposalStatus = "staged" | "saved" | "dismissed"
type Statuses = Record<string, ProposalStatus>

export interface Proposal extends MealPlanProposal {
  id: string
  /** Set on a merged proposal: the ids of every proposal it was built from. */
  mergedIds?: string[]
}

export function proposalIds(proposal: Proposal): string[] {
  return proposal.mergedIds ?? [proposal.id]
}

/**
 * Cumulative draft tools (`fillSlots` and `editDraft`) always return the full
 * unsaved week against the saved plan, so the newest proposal replaces earlier
 * ones while tracking all contributing proposal ids for status updates.
 */
export function mergeProposals(open: Proposal[]): Proposal | null {
  const last = open.at(-1)
  if (!last) return null
  if (open.length === 1) return last

  const seen = new Set<string>()
  const mergedIds: string[] = []
  for (const proposal of open) {
    for (const id of proposalIds(proposal)) {
      if (seen.has(id)) continue
      seen.add(id)
      mergedIds.push(id)
    }
  }
  return { id: last.id, ok: true, days: last.days, mergedIds }
}

/** The planner's tools whose output is a proposal card. */
const PROPOSAL_TOOL_TYPES = [
  "tool-proposeMealPlan",
  "tool-generateMealPlan",
  "tool-fillSlots",
  "tool-editDraft",
]

/** vedora-api marks its fixed refusals with `{ refused: true }`. */
type PlannerMessage = UIMessage<{ refused?: boolean }>

const WELCOME: PlannerMessage = {
  id: "welcome",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Bạn muốn lên thực đơn hay tìm hiểu thêm về món chay? Mình có thể giúp bạn chọn món theo sở thích, thời gian nấu và các thành phần cần tránh.",
    },
  ],
}

export function messageText(message: UIMessage) {
  // the planner may speak before and after using a tool: keep those apart
  return message.parts
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join("\n\n")
}

/** The proposals the planner showed in this message; rejected ones never reach the user. */
export function messageProposals(message: UIMessage): Proposal[] {
  const proposals = message.parts.flatMap((part) => {
    if (!isToolUIPart(part) || !PROPOSAL_TOOL_TYPES.includes(part.type) || part.state !== "output-available") return []
    const proposal = proposalSchema.safeParse(part.output)
    return proposal.success && proposal.data.ok ? [{ ...proposal.data, id: part.toolCallId }] : []
  })
  const merged = mergeProposals(proposals)
  return merged ? [merged] : []
}

export function messageCannotPropose(message: UIMessage) {
  if (messageProposals(message).length > 0) return false
  return message.parts.some((part) => {
    if (!isToolUIPart(part) || !PROPOSAL_TOOL_TYPES.includes(part.type) || part.state !== "output-available") return false
    const proposal = proposalSchema.safeParse(part.output)
    return proposal.success && !proposal.data.ok
  })
}

// The API takes plain text turns, so a proposal rides along as a note the
// planner can read: what it offered and whether the user took it.
function contextText(message: UIMessage, statuses: Statuses) {
  const notes = messageProposals(message).map((proposal) => {
    const meals = proposal.days
      .map(({ day, sections }) => {
        const filled = sections
          .filter(({ recipes }) => recipes.length > 0)
          .map(
            ({ section, recipes }) =>
              `${SECTION_LABELS[section].toLowerCase()}: ${recipes.map(({ title, id }) => `${title} (id ${id})`).join(", ")}`
          )
        return `${DAY_LABELS[day]} (${filled.length > 0 ? filled.join("; ") : "trống"})`
      })
      .join(" | ")
    const status =
      statuses[proposal.id] === "saved"
        ? "người dùng đã lưu thực đơn"
        : statuses[proposal.id] === "staged"
          ? "người dùng đã đưa vào bản nháp, chưa lưu"
          : statuses[proposal.id] === "dismissed"
            ? "người dùng đã bỏ qua"
            : "chưa áp dụng"
    return `[Đề xuất (${status}): ${meals}]`
  })
  return [messageText(message), ...notes].filter(Boolean).join("\n").slice(0, MAX_TEXT_LENGTH)
}

// a refused request must not ride along as context for the next message
function withoutRefusals(messages: PlannerMessage[]) {
  return messages.filter(
    (message, index) => !message.metadata?.refused && !messages[index + 1]?.metadata?.refused
  )
}

function isUIMessagePart(part: Record<string, unknown>): part is PlannerMessage["parts"][number] {
  if (typeof part.type !== "string") return false
  if (part.type === "text" || part.type === "reasoning") return typeof part.text === "string"
  if (part.type === "step-start") return true
  if (part.type === "dynamic-tool") {
    return (
      typeof part.toolCallId === "string" &&
      typeof part.toolName === "string" &&
      typeof part.state === "string"
    )
  }
  if (part.type.startsWith("tool-")) {
    return typeof part.toolCallId === "string" && typeof part.state === "string"
  }
  if (part.type === "source-url") {
    return typeof part.sourceId === "string" && typeof part.url === "string"
  }
  if (part.type === "source-document") {
    return (
      typeof part.sourceId === "string" &&
      typeof part.mediaType === "string" &&
      typeof part.title === "string"
    )
  }
  return false
}

function serializeMessage(message: PlannerMessage): SyncChatMessageInput | null {
  if (message.id === WELCOME.id) return null
  if (message.role !== "user" && message.role !== "assistant") return null
  const text = messageText(message)
  const parts: Record<string, unknown>[] = []
  for (const part of message.parts) {
    parts.push({ ...part })
  }
  const hasContent = text.trim().length > 0 || parts.some((part) => typeof part.type === "string" && part.type !== "step-start" && (part.type !== "text" || (typeof part.text === "string" && part.text.trim().length > 0)))
  if (!hasContent) return null

  return {
    id: message.id,
    role: message.role,
    text,
    parts,
    ...(message.metadata?.refused !== undefined ? { metadata: { refused: message.metadata.refused } } : {}),
  }
}

function serializeMessages(messages: readonly PlannerMessage[]): SyncChatMessageInput[] {
  const result: SyncChatMessageInput[] = []
  for (const message of messages) {
    const serialized = serializeMessage(message)
    if (serialized) result.push(serialized)
  }
  return result.slice(-MAX_SYNC_MESSAGES)
}

function deserializeMessage(record: ChatMessageRecord): PlannerMessage {
  const parts = record.parts.filter(isUIMessagePart)
  const normalizedParts: PlannerMessage["parts"] =
    parts.length > 0
      ? parts
      : record.text
        ? [{ type: "text", text: record.text }]
        : []
  return {
    id: record.id,
    role: record.role,
    parts: normalizedParts,
    ...(record.metadata?.refused !== undefined ? { metadata: { refused: record.metadata.refused } } : {}),
  }
}

const transport = new DefaultChatTransport<PlannerMessage>({
  api: MEAL_PLANNER_CHAT_URL,
  prepareSendMessagesRequest: ({ messages, headers, body }) => {
    const statuses = (body?.statuses ?? {}) as Statuses
    const threadId = typeof body?.threadId === "string" ? body.threadId : undefined
    return {
      headers,
      body: {
        ...(threadId ? { threadId } : {}),
        requestId: messages.filter((message) => message.role === "user").at(-1)?.id,
        messages: withoutRefusals(messages.filter((message) => message.id !== WELCOME.id))
          .map((message) => ({ role: message.role, text: contextText(message, statuses) }))
          .filter((message) => message.text)
          .slice(-CONTEXT_MESSAGES),
      },
    }
  },
})

function errorMessage(error: Error) {
  if (APICallError.isInstance(error) && error.statusCode === 429) {
    if (error.responseBody?.includes("AI_QUOTA_EXCEEDED"))
      return "Bạn đã dùng hết lượt AI. Xem gói của bạn để biết thời gian đặt lại hoặc chọn gói mới."
    return "Bạn gửi hơi nhanh. Đợi một chút rồi nhắn tiếp nhé."
  }
  if (APICallError.isInstance(error) && error.statusCode === 503) {
    return "Trợ lý đang tạm nghỉ. Bạn quay lại sau nhé."
  }
  if (APICallError.isInstance(error) && error.statusCode === 409)
    return "Yêu cầu này đã được xử lý hoặc đang xử lý. Kiểm tra kết quả trước khi gửi yêu cầu mới."
  if (error.message === "RATE_LIMITED") {
    return "Trợ lý đang quá tải. Bạn thử lại sau ít phút nhé."
  }
  return "Mình chưa trả lời được. Thử lại nhé."
}

/** The conversation with vedora-api's `POST /meal-plan/chat` and persisted threads. */
export function useMealPlannerChat() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const [threadId, setThreadId] = useState<string>(() => crypto.randomUUID())
  const [statuses, setStatuses] = useState<Statuses>({})
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null)
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const threads = useAuthedSWR(THREAD_LIST_URL, fetchChatThreads)
  const restoredInitialRef = useRef(false)
  const manualActionRef = useRef(false)
  const loadNonceRef = useRef(0)

  const latestRef = useRef({
    accessToken,
    threadId,
    statuses,
    messages: [WELCOME] as PlannerMessage[],
  })

  async function syncThread(
    token: string | undefined,
    targetThreadId: string,
    messagesToSync: readonly PlannerMessage[],
    statusesToSync: Statuses
  ) {
    if (!token) return
    const payload = serializeMessages(messagesToSync)
    if (payload.length === 0) return
    try {
      await updateChatThread(token, targetThreadId, {
        messages: payload,
        proposalStatuses: statusesToSync,
      })
      void threads.mutate()
    } catch {
      // Server-side stream persistence already captured the turn; avoid breaking chat UI.
    }
  }

  const { messages, status, error, sendMessage, setMessages, stop, clearError } =
    useChat<PlannerMessage>({
      transport,
      messages: [WELCOME],
      onFinish: ({ messages: finishedMessages }) => {
        const { accessToken: token, threadId: activeId, statuses: currentStatuses } = latestRef.current
        void syncThread(token, activeId, finishedMessages, currentStatuses)
      },
      onError: (err) => {
        if (APICallError.isInstance(err) && err.statusCode === 401) {
          router.refresh()
          return
        }
        const {
          accessToken: token,
          threadId: activeId,
          messages: currentMessages,
          statuses: currentStatuses,
        } = latestRef.current
        void syncThread(token, activeId, currentMessages, currentStatuses)
      },
    })

  useEffect(() => {
    latestRef.current = { accessToken, threadId, statuses, messages }
  }, [accessToken, threadId, statuses, messages])

  async function selectThread(id: string) {
    const token = latestRef.current.accessToken
    if (!token) return
    manualActionRef.current = true
    const nonce = ++loadNonceRef.current
    setHistoryError(null)
    setLoadingThreadId(id)
    void stop()
    clearError()
    try {
      const detail = await fetchChatThread(token, id)
      if (loadNonceRef.current !== nonce) return
      setThreadId(detail.id)
      setStatuses(detail.proposalStatuses)
      setMessages([WELCOME, ...detail.messages.map(deserializeMessage)])
    } catch (err) {
      if (loadNonceRef.current !== nonce) return
      if (APICallError.isInstance(err) && err.statusCode === 401) router.refresh()
      setHistoryError("Không tải được lịch sử đoạn chat.")
    } finally {
      if (loadNonceRef.current === nonce) setLoadingThreadId(null)
    }
  }

  useEffect(() => {
    if (restoredInitialRef.current || manualActionRef.current) return
    const items = threads.data?.items
    if (!items) return
    restoredInitialRef.current = true
    if (items.length === 0) return
    const latestThread = items[0]
    if (!latestThread || latestRef.current.messages.length > 1) return

    const token = latestRef.current.accessToken
    if (!token) return
    const nonce = ++loadNonceRef.current
    setLoadingThreadId(latestThread.id)
    void fetchChatThread(token, latestThread.id)
      .then((detail) => {
        if (loadNonceRef.current !== nonce || manualActionRef.current) return
        setThreadId(detail.id)
        setStatuses(detail.proposalStatuses)
        setMessages([WELCOME, ...detail.messages.map(deserializeMessage)])
      })
      .catch(() => undefined)
      .finally(() => {
        if (loadNonceRef.current === nonce) setLoadingThreadId(null)
      })
  }, [threads.data, setMessages])

  function startNewThread() {
    manualActionRef.current = true
    loadNonceRef.current += 1
    void stop()
    clearError()
    setHistoryError(null)
    setLoadingThreadId(null)
    setStatuses({})
    setMessages([WELCOME])
    setThreadId(crypto.randomUUID())
  }

  async function removeThread(id: string) {
    const token = latestRef.current.accessToken
    if (!token) return
    setHistoryError(null)
    setDeletingThreadId(id)
    try {
      await deleteChatThread(token, id)
      await threads.mutate(
        (current) =>
          current
            ? {
                ...current,
                items: current.items.filter((item) => item.id !== id),
                meta: {
                  ...current.meta,
                  totalItems: Math.max(0, current.meta.totalItems - 1),
                },
              }
            : current,
        { revalidate: true }
      )
      if (latestRef.current.threadId === id) {
        startNewThread()
      }
    } catch {
      setHistoryError("Không xóa được đoạn chat. Hãy thử lại.")
    } finally {
      setDeletingThreadId(null)
    }
  }

  function updateProposalStatuses(updates: Statuses) {
    setStatuses((current) => ({ ...current, ...updates }))
    const { accessToken: token, threadId: activeId, messages: currentMessages } = latestRef.current
    if (!token || !currentMessages.some((message) => message.id !== WELCOME.id)) return
    void updateChatThread(token, activeId, { proposalStatuses: updates })
      .then(() => threads.mutate())
      .catch(() => undefined)
  }

  const busy = status === "submitted" || status === "streaming"
  const last = messages.at(-1)
  const runningTool =
    busy && last?.role === "assistant"
      ? last.parts.find((part) => isToolUIPart(part) && part.state !== "output-available")
      : undefined
  const replying =
    busy && last?.role === "assistant" && messageText(last) !== "" && runningTool === undefined

  const merged = mergeProposals(
    messages.flatMap(messageProposals).filter((proposal) => !statuses[proposal.id])
  )
  const pendingProposal = merged && merged.days.length > 0 ? merged : null
  const threadList: ChatThreadSummary[] = threads.data?.items ?? []
  const activeThread = threadList.find((item) => item.id === threadId) ?? null

  return {
    threadId,
    activeThread,
    threads: threadList,
    threadsLoading: threads.isLoading,
    loadingThreadId,
    deletingThreadId,
    historyError,
    messages,
    busy,
    /** Nothing readable is streaming yet: the planner is thinking or using a tool. */
    waiting: busy && !replying,
    /** The assistant message whose trace shows the waiting, once the reply has started. */
    pendingId: busy && !replying && last?.role === "assistant" ? last.id : null,
    streamingId: replying ? last.id : null,
    /** Every proposal not yet applied, saved or dismissed, merged into one. */
    pendingProposal,
    statuses,
    setProposalStatus: (id: string, next: ProposalStatus) => updateProposalStatuses({ [id]: next }),
    setProposalsStatus: (ids: string[], next: ProposalStatus) => {
      const updates: Statuses = {}
      for (const id of ids) updates[id] = next
      updateProposalStatuses(updates)
    },
    error: error ? errorMessage(error) : null,
    send: (text: string) => {
      manualActionRef.current = true
      clearError()
      setHistoryError(null)
      void sendMessage(
        { text },
        {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          body: { statuses, threadId },
        }
      )
    },
    selectThread,
    startNewThread,
    removeThread,
    reset: startNewThread,
  }
}

export type MealPlannerChat = ReturnType<typeof useMealPlannerChat>
