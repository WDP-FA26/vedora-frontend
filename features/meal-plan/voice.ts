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

// Mirrors vedora-api's `/meal-plan/voice/*` routes: the meal planner voice agent.
// Contract: vedora-api/docs/docs-for-FE/meal-plan-voice.md

/**
 * Same-origin setup route that `experimental_useRealtime` POSTs to. The hook sends no
 * Authorization header, so the route reads the session cookie and asks the API for a token.
 */
export const VOICE_SESSION_ROUTE = "/api/meal-planner/voice/session"

/** Setup route URL with optional `threadId` so the API can warm the sticky prompt cache. */
export function voiceSessionRoute(threadId?: string) {
  if (!threadId) return VOICE_SESSION_ROUTE
  return `${VOICE_SESSION_ROUTE}?threadId=${encodeURIComponent(threadId)}`
}

/**
 * Status the session route answers with when the API refuses a session because the
 * user's AI allowance is used up (`429 AI_QUOTA_EXCEEDED`): `experimental_useRealtime`
 * reports only the status, and a plain 429 also means "too fast".
 */
export const VOICE_QUOTA_STATUS = 402

/** What to tell the user when `experimental_useRealtime` fails; setup failures carry only a status. */
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

/** Must match the API's VOICE_REALTIME_MODEL: the token and its URL are bound to it. */
export const VOICE_MODEL_ID = "openai/gpt-live-1.1"

/**
 * The call ends on its own after this long, so a forgotten tab does not keep a paid session
 * open. Set by NEXT_PUBLIC_VOICE_MAX_SECONDS (lib/env.ts), 15 minutes by default.
 */
export const VOICE_MAX_SECONDS = PUBLIC_ENV.voiceMaxSeconds

/** One append to GPT-Live carries at most 500 tokens; Vietnamese text stays well under this. */
const MAX_APPEND_CHARACTERS = 1200

/**
 * Live session instructions, following OpenAI's GPT-Live template with fixed
 * `Backchannel policy`, `Interruption policy`, and `Delegation policy` headers,
 * written in English with an explicit spoken-Vietnamese rule.
 * https://developers.openai.com/api/docs/guides/live-prompting
 */
const VOICE_INSTRUCTIONS = `You are Vedora, a warm, composed, and capable kitchen companion for Vietnamese plant-based cooking.
- Speak ONLY in natural, conversational Vietnamese as in a real phone call, addressing yourself as "mình" and the user as "bạn".
- Keep sentences short, breathable, and varied in phrasing so someone cooking hands-free can follow effortlessly without robotic repetition, English filler words, or hesitant hedging.
- Lead straight with what matters. Deliver backend results in your own natural spoken words while keeping measurements, servings, and body metrics exact and phrasing dates, times, and rounded calories naturally in Vietnamese.
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
- The user says goodbye or expresses clear intent to end, hang up, or turn off the voice conversation itself. Delegate immediately without asking for confirmation, and NEVER say goodbye on your own before delegating.
- You are unsure whether backend state is needed, since the backend holds the user's full context.

Handling the delegation gap:
- Always delegate before giving any answer that depends on backend work, and never claim completion or guess the result while waiting.
- Match pre-delegation speech to the weight of the request: stay silent when delegating a farewell so you speak only one natural goodbye afterward; stay silent or ultra-brief on instant screen navigation so you do not announce the action twice; give one brief, varied Vietnamese heads-up before multi-step planning or nutrition lookups.

Do not delegate when:
- It is light casual talk unrelated to app data (excluding farewells, which MUST be delegated).
- A backend task is already running and the user is only checking status: reassure them briefly without starting a new delegation.
- The user only wants an ingredient amount or cooking step read from the recipe already open in your context, without moving the screen.
- The user's core intent is genuinely incomplete even with full app state and requires one crisp clarifying question first.`

/**
 * Startup greeting as a `developer` message in `session.input`, as the GPT-Live guide
 * recommends: the language, what to say, then pause and listen. With a name, the
 * greeting uses it the way Vietnamese speakers would.
 */
function voiceGreeting(fullName: string | undefined) {
  const name = fullName?.trim()
  const address = name
    ? `, greeting them naturally by given name in Vietnamese style (full name: "${name}")`
    : ""
  return `Give a brief, warm Vietnamese hello${address} in one short sentence so they know Vedora is listening, then pause.`
}

/** The session settings. Build it once per call: a new object would replace the hook's session. */
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

/** Silent page context for GPT-Live (`thinking` channel), sent when the session starts. */
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

/** Compact recipe summary for GPT-Live's silent `thinking` channel while the user cooks. */
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

/** Trims a result to what one GPT-Live append can carry. */
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

/** Parts of a recipe sheet the voice agent can scroll to; `top` is the start. */
export const RECIPE_SECTIONS = ["top", "ingredients", "steps"] as const
export type RecipeSection = (typeof RECIPE_SECTIONS)[number]

/** Relative scroll directions supported by `setScreen` on any active view. */
export const SCREEN_SCROLL_DIRECTIONS = ["up", "down", "top", "bottom"] as const
export type ScreenScrollDirection = (typeof SCREEN_SCROLL_DIRECTIONS)[number]

/** Live scroll position of the active panel or calendar, sent so the agent knows where the user is. */
export type VoiceScrollState = {
  percent: number
  atTop: boolean
  atBottom: boolean
}

const SCROLL_EDGE_TOLERANCE_PX = 4
const SCROLL_VIEWPORT_FRACTION = 0.7

/** Reads the live scroll position of a scrollable container. */
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

/** Smoothly scrolls a container by one viewport step (~70%) or to its start/end. */
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

/** Panels the voice agent can close; `all` is whatever is open. */
export type VoiceScreenPanel = "recipe" | "eatingLog" | "bodyMetrics" | "shoppingList" | "all"

/** Tabs inside the `bodyMetrics` nutrition & BMI companion sheet. */
export const BODY_METRICS_TABS = ["weekly", "bmi", "dietary"] as const
export type BodyMetricsTab = (typeof BODY_METRICS_TABS)[number]

/** What the planner page shows while the user speaks, sent with each turn (`screen`). */
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

/** The part of the existing planner UI the voice agent points at and opens. */
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
  /** `day: null` shows the week without picking a day. */
  | { kind: "planDay"; weekStart: string; day: Weekday | null }

/** How long the screen keeps glowing after the agent last opened something. */
export const VOICE_GLOW_MS = 1800

/** What to open, close, or scroll on the planner page in response to a `data-screen` event. */
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

/**
 * Runs one spoken turn and yields typed events from the API's UI message stream:
 * transient `data-*` commands (`data-state`, `data-screen`, `data-progress`,
 * `data-summary`, `data-end-call`), text deltas, and `ready` on `finish`.
 */
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
