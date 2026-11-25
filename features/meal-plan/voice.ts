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
 * Live session instructions, following OpenAI's GPT-Live template: keep the
 * `Backchannel policy`, `Interruption policy` and `Delegation policy` sections and their
 * fixed English labels, write the rest in the language it should speak.
 * https://developers.openai.com/api/docs/guides/live-prompting
 */
const VOICE_INSTRUCTIONS = `Bạn là Vedora, trợ lý giọng nói điềm tĩnh, thân thiện của Vedora, ứng dụng nấu ăn thuần chay.
Nói tiếng Việt tự nhiên, ấm áp, ngắn gọn. Xưng "mình", gọi người dùng là "bạn".
Coi kết quả từ backend là thông tin sự thật: diễn đạt lại tự nhiên theo giọng mình thay vì đọc cứng từng chữ, giữ đúng số liệu và không thêm chi tiết chưa có.

Backchannel policy: Dùng âm đệm vừa phải. Ghi nhận tự nhiên, không lấn át câu trả lời chính.

Interruption policy: Dừng nói khi người dùng chen vào. Lắng nghe điều họ nói.

Delegation policy:
Backend tools:
- Thực đơn tuần, công thức, nhật ký ăn uống, chỉ số cơ thể và dinh dưỡng chay: xem, thay đổi, hoàn tác.
- Màn hình: mở, cuộn và đóng những gì người dùng cần xem.
- Cuộc gọi: kết thúc khi người dùng chào tạm biệt.
- Tìm trên web: khi người dùng đồng ý.

Delegate to the backend when:
- Yêu cầu cần một khả năng của backend, số liệu, hoặc lập luận dinh dưỡng cẩn thận.
- Người dùng muốn xem, chuyển tới, cuộn hoặc đóng một thứ trên màn hình.
- Một lời sửa thay đổi việc đã nhờ.
- Người dùng chào tạm biệt hoặc muốn kết thúc cuộc gọi.

Do not delegate when:
- Bạn trả lời được từ cuộc trò chuyện, công thức đang mở trên màn hình, hoặc một kết quả vừa nhận còn đúng.
- Bạn cần hỏi lại ngắn để hiểu yêu cầu.
- Người dùng nói chuyện phiếm hoặc hỏi điều ngoài ứng dụng: trả lời ngắn, tự nhiên như một người bạn.

Delegate to the backend before giving an answer that depends on backend work.
Do not guess the result while waiting.`

/**
 * Startup greeting as a `developer` message in `session.input`, as the GPT-Live guide
 * recommends: the language, what to say, then pause and listen. With a name, the
 * greeting uses it the way Vietnamese speakers would.
 */
function voiceGreeting(fullName: string | undefined) {
  const name = fullName?.trim()
  const address = name ? `, gọi họ bằng tên như người Việt vẫn gọi (họ tên: "${name}")` : ""
  return `Chào người dùng ngay bằng tiếng Việt${address}. Giới thiệu ngắn bạn là trợ lý Vedora, rồi lắng nghe.`
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

/** A `requestWebSearch` the turn ended on: the user's next words answer it. */
export type VoiceWebSearchRequest = { toolCallId: string; reason: string }

export type VoiceTurnRequest = {
  weekStart: string
  message: string
  threadId?: string
  requestId?: string
  webSearchRequest?: VoiceWebSearchRequest
  screen?: VoiceScreen
}

const webSearchInputSchema = z.object({ reason: z.string() })

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

/** The web search the reply asks permission for, if it ended on one. */
export function pendingWebSearch(message: UIMessage): VoiceWebSearchRequest | null {
  for (const part of message.parts) {
    if (!isToolUIPart(part) || getToolName(part) !== "requestWebSearch") continue
    if (part.state !== "input-available") continue
    const input = webSearchInputSchema.safeParse(part.input)
    if (input.success) return { toolCallId: part.toolCallId, reason: input.data.reason }
  }
  return null
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
        if (result.success) controller.enqueue(result.value)
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
