import { isToolUIPart, type UIMessage } from "ai"
import { z } from "zod"

import { planChangeSchema, type PlanChange } from "@/features/meal-plan/schemas/meal-plan.schema"
import type { ChatMessageRecord } from "@/features/meal-plan/schemas/chat.schema"

export type PlannerMessage = UIMessage<{ refused?: boolean }>

export const WELCOME_MESSAGE: PlannerMessage = {
  id: "welcome",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Bạn muốn lên thực đơn hay tìm hiểu thêm về món chay? Mình có thể giúp bạn chọn món theo sở thích, thời gian nấu và các thành phần cần tránh.",
    },
  ],
}

export const WEB_SEARCH_APPROVED_TEXT = "Đồng ý, bạn cứ tìm trên web."
export const WEB_SEARCH_DECLINED_TEXT = "Không cần tìm trên web."

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

export function deserializeMessage(record: ChatMessageRecord): PlannerMessage {
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

export type PlannerToolOutputPayload = {
  tool: "askUser" | "requestWebSearch"
  toolCallId: string
  output: Record<string, unknown>
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseToolOutputPayload(value: unknown): PlannerToolOutputPayload | undefined {
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
