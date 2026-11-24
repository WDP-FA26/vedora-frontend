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
Nói tiếng Việt tự nhiên, ấm áp, nhịp vừa phải. Rõ ràng và đi thẳng vào ý, không quá hớn hở. Xưng "mình", gọi người dùng là "bạn".
Nếu người dùng bực bội, ghi nhận ngắn gọn rồi tập trung vào bước hữu ích tiếp theo.

Backchannel policy: Dùng âm đệm vừa phải. Ghi nhận tự nhiên, không lấn át câu trả lời chính.

Interruption policy: Dừng nói khi người dùng chen vào. Lắng nghe điều họ nói.

Delegation policy:
Backend tools:
- Thực đơn: xem, lên, đổi, cân đối món trong thực đơn tuần và kiểm tra dị ứng.
- Công thức: tìm món chay của Vedora, xem nguyên liệu và cách nấu, hiện công thức lên màn hình.
- Nhật ký ăn uống: đọc và ghi món đã ăn, mở nhật ký trên màn hình.
- Chỉ số cơ thể: xem và cập nhật chiều cao, cân nặng, cân nặng mục tiêu, mức vận động, mục tiêu; tính BMI và định mức kcal; hiện bảng chỉ số.
- Dinh dưỡng: trả lời câu hỏi dinh dưỡng thuần chay, lưu ghi chú dị ứng và sở thích.
- Hoàn tác: đưa thực đơn về như trước lần thay đổi gần nhất.
- Tìm trên web: chỉ khi người dùng đồng ý.

Delegate to the backend when:
- Người dùng hỏi về hoặc muốn thay đổi thực đơn, công thức, nhật ký ăn uống, chỉ số cơ thể, dị ứng hay sở thích.
- Người dùng muốn xem một thứ trên màn hình.
- Câu trả lời cần số liệu (kcal, BMI, tên món) hoặc lập luận dinh dưỡng cẩn thận.
- Một lời sửa thay đổi việc đã nhờ.
- Người dùng muốn dừng, hủy hoặc hoàn tác việc vừa làm.
- Người dùng trả lời câu hỏi có cho tìm trên web không.

Do not delegate when:
- Người dùng chào hỏi, cảm ơn, hoặc nhờ nhắc lại kết quả vừa nói.
- Bạn cần hỏi lại ngắn để hiểu yêu cầu.

Delegate to the backend before giving an answer that depends on backend work.
Do not guess the result while waiting.`

/**
 * Startup greeting as a `developer` message in `session.input`, as the GPT-Live guide
 * recommends: the language, what to say, then pause and listen. With a name, the
 * greeting uses it the way Vietnamese speakers would.
 */
function voiceGreeting(fullName: string | undefined) {
  const name = fullName?.trim()
  if (!name) {
    return "Chào người dùng ngay bằng tiếng Việt. Giới thiệu bạn là trợ lý Vedora và hỏi bạn có thể giúp gì cho thực đơn. Rồi dừng lại và lắng nghe."
  }
  return `Chào người dùng ngay bằng tiếng Việt, gọi họ bằng tên. Họ tên của họ là "${name}"; gọi bằng tên gọi như người Việt vẫn gọi nhau (với tên tiếng Việt thường là chữ cuối của họ tên). Giới thiệu bạn là trợ lý Vedora và hỏi bạn có thể giúp gì cho thực đơn. Rồi dừng lại và lắng nghe.`
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

const showRecipeOutputSchema = z.object({
  shown: z.boolean(),
  recipeId: z.string(),
  title: z.string().nullable(),
})

const openEatingLogOutputSchema = z.object({ date: z.string().nullable() })

const logMealOutputSchema = z.object({ entry: z.object({ date: z.string() }) })

const undoOutputSchema = z.object({
  weeks: z.array(z.object({ weekStart: z.string(), restored: z.array(z.enum(WEEKDAYS)) })),
})

/** The part of the existing planner UI the voice agent points at and opens. */
export type VoiceFocus =
  | { kind: "recipe"; recipeId: string; title: string }
  | { kind: "eatingLog"; date: string | null }
  | { kind: "bodyMetrics" }
  | { kind: "planDay"; weekStart: string; day: Weekday }

/** One request to point at something, so the same focus can be asked for twice. */
export type VoiceFocusRequest<T> = T & { nonce: number; at: number }

/** A focus request older than this is from before a remount, not a fresh one. */
export const VOICE_FOCUS_TTL_MS = 4000
/** How long the target glows before the agent "clicks" it. */
export const VOICE_POINT_MS = 700
/** How long the target keeps glowing in total. */
export const VOICE_GLOW_MS = 1800

/** The 7-color rainbow glow around whatever the voice agent is acting on or about to open. */
export const VOICE_HIGHLIGHT = "voice-ai-glow z-30"

export function isFreshFocus(request: { at: number } | undefined) {
  if (!request) return false
  return Date.now() - request.at < VOICE_FOCUS_TTL_MS
}

const PLAN_TOOLS = new Set(["fillSlots", "editPlan", "autoBalancePlan", "verifyMealPlanAllergies"])
const DIETARY_NOTE_TOOLS = new Set(["updatePreferences", "updateAllergyNote"])

export type VoiceEffects = {
  /** What to open on screen: the last panel a tool asked for, else the last changed day. */
  focus: VoiceFocus | null
  planChanged: boolean
  logChanged: boolean
  nutritionChanged: boolean
  dietaryChanged: boolean
}

/** What a turn's finished tools mean for the page: what to open and which caches to refresh. */
export function voiceEffects(actions: VoiceAction[]): VoiceEffects {
  const effects: VoiceEffects = {
    focus: null,
    planChanged: false,
    logChanged: false,
    nutritionChanged: false,
    dietaryChanged: false,
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
    if (action.tool === "showRecipe") {
      const output = showRecipeOutputSchema.safeParse(action.output)
      if (output.success && output.data.shown && output.data.title !== null) {
        effects.focus = { kind: "recipe", recipeId: output.data.recipeId, title: output.data.title }
      }
      continue
    }
    if (action.tool === "openEatingLog") {
      const output = openEatingLogOutputSchema.safeParse(action.output)
      if (output.success) effects.focus = { kind: "eatingLog", date: output.data.date }
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
      continue
    }
    if (action.tool === "showBodyMetrics") {
      effects.focus = { kind: "bodyMetrics" }
    }
  }
  if (effects.focus === null) effects.focus = changedDay
  return effects
}
