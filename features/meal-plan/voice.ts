import {
  getToolName,
  isTextUIPart,
  isToolUIPart,
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type Experimental_RealtimeSessionConfig,
  type UIMessage,
  type UIMessageChunk,
} from "ai"
import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import { DAY_LABELS, planChangeSchema, WEEKDAYS, type Weekday } from "@/features/meal-plan/meal-plan"
import { send } from "@/features/shared/lib/api-client"

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

/** The call ends on its own after this long, so a forgotten tab does not keep a paid session open. */
export const VOICE_MAX_SECONDS = 5 * 60

/** One append to GPT-Live carries at most 500 tokens; Vietnamese text stays well under this. */
const MAX_APPEND_CHARACTERS = 1200

/**
 * Live session instructions, following OpenAI's GPT-Live template with fixed
 * `Backchannel policy`, `Interruption policy`, and `Delegation policy` headers,
 * written in English with an explicit spoken-Vietnamese rule.
 * https://developers.openai.com/api/docs/guides/live-prompting
 */
const VOICE_INSTRUCTIONS = `You are Vedora, the calm, warm voice companion of Vedora, a plant-based cooking app for Vietnamese users.
Speak ONLY in natural, conversational Vietnamese as in a real phone call: warm, concise, easy to follow by ear, never robotic, never using English filler words. Refer to yourself as "mình" and the user as "bạn".
You are the voice interface, while the backend owns all app data, nutrition reasoning, screen actions, and call state. Treat backend results as the source of truth: rephrase them naturally in your own spoken voice without reading verbatim, keep all numbers accurate, and never invent unstated details.

Backchannel policy: Use brief, natural spoken Vietnamese acknowledgments sparingly without talking over the main reply.

Interruption policy: Stop speaking immediately when the user interrupts and listen carefully.

Delegation policy:
Role boundary — the backend owns:
- All Vedora app data and actions: weekly meal plans, recipe catalog, ingredients, plant-based nutrition knowledge, eating logs, body metrics, and undo.
- Screen control: opening, scrolling, switching, or closing any view on screen.
- Call lifecycle: ending the call when the user wants to finish.

Delegate to the backend when:
- A request touches anything the backend owns, even if it is brief or you have general knowledge about it: the backend holds Vedora's catalog, user data, and screen controls.
- The user changes or corrects a previous request.
- You are unsure whether the backend is needed: when in doubt, always delegate to the backend.

Do not delegate when:
- It is casual social conversation unrelated to the app.
- The user is only acknowledging or checking status while a backend task is already in progress: reassure them naturally in spoken Vietnamese without starting a new request.
- The user simply asks to repeat details already present in the recipe currently open on screen.
- You need one brief clarifying question before delegating an ambiguous request.

Never claim an action is done or promise an outcome before delegating to the backend.
Delegate to the backend before answering anything that depends on backend work, and never guess the result while waiting.`

/**
 * Startup greeting as a `developer` message in `session.input`, as the GPT-Live guide
 * recommends: the language, what to say, then pause and listen. With a name, the
 * greeting uses it the way Vietnamese speakers would.
 */
function voiceGreeting(fullName: string | undefined) {
  const name = fullName?.trim()
  const address = name ? `, addressing them by given name the way Vietnamese speakers naturally do (full name: "${name}")` : ""
  return `Greet the user right away in natural Vietnamese${address}. Briefly introduce yourself as Vedora's assistant, then pause and listen.`
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

/** A tool the planner finished in a voice turn. */
export type VoiceAction = { toolCallId: string; tool: string; input: unknown; output: unknown }

export type VoiceTurnRequest = {
  weekStart: string
  message: string
  threadId?: string
  requestId?: string
  screen?: VoiceScreen
}

const voiceMetadataSchema = z.object({ voiceDone: z.literal(true) })

function markVoiceDone(metadata: unknown): Record<string, unknown> {
  if (typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)) {
    return { ...metadata, voiceDone: true }
  }
  return { voiceDone: true }
}

/** Whether the planner LLM has finished emitting its reply for this stream snapshot. */
export function isVoiceReplyReady(message: UIMessage): boolean {
  return voiceMetadataSchema.safeParse(message.metadata).success
}

/** The finished tools of a reply, in order. */
export function finishedActions(message: UIMessage): VoiceAction[] {
  const actions: VoiceAction[] = []
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state !== "output-available") continue
    actions.push({ toolCallId: part.toolCallId, tool: getToolName(part), input: part.input, output: part.output })
  }
  return actions
}

/** The spoken reply: the text parts of the message. */
export function replyText(message: UIMessage) {
  const texts: string[] = []
  for (const part of message.parts) {
    if (isTextUIPart(part)) texts.push(part.text)
  }
  return texts.join(" ").trim()
}

/**
 * Runs one spoken turn and yields the reply as it grows: the API streams the same
 * UI message stream as the text chat, so tools can be mirrored as they finish.
 */
export async function* streamVoiceTurn(
  token: string,
  request: VoiceTurnRequest,
  signal: AbortSignal
): AsyncGenerator<UIMessage> {
  const response = await send(`${API_URL}/meal-plan/voice/turns`, token, {
    method: "POST",
    body: JSON.stringify(request),
    signal,
  })
  if (!response.body) return
  const chunks = parseJsonEventStream({ stream: response.body, schema: uiMessageChunkSchema }).pipeThrough(
    new TransformStream<{ success: true; value: UIMessageChunk } | { success: false; error: unknown }, UIMessageChunk>({
      transform(result, controller) {
        if (!result.success) return
        if (result.value.type === "finish") {
          controller.enqueue({
            ...result.value,
            messageMetadata: markVoiceDone(result.value.messageMetadata),
          })
          return
        }
        controller.enqueue(result.value)
      },
    })
  )
  let failure: string | null = null
  for await (const message of readUIMessageStream({
    stream: chunks,
    onError: (error) => {
      failure = error instanceof Error ? error.message : String(error)
    },
  })) {
    yield message
  }
  if (failure !== null) throw new Error(failure)
}

/** A short line to say while a long turn is still running, for a change already saved. */
export function progressLine(action: VoiceAction): string | null {
  if (PLAN_TOOLS.has(action.tool)) {
    const change = planChangeSchema.safeParse(action.output)
    if (!change.success || !change.data.applied) return null
    const days = change.data.days.map(({ day }) => DAY_LABELS[day]).join(", ")
    return days ? `Đã lưu thay đổi thực đơn cho ${days}, đang làm tiếp.` : null
  }
  if (action.tool === "logMeal") return "Đã ghi món vào nhật ký, đang làm tiếp."
  if (action.tool === "updateBodyMetrics") return "Đã lưu chỉ số cơ thể mới, đang làm tiếp."
  if (action.tool === "undoLastChange") return "Đã hoàn tác thay đổi trước đó, đang làm tiếp."
  return null
}

/** Parts of a recipe sheet the voice agent can scroll to; `top` is the start. */
export const RECIPE_SECTIONS = ["top", "ingredients", "steps"] as const
export type RecipeSection = (typeof RECIPE_SECTIONS)[number]

/** Panels the voice agent can close; `all` is whatever is open. */
export type VoiceScreenPanel = "recipe" | "eatingLog" | "bodyMetrics" | "all"

/** What the planner page shows while the user speaks, sent with each turn (`screen`). */
export type VoiceScreen = {
  weekStart: string
  day?: Weekday
  panel: "none" | "recipe" | "eatingLog" | "bodyMetrics"
  recipeId?: string
  recipeSection?: RecipeSection
  eatingLogDate?: string
}

const setScreenOutputSchema = z.object({
  applied: z.boolean(),
  view: z.enum(["calendar", "recipe", "eatingLog", "bodyMetrics"]),
  recipeId: z.string().nullable(),
  title: z.string().nullable(),
  section: z.enum(RECIPE_SECTIONS).nullable(),
  weekStart: z.string().nullable(),
  day: z.enum(WEEKDAYS).nullable(),
  date: z.string().nullable(),
})

const logMealOutputSchema = z.object({ entry: z.object({ date: z.string() }) })

const undoOutputSchema = z.object({
  weeks: z.array(z.object({ weekStart: z.string(), restored: z.array(z.enum(WEEKDAYS)) })),
})

/** The part of the existing planner UI the voice agent points at and opens. */
export type VoiceFocus =
  | { kind: "recipe"; recipeId: string; title: string; section: RecipeSection | null }
  | { kind: "eatingLog"; date: string | null }
  | { kind: "bodyMetrics" }
  /** `day: null` shows the week without picking a day. */
  | { kind: "planDay"; weekStart: string; day: Weekday | null }

/** How long the screen keeps glowing after the agent last opened something. */
export const VOICE_GLOW_MS = 1800

const PLAN_TOOLS = new Set(["fillSlots", "editPlan", "autoBalancePlan", "verifyMealPlanAllergies"])
const DIETARY_NOTE_TOOLS = new Set(["updateMemory"])

export type VoiceEffects = {
  /** What to open on screen: the last panel a tool asked for, else the last changed day. */
  focus: VoiceFocus | null
  /** A panel the agent closed. */
  close: VoiceScreenPanel | null
  planChanged: boolean
  logChanged: boolean
  nutritionChanged: boolean
  dietaryChanged: boolean
  /** The agent decided to hang up once its reply is spoken. */
  endCall: boolean
}

/** Puts a `setScreen` result into the effects: the view to open, or the calendar with panels closed. */
function applyScreen(effects: VoiceEffects, screen: z.infer<typeof setScreenOutputSchema>) {
  if (screen.view === "recipe" && screen.recipeId !== null && screen.title !== null) {
    effects.focus = { kind: "recipe", recipeId: screen.recipeId, title: screen.title, section: screen.section }
    return
  }
  if (screen.view === "eatingLog") {
    effects.focus = { kind: "eatingLog", date: screen.date }
    return
  }
  if (screen.view === "bodyMetrics") {
    effects.focus = { kind: "bodyMetrics" }
    return
  }
  if (screen.view !== "calendar") return
  effects.close = "all"
  if (screen.weekStart !== null) effects.focus = { kind: "planDay", weekStart: screen.weekStart, day: screen.day }
}

const bodyMetricsSummarySchema = z
  .object({
    weightKg: z.number().nullable().optional(),
    bmi: z.number().nullable().optional(),
    dailyCalorieTarget: z.number().nullable().optional(),
  })
  .nullable()
  .optional()

const setScreenSummarySchema = setScreenOutputSchema.extend({
  metrics: bodyMetricsSummarySchema,
})

const endCallOutputSchema = z.object({ ended: z.literal(true) })

const RECIPE_SECTION_SUMMARY: Record<RecipeSection, string> = {
  top: "",
  ingredients: ", ở phần nguyên liệu",
  steps: ", ở phần cách làm",
}

/**
 * Short factual line built from completed quick tools when the planner stopped
 * right after step 1 without generating prose.
 */
export function actionSummary(actions: VoiceAction[]): string | null {
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const action = actions[index]
    if (action.tool === "endCall" && endCallOutputSchema.safeParse(action.output).success) {
      return "Người dùng muốn kết thúc cuộc gọi, hãy chào tạm biệt ngắn gọn."
    }
    if (action.tool !== "setScreen") continue
    const screen = setScreenSummarySchema.safeParse(action.output)
    if (!screen.success || !screen.data.applied) continue
    const { view, title, section, date, day, metrics } = screen.data
    if (view === "recipe" && title !== null) {
      const part = section === null ? "" : RECIPE_SECTION_SUMMARY[section]
      return `Đã mở công thức "${title}" trên màn hình${part}.`
    }
    if (view === "eatingLog") {
      return date ? `Đã mở nhật ký ăn uống ngày ${date} trên màn hình.` : "Đã mở nhật ký ăn uống hôm nay trên màn hình."
    }
    if (view === "bodyMetrics") {
      const details: string[] = []
      if (typeof metrics?.weightKg === "number") details.push(`cân nặng ${metrics.weightKg} kg`)
      if (typeof metrics?.bmi === "number") details.push(`BMI ${metrics.bmi}`)
      if (typeof metrics?.dailyCalorieTarget === "number") {
        details.push(`mục tiêu khoảng ${metrics.dailyCalorieTarget} kcal mỗi ngày`)
      }
      return details.length > 0
        ? `Đã mở bảng chỉ số cơ thể trên màn hình (${details.join(", ")}).`
        : "Đã mở bảng chỉ số cơ thể trên màn hình."
    }
    if (view === "calendar") {
      return day ? `Đã đóng bảng và chuyển lịch tới ${DAY_LABELS[day]}.` : "Đã đóng các bảng và quay lại lịch thực đơn."
    }
  }
  return null
}

/** What a turn's finished tools mean for the page: what to open and which caches to refresh. */
export function voiceEffects(actions: VoiceAction[]): VoiceEffects {
  const effects: VoiceEffects = {
    focus: null,
    close: null,
    planChanged: false,
    logChanged: false,
    nutritionChanged: false,
    dietaryChanged: false,
    endCall: false,
  }
  let changedDay: VoiceFocus | null = null
  for (const action of actions) {
    if (PLAN_TOOLS.has(action.tool)) {
      effects.planChanged = true
      const change = planChangeSchema.safeParse(action.output)
      const day = change.success ? change.data.days[0]?.day : undefined
      if (change.success && change.data.applied && day) {
        changedDay = { kind: "planDay", weekStart: change.data.weekStart, day }
      }
      continue
    }
    if (DIETARY_NOTE_TOOLS.has(action.tool)) {
      effects.dietaryChanged = true
      continue
    }
    if (action.tool === "endCall") {
      effects.endCall = true
      continue
    }
    if (action.tool === "setScreen") {
      const output = setScreenOutputSchema.safeParse(action.output)
      if (output.success && output.data.applied) applyScreen(effects, output.data)
      continue
    }
    if (action.tool === "logMeal") {
      effects.logChanged = true
      const output = logMealOutputSchema.safeParse(action.output)
      if (output.success) effects.focus = { kind: "eatingLog", date: output.data.entry.date }
      continue
    }
    if (action.tool === "undoLastChange") {
      effects.planChanged = true
      const output = undoOutputSchema.safeParse(action.output)
      const week = output.success ? output.data.weeks[0] : undefined
      const day = week?.restored[0]
      if (week && day) changedDay = { kind: "planDay", weekStart: week.weekStart, day }
      continue
    }
    if (action.tool === "updateBodyMetrics") {
      effects.nutritionChanged = true
      effects.focus = { kind: "bodyMetrics" }
    }
  }
  if (effects.focus === null) effects.focus = changedDay
  return effects
}

/** What words spoken during a running turn mean for it; see `POST /meal-plan/voice/interruptions`. */
export type VoiceInterruption = "progress" | "supersede" | "queue"

const interruptionSchema = z.object({ action: z.enum(["progress", "supersede", "queue"]) })

export async function classifyInterruption(
  token: string,
  request: { running: string; utterance: string },
  signal?: AbortSignal
): Promise<VoiceInterruption> {
  const response = await send(`${API_URL}/meal-plan/voice/interruptions`, token, {
    method: "POST",
    body: JSON.stringify(request),
    signal,
  })
  return interruptionSchema.parse(await response.json()).action
}
