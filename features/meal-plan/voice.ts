import {
  parseJsonEventStream,
  uiMessageChunkSchema,
  type Experimental_RealtimeSessionConfig,
} from "ai"
import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import { WEEKDAYS, type MealSection, type Weekday } from "@/features/meal-plan/meal-plan"
import {
  plannerStateEventSchema,
  type PlannerStateEvent,
} from "@/features/meal-plan/planner-state-protocol"
import { send } from "@/features/shared/lib/api-client"
import { PUBLIC_ENV } from "@/lib/env"

export const VOICE_SESSION_ROUTE = "/api/meal-planner/voice/session"

export function voiceSessionRoute(threadId?: string) {
  if (!threadId) return VOICE_SESSION_ROUTE
  return `${VOICE_SESSION_ROUTE}?threadId=${encodeURIComponent(threadId)}`
}

export const VOICE_QUOTA_STATUS = 402

export function voiceErrorText(message: string) {
  const setup = /^Failed to fetch realtime setup: (\d+)$/.exec(message)
  if (!setup) return message
  const status = Number(setup[1])
  if (status === VOICE_QUOTA_STATUS) {
    return "Bạn đã dùng hết lượt trợ lý AI hiện có nên chưa thể bắt đầu trò chuyện bằng giọng nói."
  }
  if (status === 429) return "Bạn thao tác hơi nhanh. Đợi một chút rồi thử lại nhé."
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Hãy tải lại trang rồi thử lại."
  if (status === 503) return "Trợ lý giọng nói đang tạm ngưng. Hãy thử lại sau."
  return "Chưa kết nối được trợ lý giọng nói. Hãy thử lại sau ít phút."
}

export const VOICE_MODEL_ID = "openai/gpt-live-1.1"

export const VOICE_MAX_SECONDS = PUBLIC_ENV.voiceMaxSeconds

const MAX_APPEND_CHARACTERS = 1200

const VOICE_INSTRUCTIONS = `You are Vedora, a warm, composed, and capable kitchen companion for Vietnamese plant-based cooking.
- Speak ONLY in natural, conversational Vietnamese as in a real phone call, addressing yourself as "mình" and the user as "bạn".
- Keep sentences short, breathable, and varied in phrasing so someone cooking hands-free can follow effortlessly without robotic repetition, English filler words, or hesitant hedging.
- Lead straight with what matters. Deliver backend results in your own natural spoken words: say the main point in one or two short sentences and leave the remaining details for the user to ask about. Any measurement, serving, or body metric you do mention stays exact; round calories and phrase dates and times naturally in Vietnamese.
- When a final result arrives after an earlier progress update, continue smoothly from what you already told the user rather than repeating completed parts.
- Role boundary: you own live conversation and spoken delivery; the backend owns all user data, calendar plans, recipes, shopping lists, nutrition reasoning, screen navigation, and call ending. You only see today's date and any open recipe, while the backend sees the full meal plan, diary, profile, and live screen state.

Backchannel policy:
- Give sparse, brief, varied Vietnamese listening cues only while the user is speaking at length.
- Stay quiet during short commands or brief thinking pauses, and never repeat the same cue mechanically or talk over their main point.

Interruption policy:
- Stop speaking immediately the moment the user interrupts and listen to their updated intent.

Delegation policy:
Backend capabilities: weekly meal plans, recipe catalog, ingredients, shopping list, plant-based nutrition, eating logs, body metrics, undo, screen navigation (open, filter, scroll, switch tabs or weeks, close panels), and ending the voice call.

Delegate to the backend immediately when:
- A request involves any backend capability, refers to something on the screen or calendar, or modifies an earlier request.
- The user changes, narrows, adds to, or withdraws what they asked for while backend work is still running. Delegate again so the latest intent replaces the earlier task; do not just acknowledge the change in speech.
- The user says goodbye or expresses clear intent to end, hang up, or turn off the voice conversation itself. Delegate immediately without asking for confirmation, and NEVER say goodbye on your own before delegating.
- You are unsure whether backend state is needed, since the backend holds the user's full context.

Handling the delegation gap:
- Always delegate before giving any answer that depends on backend work, and never claim completion or guess the result while waiting.
- Match pre-delegation speech to the weight of the request: stay silent when delegating a farewell so you speak only one natural goodbye afterward; stay silent or ultra-brief on instant screen navigation so you do not announce the action twice; give one brief, varied Vietnamese heads-up before multi-step planning or nutrition lookups.

Do not delegate when:
- It is light casual talk unrelated to app data (excluding farewells, which MUST be delegated).
- A backend task is already running and the user only asks how it is going, without changing what they want: reassure them briefly without starting a new delegation.
- The user only wants an ingredient amount or cooking step read from the recipe already open in your context, without moving the screen.
- The user's core intent is genuinely incomplete even with full app state and requires one crisp clarifying question first.`

function voiceGreeting(fullName: string | undefined) {
  const name = fullName?.trim()
  const address = name
    ? `, greeting them naturally by given name in Vietnamese style (full name: "${name}")`
    : ""
  return `Give a brief, warm Vietnamese hello${address} in one short sentence so they know Vedora is listening, then pause.`
}

export function voiceSessionConfig(fullName: string | undefined): Partial<Experimental_RealtimeSessionConfig> {
  return {
    instructions: VOICE_INSTRUCTIONS,
    providerOptions: {
      openai: {
        delegation: { type: "client" },
        input: [
          {
            type: "message",
            role: "developer",
            content: [{ type: "input_text", text: voiceGreeting(fullName) }],
          },
        ],
      },
    },
  }
}

export function voicePageContext(weekStart: string, today: string) {
  return `Người dùng đang ở trang Lên thực đơn của Vedora, xem tuần bắt đầu ${weekStart}. Hôm nay là ${today}.`
}

export type VoiceOpenRecipe = {
  id: string
  title: string
  servings: number
  ingredients: { name: string; quantity: number | null; unit: string | null; note: string | null }[]
  steps: string[]
}

export function voiceRecipeContext(recipe: VoiceOpenRecipe): string {
  const ingredients = recipe.ingredients
    .map((item) => {
      const amount = [item.quantity, item.unit].filter((part) => part !== null && part !== "").join(" ")
      const parts = [amount, item.name].filter(Boolean).join(" ")
      return item.note ? `${parts} (${item.note})` : parts
    })
    .join(", ")
  const steps = recipe.steps.map((step, index) => `${index + 1}. ${step}`).join(" ")
  const lines = [`Màn hình đang mở công thức "${recipe.title}" (${recipe.servings} khẩu phần).`]
  if (ingredients) lines.push(`Nguyên liệu: ${ingredients}.`)
  if (steps) lines.push(`Các bước: ${steps}`)
  return appendableText(lines.join("\n"))
}

export const VOICE_RECIPE_CLOSED_CONTEXT = "Người dùng vừa đóng bảng công thức, quay lại xem lịch thực đơn."

export function plainSpokenText(text: string) {
  const lines = text
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, "")
        .replace(/(\*\*|__|\*|`)/g, "")
        .trim()
    )
    .filter(Boolean)
  return lines.join(" ")
}

export function appendableText(text: string) {
  if (text.length <= MAX_APPEND_CHARACTERS) return text
  return text.slice(0, MAX_APPEND_CHARACTERS)
}

export const voiceSessionSchema = z.object({
  token: z.string().min(1),
  url: z.string().url(),
  expiresAt: z.number().nullable(),
  model: z.string(),
})

export type VoiceTurnRequest = {
  weekStart: string
  message: string
  threadId?: string
  requestId?: string
  screen?: VoiceScreen
}

export const RECIPE_SECTIONS = ["top", "ingredients", "steps"] as const
export type RecipeSection = (typeof RECIPE_SECTIONS)[number]

export const SCREEN_SCROLL_DIRECTIONS = ["up", "down", "top", "bottom"] as const
export type ScreenScrollDirection = (typeof SCREEN_SCROLL_DIRECTIONS)[number]

export type VoiceScrollState = {
  percent: number
  atTop: boolean
  atBottom: boolean
}

const SCROLL_EDGE_TOLERANCE_PX = 4
const SCROLL_VIEWPORT_FRACTION = 0.7

export function readScrollState(element: HTMLElement | null): VoiceScrollState | undefined {
  if (!element) return undefined
  const maxScroll = element.scrollHeight - element.clientHeight
  if (maxScroll <= SCROLL_EDGE_TOLERANCE_PX) {
    return { percent: 0, atTop: true, atBottom: true }
  }
  const top = Math.max(0, Math.min(element.scrollTop, maxScroll))
  return {
    percent: Math.round((top / maxScroll) * 100),
    atTop: top <= SCROLL_EDGE_TOLERANCE_PX,
    atBottom: top >= maxScroll - SCROLL_EDGE_TOLERANCE_PX,
  }
}

export function scrollContainer(element: HTMLElement | null, direction: ScreenScrollDirection) {
  if (!element) return
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth"
  if (direction === "top") {
    element.scrollTo({ top: 0, behavior })
    return
  }
  if (direction === "bottom") {
    element.scrollTo({ top: element.scrollHeight, behavior })
    return
  }
  const delta = Math.round(element.clientHeight * SCROLL_VIEWPORT_FRACTION)
  element.scrollBy({ top: direction === "down" ? delta : -delta, behavior })
}

export type VoiceScreenPanel = "recipe" | "eatingLog" | "bodyMetrics" | "shoppingList" | "all"

export const BODY_METRICS_TABS = ["weekly", "bmi", "dietary"] as const
export type BodyMetricsTab = (typeof BODY_METRICS_TABS)[number]

export type VoiceScreen = {
  weekStart: string
  day?: Weekday
  panel: "none" | "recipe" | "eatingLog" | "bodyMetrics" | "shoppingList"
  recipeId?: string
  recipeSection?: RecipeSection
  recipeStep?: number
  recipeDay?: Weekday
  recipeMealSection?: MealSection
  recipeEaten?: boolean
  eatingLogDate?: string
  bodyMetricsTab?: BodyMetricsTab
  shoppingDays?: Weekday[]
  shoppingPeople?: number
  shoppingCheckedCount?: number
  scrollState?: VoiceScrollState
}

export type VoiceFocus =
  | { kind: "recipe"; recipeId: string; title: string; section: RecipeSection | null; step?: number | null }
  | { kind: "eatingLog"; date: string | null }
  | { kind: "bodyMetrics"; tab?: BodyMetricsTab | null; weekStart?: string | null }
  | {
      kind: "shoppingList"
      weekStart?: string | null
      day?: Weekday | null
      wholeWeek?: boolean
      people?: number | null
      checkItems?: string[] | null
      uncheckItems?: string[] | null
      clearChecked?: boolean
    }
  | { kind: "planDay"; weekStart: string; day: Weekday | null }

export const VOICE_GLOW_MS = 1800

export type VoiceScreenCommand = {
  focus: VoiceFocus | null
  close: VoiceScreenPanel | null
  scroll?: ScreenScrollDirection | null
}

export type VoiceTurnEvent =
  | { type: "started" }
  | { type: "state"; state: PlannerStateEvent }
  | { type: "screen"; screen: VoiceScreenCommand }
  | { type: "progress"; text: string }
  | { type: "summary"; text: string }
  | { type: "end-call" }
  | { type: "text"; delta: string }
  | { type: "ready" }

const voiceFocusSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("recipe"),
    recipeId: z.string(),
    title: z.string(),
    section: z.enum(RECIPE_SECTIONS).nullable(),
    step: z.number().int().nullable().optional(),
  }),
  z.object({ kind: z.literal("eatingLog"), date: z.string().nullable() }),
  z.object({
    kind: z.literal("bodyMetrics"),
    tab: z.enum(BODY_METRICS_TABS).nullable().optional(),
    weekStart: z.string().nullable().optional(),
  }),
  z.object({
    kind: z.literal("shoppingList"),
    weekStart: z.string().nullable().optional(),
    day: z.enum(WEEKDAYS).nullable().optional(),
    wholeWeek: z.boolean().optional(),
    people: z.number().int().min(1).max(4).nullable().optional(),
    checkItems: z.array(z.string()).nullable().optional(),
    uncheckItems: z.array(z.string()).nullable().optional(),
    clearChecked: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("planDay"), weekStart: z.string(), day: z.enum(WEEKDAYS).nullable() }),
])

const voiceScreenDataSchema = z.object({
  focus: voiceFocusSchema.nullable(),
  close: z.enum(["recipe", "eatingLog", "bodyMetrics", "shoppingList", "all"]).nullable(),
  scroll: z.enum(SCREEN_SCROLL_DIRECTIONS).nullable().optional(),
})

const voiceTextDataSchema = z.object({ text: z.string().min(1) })

export async function* streamVoiceTurn(
  token: string,
  request: VoiceTurnRequest,
  signal: AbortSignal
): AsyncGenerator<VoiceTurnEvent> {
  const response = await send(`${API_URL}/meal-plan/voice/turns`, token, {
    method: "POST",
    body: JSON.stringify(request),
    signal,
  })
  if (!response.body) return

  const parsed = parseJsonEventStream({ stream: response.body, schema: uiMessageChunkSchema })
  const reader = parsed.getReader()
  try {
    while (true) {
      const { value: result, done } = await reader.read()
      if (done) break
      if (!result.success) continue
      const chunk = result.value

      if (chunk.type === "start") {
        yield { type: "started" }
        continue
      }
      if (chunk.type === "error") {
        throw new Error(chunk.errorText)
      }
      if (chunk.type === "text-delta") {
        yield { type: "text", delta: chunk.delta }
        continue
      }
      if (chunk.type === "finish") {
        yield { type: "ready" }
        continue
      }
      if (chunk.type === "data-state") {
        const data = plannerStateEventSchema.safeParse(chunk.data)
        if (data.success) yield { type: "state", state: data.data }
        continue
      }
      if (chunk.type === "data-screen") {
        const data = voiceScreenDataSchema.safeParse(chunk.data)
        if (data.success) yield { type: "screen", screen: data.data }
        continue
      }
      if (chunk.type === "data-progress") {
        const data = voiceTextDataSchema.safeParse(chunk.data)
        if (data.success) yield { type: "progress", text: data.data.text }
        continue
      }
      if (chunk.type === "data-summary") {
        const data = voiceTextDataSchema.safeParse(chunk.data)
        if (data.success) yield { type: "summary", text: data.data.text }
        continue
      }
      if (chunk.type === "data-end-call") {
        yield { type: "end-call" }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
