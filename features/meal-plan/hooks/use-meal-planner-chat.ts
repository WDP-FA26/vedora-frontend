"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import { useChat } from "@ai-sdk/react"
import { APICallError, DefaultChatTransport, isToolUIPart, type UIMessage } from "ai"
import { z } from "zod"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import {
  deleteChatThread,
  fetchChatThread,
  fetchChatThreads,
  isMealPlanKey,
  MEAL_PLANNER_CHAT_THREADS_KEY,
  MEAL_PLANNER_CHAT_URL,
  planChangeSchema,
  rewindChatThread,
  type ChatMessageRecord,
  type ChatRewind,
  type ChatThreadSummary,
  type PlanChange,
} from "@/features/meal-plan/meal-plan"
import {
  applyPlannerState,
  invalidateAllPlannerState,
  plannerStateEventSchema,
} from "@/features/meal-plan/planner-state-protocol"
import { ApiError } from "@/features/shared/lib/api-client"

const THREAD_LIST_URL = `${MEAL_PLANNER_CHAT_THREADS_KEY}?limit=50`

const PLAN_CHANGE_TOOL_TYPES = [
  "tool-fillSlots",
  "tool-autoBalancePlan",
  "tool-editPlan",
  "tool-verifyMealPlanAllergies",
]

export interface PlanChangeEntry extends PlanChange {
  id: string
}

function sameIds(left: readonly { id: string }[], right: readonly { id: string }[]) {
  return left.length === right.length && left.every(({ id }, index) => id === right[index].id)
}

function mergeChange(earlier: PlanChangeEntry, later: PlanChange): PlanChangeEntry {
  const days = [...earlier.days]
  for (const laterDay of later.days) {
    const index = days.findIndex(({ day }) => day === laterDay.day)
    if (index < 0) {
      days.push(laterDay)
      continue
    }
    const before = days[index]
    const sections = laterDay.sections.map((section) => {
      const old = before.sections.find((item) => item.section === section.section)
      return { ...section, previous: old?.previous ?? section.previous }
    })
    days[index] = { ...laterDay, sections }
  }
  const leftOut = earlier.problems.filter(({ code }) => code !== "DAY_CONFLICT")
  return { ...earlier, days, problems: [...leftOut, ...later.problems] }
}

export function messagePlanChanges(message: UIMessage): PlanChangeEntry[] {
  const byWeek = new Map<string, PlanChangeEntry>()
  for (const part of message.parts) {
    if (!isToolUIPart(part) || !PLAN_CHANGE_TOOL_TYPES.includes(part.type)) continue
    if (part.state !== "output-available") continue
    const change = planChangeSchema.safeParse(part.output)
    if (!change.success || !change.data.applied) continue
    const earlier = byWeek.get(change.data.weekStart)
    if (earlier) byWeek.set(change.data.weekStart, mergeChange(earlier, change.data))
    else byWeek.set(change.data.weekStart, { ...change.data, id: part.toolCallId })
  }
  const changes: PlanChangeEntry[] = []
  for (const change of byWeek.values()) {
    const days = change.days.filter(({ sections }) =>
      sections.some(({ recipes, previous }) => !sameIds(recipes, previous))
    )
    if (days.length > 0) changes.push({ ...change, days })
  }
  return changes
}

const ASK_USER_TYPE = "tool-askUser"
const askUserInputSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(1),
  multiple: z.boolean().optional(),
})
const askUserOutputSchema = z.object({ answer: z.string() })

export interface UserQuestion {
  toolCallId: string
  question: string
  options: string[]
  multiple: boolean
  answer: string | undefined
}

export function messageQuestions(message: UIMessage): UserQuestion[] {
  const questions: UserQuestion[] = []
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.type !== ASK_USER_TYPE) continue
    const input = askUserInputSchema.safeParse(part.input)
    if (!input.success) continue
    const output = part.state === "output-available" ? askUserOutputSchema.safeParse(part.output) : undefined
    questions.push({
      toolCallId: part.toolCallId,
      question: input.data.question,
      options: input.data.options,
      multiple: input.data.multiple === true,
      answer: output?.success ? output.data.answer : undefined,
    })
  }
  return questions
}

const WEB_SEARCH_REQUEST_TYPE = "tool-requestWebSearch"
const webSearchInputSchema = z.object({ reason: z.string() })
const webSearchDecisionSchema = z.object({ approved: z.boolean() })

const RESTAURANT_DISHES_TOOL_TYPE = "tool-searchRestaurantDishes"
const plannerRestaurantDishSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().nullable().default(null),
  priceVnd: z.number().nullable().default(null),
  description: z.string().nullable().default(null),
  imageUrl: z.string().nullable().default(null),
  restaurant: z.object({
    pageUserId: z.string(),
    username: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable().default(null),
    address: z.string(),
    averageRating: z.number().nullable().default(null),
    reviewCount: z.number().default(0),
  }),
  avoidedMatches: z.array(z.string()).default([]),
})
const plannerRestaurantDishListSchema = z.array(plannerRestaurantDishSchema)

export type PlannerRestaurantDish = z.infer<typeof plannerRestaurantDishSchema>

export function messageRestaurantDishes(message: UIMessage): PlannerRestaurantDish[] {
  const seen = new Set<string>()
  const dishes: PlannerRestaurantDish[] = []
  for (const part of message.parts) {
    if (
      !isToolUIPart(part) ||
      part.type !== RESTAURANT_DISHES_TOOL_TYPE ||
      part.state !== "output-available"
    ) {
      continue
    }
    const parsed = plannerRestaurantDishListSchema.safeParse(part.output)
    if (!parsed.success) continue
    for (const dish of parsed.data) {
      if (seen.has(dish.id)) continue
      seen.add(dish.id)
      dishes.push(dish)
    }
  }
  return dishes
}

export interface WebSearchRequest {
  toolCallId: string
  reason: string
  approved: boolean | undefined
}

export function messageWebSearchRequests(message: UIMessage): WebSearchRequest[] {
  const requests: WebSearchRequest[] = []
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.type !== WEB_SEARCH_REQUEST_TYPE) continue
    const input = webSearchInputSchema.safeParse(part.input)
    if (!input.success) continue
    const decision = part.state === "output-available" ? webSearchDecisionSchema.safeParse(part.output) : undefined
    requests.push({
      toolCallId: part.toolCallId,
      reason: input.data.reason,
      approved: decision?.success ? decision.data.approved : undefined,
    })
  }
  return requests
}

export function webSearchAllowed(messages: readonly UIMessage[]): boolean {
  let allowed = true
  for (const message of messages) {
    for (const { approved } of messageWebSearchRequests(message)) {
      if (approved !== undefined) allowed = approved
    }
  }
  return allowed
}

const WEB_SEARCH_APPROVED_TEXT = "Đồng ý, bạn cứ tìm trên web."
const WEB_SEARCH_DECLINED_TEXT = "Không cần tìm trên web."

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
  return message.parts
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join("\n\n")
}

const MEMORY_TOOL_TYPE = "tool-updateMemory"

const memoryUpdateSchema = z.object({
  section: z.enum(["allergies", "preferences"]),
  lines: z.array(z.string()),
})

export interface ProfileNoteUpdate {
  id: string
  section: "allergies" | "preferences"
  lines: string[]
}

export function messageProfileNoteUpdates(message: UIMessage): ProfileNoteUpdate[] {
  const updates: ProfileNoteUpdate[] = []
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state !== "output-available") continue
    if (part.type !== MEMORY_TOOL_TYPE) continue
    const update = memoryUpdateSchema.safeParse(part.output)
    if (update.success) updates.push({ id: part.toolCallId, ...update.data })
  }
  return updates
}

const LOG_MEAL_TOOL_TYPE = "tool-logMeal"
const logMealOutputSchema = z.object({
  entry: z.object({
    date: z.string(),
    section: z.enum(["BREAKFAST", "LUNCH", "DINNER", "OTHER"]),
    name: z.string(),
    calories: z.number().nullable().optional(),
  }),
})

export interface LoggedMealUpdate {
  id: string
  date: string
  section: "BREAKFAST" | "LUNCH" | "DINNER" | "OTHER"
  name: string
  calories: number | null
}

export function messageLoggedMeals(message: UIMessage): LoggedMealUpdate[] {
  const items: LoggedMealUpdate[] = []
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state !== "output-available") continue
    if (part.type !== LOG_MEAL_TOOL_TYPE) continue
    const parsed = logMealOutputSchema.safeParse(part.output)
    if (!parsed.success) continue
    items.push({
      id: part.toolCallId,
      date: parsed.data.entry.date,
      section: parsed.data.entry.section,
      name: parsed.data.entry.name,
      calories: parsed.data.entry.calories ?? null,
    })
  }
  return items
}

const BODY_METRICS_TOOL_TYPE = "tool-updateBodyMetrics"
const bodyMetricsOutputSchema = z.object({
  heightCm: z.number().nullable().optional(),
  weightKg: z.number().nullable().optional(),
  bmi: z.number().nullable().optional(),
  dailyCalorieTarget: z.number().nullable().optional(),
})

export interface BodyMetricsUpdate {
  id: string
  heightCm: number | null
  weightKg: number | null
  bmi: number | null
  dailyCalorieTarget: number | null
}

export function messageBodyMetricUpdates(message: UIMessage): BodyMetricsUpdate[] {
  const items: BodyMetricsUpdate[] = []
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state !== "output-available") continue
    if (part.type !== BODY_METRICS_TOOL_TYPE) continue
    const parsed = bodyMetricsOutputSchema.safeParse(part.output)
    if (!parsed.success) continue
    items.push({
      id: part.toolCallId,
      heightCm: parsed.data.heightCm ?? null,
      weightKg: parsed.data.weightKg ?? null,
      bmi: parsed.data.bmi ?? null,
      dailyCalorieTarget: parsed.data.dailyCalorieTarget ?? null,
    })
  }
  return items
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

type PlannerToolOutputPayload = {
  tool: "askUser" | "requestWebSearch"
  toolCallId: string
  output: Record<string, unknown>
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseToolOutputPayload(value: unknown): PlannerToolOutputPayload | undefined {
  if (!isPlainRecord(value)) return undefined
  if (value.tool !== "askUser" && value.tool !== "requestWebSearch") return undefined
  if (typeof value.toolCallId !== "string" || value.toolCallId.length === 0) return undefined
  if (!isPlainRecord(value.output)) return undefined
  return {
    tool: value.tool,
    toolCallId: value.toolCallId,
    output: value.output,
  }
}

const transport = new DefaultChatTransport<PlannerMessage>({
  api: MEAL_PLANNER_CHAT_URL,
  prepareSendMessagesRequest: ({ messages, headers, body }) => {
    const threadId = typeof body?.threadId === "string" ? body.threadId : undefined
    const toolOutput = parseToolOutputPayload(body?.toolOutput)
    let lastUser: PlannerMessage | undefined
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = messages[index]
      if (candidate.role === "user" && candidate.id !== WELCOME.id) {
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
    messages: [WELCOME] as PlannerMessage[],
  })

  const { messages, status, error, sendMessage, setMessages, stop, clearError, addToolOutput } =
    useChat<PlannerMessage>({
      transport,
      messages: [WELCOME],
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
      setMessages([WELCOME, ...detail.messages.map(deserializeMessage)])
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
