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
  DAY_LABELS,
  deleteChatThread,
  fetchChatThread,
  fetchChatThreads,
  isMealPlanKey,
  MEAL_PLANNER_CHAT_THREADS_KEY,
  MEAL_PLANNER_CHAT_URL,
  planChangeSchema,
  rewindChatThread,
  SECTION_LABELS,
  updateChatThread,
  type ChatMessageRecord,
  type ChatRewind,
  type ChatThreadSummary,
  type PlanChange,
  type SyncChatMessageInput,
} from "@/features/meal-plan/meal-plan"
import { MY_DIETARY_KEY } from "@/features/dietary/dietary"
import { ApiError } from "@/features/shared/lib/api-client"

/** Mirror `MealPlannerChatDto` in vedora-api. */
const CONTEXT_MESSAGES = 40
const MAX_TEXT_LENGTH = 8000
/** Found dishes noted per search, enough for the planner to place the one the user picks. */
const MAX_NOTED_RESULTS = 12
const MAX_NOTED_SUMMARY = 1200
const MAX_SYNC_MESSAGES = 100
const THREAD_LIST_URL = `${MEAL_PLANNER_CHAT_THREADS_KEY}?limit=50`

/** The planner's tools that write the saved plan; each output is a `PlanChange`. */
const PLAN_CHANGE_TOOL_TYPES = [
  "tool-fillSlots",
  "tool-autoBalancePlan",
  "tool-editPlan",
  "tool-verifyMealPlanAllergies",
]

export interface PlanChangeEntry extends PlanChange {
  /** The tool call that made the first change of this week in the message. */
  id: string
}

function sameIds(left: readonly { id: string }[], right: readonly { id: string }[]) {
  return left.length === right.length && left.every(({ id }, index) => id === right[index].id)
}

/** Lays `later` over `earlier`: each day keeps its dishes from before `earlier`. */
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
  // Dishes left out earlier stay listed; same-day clashes are only current after the later change.
  const leftOut = earlier.problems.filter(({ code }) => code !== "DAY_CONFLICT")
  return { ...earlier, days, problems: [...leftOut, ...later.problems] }
}

/**
 * What the assistant saved to the plan in this message, one entry per week,
 * each day from before the message to after it. Days the message changed and
 * then put back as they were are left out.
 */
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

// Mirror vedora-api's `askUser` tool: it has no output on the server. The app
// records the pick as the tool output and sends it as the next user message.
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
  /** Undefined until the user answers on the card. */
  answer: string | undefined
}

/** The assistant's questions to the user in this message, in order. */
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

// Mirror vedora-api's `requestWebSearch` tool: it asks for consent and has no
// output until the user answers on the card.
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
  /** Undefined until the user answers. */
  approved: boolean | undefined
}

/** The assistant's requests to search the web in this message, in order. */
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

/**
 * Whether web search is enabled in this conversation: enabled by default so
 * the assistant can look up out-of-catalog dishes freely; an explicit decline
 * turns it off until approved again.
 */
export function webSearchAllowed(messages: readonly UIMessage[]): boolean {
  let allowed = true
  for (const message of messages) {
    for (const { approved } of messageWebSearchRequests(message)) {
      if (approved !== undefined) allowed = approved
    }
  }
  return allowed
}

function webSearchNote({ reason, approved }: WebSearchRequest): string {
  let answer = "người dùng chưa trả lời"
  if (approved === true) answer = "người dùng đã cho phép"
  if (approved === false) answer = "người dùng đã từ chối"
  return `[Đã xin phép tìm trên web (${reason}): ${answer}]`
}

const WEB_SEARCH_APPROVED_TEXT = "Đồng ý, bạn cứ tìm trên web."
const WEB_SEARCH_DECLINED_TEXT = "Không cần tìm trên web."

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



const PREFERENCES_TOOL_TYPE = "tool-updatePreferences"
const ALLERGY_NOTE_TOOL_TYPE = "tool-updateAllergyNote"

// What other planner tools returned, kept as short notes so the next turn can
// still use the ids the user picks from.
const foundRecipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  caloriesPerServing: z.number().nullable().optional(),
  avoidedIngredients: z.array(z.string()).default([]),
})
const foundRecipesSchema = z.array(foundRecipeSchema)
const viewedRecipeSchema = z.object({ id: z.string(), title: z.string() })
const consultSchema = z.object({ summary: z.string() })
const preferenceUpdateSchema = z.object({ preferenceNote: z.string().nullable() })
const allergyUpdateSchema = z.object({ allergyNote: z.string().nullable() })

function recipeLabel({ id, title, caloriesPerServing, avoidedIngredients }: z.infer<typeof foundRecipeSchema>) {
  const parts = [`id ${id}`]
  if (typeof caloriesPerServing === "number") parts.push(`~${caloriesPerServing} kcal`)
  if (avoidedIngredients.length > 0) parts.push(`KIÊNG: ${avoidedIngredients.join(", ")}`)
  return `${title} (${parts.join(", ")})`
}

function toolNotes(message: UIMessage): string[] {
  const notes: string[] = []
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state !== "output-available") continue
    if (part.type === "tool-searchRecipes") {
      const found = foundRecipesSchema.safeParse(part.output)
      if (!found.success) continue
      if (found.data.length === 0) {
        notes.push("[Đã tìm món: không thấy món nào]")
        continue
      }
      const labels = found.data.slice(0, MAX_NOTED_RESULTS).map(recipeLabel)
      notes.push(`[Đã tìm món: ${labels.join("; ")}]`)
      continue
    }
    if (part.type === "tool-getRecipe") {
      const recipe = viewedRecipeSchema.safeParse(part.output)
      if (recipe.success) notes.push(`[Đã xem công thức: ${recipe.data.title} (id ${recipe.data.id})]`)
      continue
    }
    if (part.type === "tool-consultNutritionSubagent") {
      const consult = consultSchema.safeParse(part.output)
      if (consult.success) notes.push(`[Chuyên gia dinh dưỡng: ${consult.data.summary.slice(0, MAX_NOTED_SUMMARY)}]`)
      continue
    }
  }
  for (const update of messageProfileNoteUpdates(message)) {
    const label = update.kind === "allergy" ? "Dị ứng" : "Sở thích"
    notes.push(`[Đã cập nhật ${label}: ${update.note ?? "(trống)"}]`)
  }
  const restaurantDishes = messageRestaurantDishes(message)
  if (restaurantDishes.length > 0) {
    const labels = restaurantDishes
      .slice(0, MAX_NOTED_RESULTS)
      .map(({ name, restaurant }) => `${name} (${restaurant.name})`)
    notes.push(`[Đã gợi ý món nhà hàng: ${labels.join("; ")}]`)
  }
  return notes
}


export interface ProfileNoteUpdate {
  id: string
  /** Which note in the dietary profile: "Sở thích" or "Dị ứng". */
  kind: "preference" | "allergy"
  note: string | null
}

/** The dietary profile notes the planner rewrote in this message, in order. */
export function messageProfileNoteUpdates(message: UIMessage): ProfileNoteUpdate[] {
  const updates: ProfileNoteUpdate[] = []
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state !== "output-available") continue
    if (part.type === PREFERENCES_TOOL_TYPE) {
      const update = preferenceUpdateSchema.safeParse(part.output)
      if (update.success) updates.push({ id: part.toolCallId, kind: "preference", note: update.data.preferenceNote })
      continue
    }
    if (part.type === ALLERGY_NOTE_TOOL_TYPE) {
      const update = allergyUpdateSchema.safeParse(part.output)
      if (update.success) updates.push({ id: part.toolCallId, kind: "allergy", note: update.data.allergyNote })
    }
  }
  return updates
}

function changeNote(change: PlanChange) {
  const days: string[] = []
  for (const { day, sections } of change.days) {
    const slots: string[] = []
    for (const { section, recipes, previous } of sections) {
      if (sameIds(recipes, previous)) continue
      const names = recipes.length > 0 ? recipes.map(({ title, id }) => `${title} (id ${id})`).join(", ") : "trống"
      slots.push(`${SECTION_LABELS[section].toLowerCase()}: ${names}`)
    }
    days.push(`${DAY_LABELS[day]} (${slots.join("; ")})`)
  }
  return `[Đã lưu vào thực đơn tuần ${change.weekStart}: ${days.join(" | ")}]`
}

function questionNote({ question, options }: UserQuestion) {
  return `[Đã hỏi người dùng: ${question} — lựa chọn: ${options.join(" | ")}]`
}

// The API takes plain text turns, so what the planner saved and asked rides
// along as notes it can read on the next turn.
function contextText(message: UIMessage) {
  const notes = messagePlanChanges(message).map(changeNote)
  const questions = messageQuestions(message).map(questionNote)
  const webSearchNotes = messageWebSearchRequests(message).map(webSearchNote)
  const parts = [messageText(message), ...toolNotes(message), ...notes, ...questions, ...webSearchNotes]
  return parts.filter(Boolean).join("\n").slice(0, MAX_TEXT_LENGTH)
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
    const threadId = typeof body?.threadId === "string" ? body.threadId : undefined
    return {
      headers,
      body: {
        weekStart: body?.weekStart,
        ...(threadId ? { threadId } : {}),
        allowWebSearch: body?.allowWebSearch === true,
        requestId: messages.filter((message) => message.role === "user").at(-1)?.id,
        messages: withoutRefusals(messages.filter((message) => message.id !== WELCOME.id))
          .map((message) => ({ role: message.role, text: contextText(message) }))
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

/**
 * The conversation with vedora-api's `POST /meal-plan/chat` and persisted threads.
 * `weekStart` is the week on screen (Monday, `YYYY-MM-DD`), the planner's default week:
 * undefined while it is still loading, and then nothing can be sent. The planner
 * saves its changes to the plan as it goes; `rewind` takes them back.
 */
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

  async function syncThread(
    token: string | undefined,
    targetThreadId: string,
    messagesToSync: readonly PlannerMessage[]
  ) {
    if (!token) return
    const payload = serializeMessages(messagesToSync)
    if (payload.length === 0) return
    try {
      await updateChatThread(token, targetThreadId, { messages: payload })
      void threads.mutate()
    } catch {
      // Server-side stream persistence already captured the turn; avoid breaking chat UI.
    }
  }

  const { messages, status, error, sendMessage, setMessages, stop, clearError, addToolOutput } =
    useChat<PlannerMessage>({
      transport,
      messages: [WELCOME],
      onFinish: ({ messages: finishedMessages }) => {
        const { accessToken: token, threadId: activeId } = latestRef.current
        void syncThread(token, activeId, finishedMessages)
      },
      onError: (err) => {
        if (APICallError.isInstance(err) && err.statusCode === 401) {
          router.refresh()
          return
        }
        const { accessToken: token, threadId: activeId, messages: currentMessages } = latestRef.current
        void syncThread(token, activeId, currentMessages)
      },
    })

  useEffect(() => {
    latestRef.current = { accessToken, threadId, messages }
  }, [accessToken, threadId, messages])

  // Every change the planner saves shows on the calendar as soon as its tool finishes.
  let savedChanges = 0
  for (const message of messages) savedChanges += messagePlanChanges(message).length
  useEffect(() => {
    if (savedChanges === 0) return
    void mutate(isMealPlanKey)
  }, [savedChanges, mutate])

  // The planner can rewrite the "Sở thích" and "Dị ứng" notes, which the dietary profile shows.
  let profileNoteUpdates = 0
  for (const message of messages) profileNoteUpdates += messageProfileNoteUpdates(message).length
  useEffect(() => {
    if (profileNoteUpdates === 0) return
    void mutate((key) => Array.isArray(key) && key[0] === MY_DIETARY_KEY)
  }, [profileNoteUpdates, mutate])

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

  function sendText(text: string, allowWebSearch: boolean) {
    if (!weekStart) return
    clearError()
    setHistoryError(null)
    void sendMessage(
      { text },
      {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: { threadId, weekStart, allowWebSearch },
      }
    )
  }

  async function answerWebSearch(toolCallId: string, approved: boolean) {
    if (busy || !weekStart) return
    await addToolOutput({ tool: "requestWebSearch", toolCallId, output: { approved } })
    sendText(approved ? WEB_SEARCH_APPROVED_TEXT : WEB_SEARCH_DECLINED_TEXT, approved)
  }

  async function answerQuestion(toolCallId: string, answer: string) {
    const text = answer.trim()
    if (busy || !weekStart || !text) return
    await addToolOutput({ tool: "askUser", toolCallId, output: { answer: text } })
    sendText(text, webSearchAllowed(latestRef.current.messages))
  }

  /**
   * Goes back to just before the user message `messageId`: the API puts back the
   * dishes the planner changed from there on and drops those messages. Resolves
   * what was restored, or null when it failed (see `historyError`).
   */
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
      // Never saved on the server (the turn failed before it was recorded), so
      // nothing in the plan came from it.
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
  // Only the newest message can still be answered; an older one the user typed past stays unanswered.
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
    /** Nothing readable is streaming yet: the planner is thinking or using a tool. */
    waiting: busy && !replying,
    /** The assistant message whose trace shows the waiting, once the reply has started. */
    pendingId: busy && !replying && last?.role === "assistant" ? last.id : null,
    streamingId: replying ? last.id : null,
    error: error ? errorMessage(error) : null,
    send: (text: string) => sendText(text, webSearch),
    /** Stops the running turn; what the planner already saved stays saved. */
    stop: () => void stop(),
    /** The user allowed web search in this conversation. */
    webSearchAllowed: webSearch,
    /** The assistant's request to search the web, waiting for the user's answer. */
    openWebSearchRequest,
    answerWebSearch: (toolCallId: string, approved: boolean) => void answerWebSearch(toolCallId, approved),
    /** The assistant's question at the end of the conversation, waiting for the user's pick. */
    openQuestion,
    answerQuestion: (toolCallId: string, answer: string) => void answerQuestion(toolCallId, answer),
    /** The user message being rewound to. */
    rewindingId,
    rewind,
    selectThread,
    startNewThread,
    removeThread,
    reset: startNewThread,
  }
}

export type MealPlannerChat = ReturnType<typeof useMealPlannerChat>
