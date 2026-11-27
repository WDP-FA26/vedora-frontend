"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import { useChat } from "@ai-sdk/react"
import { APICallError, DefaultChatTransport, isToolUIPart } from "ai"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import {
  deleteChatThread,
  fetchChatThread,
  fetchChatThreads,
  MEAL_PLANNER_CHAT_THREADS_KEY,
  MEAL_PLANNER_CHAT_URL,
  rewindChatThread,
} from "@/features/meal-plan/api/chat.api"
import { isMealPlanKey } from "@/features/meal-plan/api/meal-plan.api"
import {
  deserializeMessage,
  messageQuestions,
  messageText,
  messageWebSearchRequests,
  parseToolOutputPayload,
  WEB_SEARCH_APPROVED_TEXT,
  WEB_SEARCH_DECLINED_TEXT,
  webSearchAllowed,
  WELCOME_MESSAGE,
  type PlannerMessage,
  type PlannerToolOutputPayload,
} from "@/features/meal-plan/lib/chat-message-parsers"
import {
  applyPlannerState,
  invalidateAllPlannerState,
  plannerStateEventSchema,
} from "@/features/meal-plan/lib/planner-state-protocol"
import type { ChatRewind, ChatThreadSummary } from "@/features/meal-plan/schemas/chat.schema"
import { ApiError } from "@/features/shared/lib/api-client"

const THREAD_LIST_URL = `${MEAL_PLANNER_CHAT_THREADS_KEY}?limit=50`

const transport = new DefaultChatTransport<PlannerMessage>({
  api: MEAL_PLANNER_CHAT_URL,
  prepareSendMessagesRequest: ({ messages, headers, body }) => {
    const threadId = typeof body?.threadId === "string" ? body.threadId : undefined
    const toolOutput = parseToolOutputPayload(body?.toolOutput)
    let lastUser: PlannerMessage | undefined
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = messages[index]
      if (candidate.role === "user" && candidate.id !== WELCOME_MESSAGE.id) {
        lastUser = candidate
        break
      }
    }
    return {
      headers,
      body: {
        weekStart: body?.weekStart,
        ...(threadId ? { threadId } : {}),
        allowWebSearch: body?.allowWebSearch === true,
        ...(lastUser ? { requestId: lastUser.id } : {}),
        ...(toolOutput ? { toolOutput } : {}),
        message: lastUser ? messageText(lastUser) : "",
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

export function useMealPlannerChat(weekStart: string | undefined) {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const { accessToken } = useAuth()
  const [threadId, setThreadId] = useState<string>(() => crypto.randomUUID())
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null)
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null)
  const [rewindingId, setRewindingId] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const threads = useAuthedSWR(THREAD_LIST_URL, fetchChatThreads)
  const loadNonceRef = useRef(0)

  const latestRef = useRef({
    accessToken,
    threadId,
    messages: [WELCOME_MESSAGE] as PlannerMessage[],
  })

  const { messages, status, error, sendMessage, setMessages, stop, clearError, addToolOutput } =
    useChat<PlannerMessage>({
      transport,
      messages: [WELCOME_MESSAGE],
      onData: (part) => {
        if (part.type !== "data-state") return
        const parsed = plannerStateEventSchema.safeParse(part.data)
        if (parsed.success) applyPlannerState(mutate, parsed.data)
      },
      onFinish: () => {
        void threads.mutate()
      },
      onError: (err) => {
        if (APICallError.isInstance(err) && err.statusCode === 401) {
          router.refresh()
          return
        }
        invalidateAllPlannerState(mutate)
        void threads.mutate()
      },
    })

  useEffect(() => {
    latestRef.current = { accessToken, threadId, messages }
  }, [accessToken, threadId, messages])

  async function selectThread(id: string) {
    const token = latestRef.current.accessToken
    if (!token) return
    const nonce = ++loadNonceRef.current
    setHistoryError(null)
    setLoadingThreadId(id)
    void stop()
    clearError()
    try {
      const detail = await fetchChatThread(token, id)
      if (loadNonceRef.current !== nonce) return
      setThreadId(detail.id)
      setMessages([WELCOME_MESSAGE, ...detail.messages.map(deserializeMessage)])
    } catch (err) {
      if (loadNonceRef.current !== nonce) return
      if (err instanceof ApiError && err.status === 401) router.refresh()
      setHistoryError("Không tải được lịch sử đoạn chat.")
    } finally {
      if (loadNonceRef.current === nonce) setLoadingThreadId(null)
    }
  }

  function startNewThread() {
    loadNonceRef.current += 1
    void stop()
    clearError()
    setHistoryError(null)
    setLoadingThreadId(null)
    setMessages([WELCOME_MESSAGE])
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

  const busy = status === "submitted" || status === "streaming"

  function sendText(text: string, allowWebSearch: boolean, toolOutput?: PlannerToolOutputPayload) {
    if (!weekStart) return
    clearError()
    setHistoryError(null)
    void sendMessage(
      { text },
      {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: {
          threadId,
          weekStart,
          allowWebSearch,
          ...(toolOutput ? { toolOutput } : {}),
        },
      }
    )
  }

  async function answerWebSearch(toolCallId: string, approved: boolean) {
    if (busy || !weekStart) return
    const output = { approved }
    await addToolOutput({ tool: "requestWebSearch", toolCallId, output })
    sendText(approved ? WEB_SEARCH_APPROVED_TEXT : WEB_SEARCH_DECLINED_TEXT, approved, {
      tool: "requestWebSearch",
      toolCallId,
      output,
    })
  }

  async function answerQuestion(toolCallId: string, answer: string) {
    const text = answer.trim()
    if (busy || !weekStart || !text) return
    const output = { answer: text }
    await addToolOutput({ tool: "askUser", toolCallId, output })
    sendText(text, webSearchAllowed(latestRef.current.messages), {
      tool: "askUser",
      toolCallId,
      output,
    })
  }

  async function rewind(messageId: string): Promise<ChatRewind | null> {
    const token = latestRef.current.accessToken
    const current = latestRef.current.messages
    const index = current.findIndex((message) => message.id === messageId)
    if (!token || busy || index < 0) return null
    setHistoryError(null)
    setRewindingId(messageId)
    try {
      const result = await rewindChatThread(token, latestRef.current.threadId, messageId)
      setMessages(current.slice(0, index))
      void mutate(isMealPlanKey)
      void threads.mutate()
      return result
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.refresh()
        return null
      }
      if (err instanceof ApiError && err.status === 404) {
        setMessages(current.slice(0, index))
        return { text: messageText(current[index]), weeks: [] }
      }
      setHistoryError("Không quay lại được. Hãy thử lại.")
      return null
    } finally {
      setRewindingId(null)
    }
  }

  const webSearch = webSearchAllowed(messages)
  const lastMessage = messages.at(-1)
  const lastRequest = lastMessage?.role === "assistant" ? messageWebSearchRequests(lastMessage).at(-1) : undefined
  const openWebSearchRequest =
    !busy && lastRequest !== undefined && lastRequest.approved === undefined ? lastRequest : null
  const lastQuestion = lastMessage?.role === "assistant" ? messageQuestions(lastMessage).at(-1) : undefined
  const openQuestion = !busy && lastQuestion !== undefined && lastQuestion.answer === undefined ? lastQuestion : null
  const last = messages.at(-1)
  const runningTool =
    busy && last?.role === "assistant"
      ? last.parts.find((part) => isToolUIPart(part) && part.state !== "output-available")
      : undefined
  const replying =
    busy && last?.role === "assistant" && messageText(last) !== "" && runningTool === undefined

  const threadList: ChatThreadSummary[] = threads.data?.items ?? []
  const activeThread = threadList.find((item) => item.id === threadId) ?? null

  function sendTyped(text: string) {
    if (openQuestion) {
      void answerQuestion(openQuestion.toolCallId, text)
      return
    }
    sendText(text, webSearch)
  }

  return {
    weekStart,
    threadId,
    activeThread,
    threads: threadList,
    threadsLoading: threads.isLoading,
    loadingThreadId,
    deletingThreadId,
    historyError,
    messages,
    busy,
    waiting: busy && !replying,
    pendingId: busy && !replying && last?.role === "assistant" ? last.id : null,
    streamingId: replying ? last.id : null,
    error: error ? errorMessage(error) : null,
    send: sendTyped,
    stop: () => {
      void stop()
      invalidateAllPlannerState(mutate)
    },
    webSearchAllowed: webSearch,
    openWebSearchRequest,
    answerWebSearch: (toolCallId: string, approved: boolean) => void answerWebSearch(toolCallId, approved),
    openQuestion,
    answerQuestion: (toolCallId: string, answer: string) => void answerQuestion(toolCallId, answer),
    rewindingId,
    rewind,
    selectThread,
    startNewThread,
    removeThread,
    reset: startNewThread,
  }
}

export type MealPlannerChat = ReturnType<typeof useMealPlannerChat>
