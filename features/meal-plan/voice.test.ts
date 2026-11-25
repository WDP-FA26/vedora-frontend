import type { UIMessage } from "ai"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  actionSummary,
  appendableText,
  classifyInterruption,
  finishedActions,
  isVoiceReplyReady,
  progressLine,
  replyText,
  streamVoiceTurn,
  VOICE_QUOTA_STATUS,
  voiceEffects,
  voiceErrorText,
  voiceRecipeContext,
  voiceSessionConfig,
  type VoiceAction,
} from "@/features/meal-plan/voice"
import { ApiError } from "@/features/shared/lib/api-client"

type Part = UIMessage["parts"][number]

function message(parts: Part[]): UIMessage {
  return { id: "msg_1", role: "assistant", parts }
}

function toolPart(tool: string, state: "input-available" | "output-available", input: unknown, output?: unknown): Part {
  if (state === "output-available") {
    return { type: `tool-${tool}`, toolCallId: `call_${tool}`, state, input, output }
  }
  return { type: `tool-${tool}`, toolCallId: `call_${tool}`, state, input }
}

function action(tool: string, output: unknown): VoiceAction {
  return { toolCallId: `call_${tool}`, tool, input: {}, output }
}

const planChange = (days: string[], applied = true) => ({
  weekStart: "2026-11-23",
  applied,
  days: days.map((day) => ({ day, sections: [] })),
})

const screen = (view: string, extra: Record<string, unknown> = {}) => ({
  applied: true,
  view,
  recipeId: null,
  title: null,
  section: null,
  weekStart: null,
  day: null,
  date: null,
  ...extra,
})

describe("voiceErrorText", () => {
  it("explains setup failures by their status", () => {
    expect(voiceErrorText(`Failed to fetch realtime setup: ${VOICE_QUOTA_STATUS}`)).toContain("hết lượt")
    expect(voiceErrorText("Failed to fetch realtime setup: 429")).toContain("hơi nhanh")
    expect(voiceErrorText("Failed to fetch realtime setup: 401")).toContain("Phiên đăng nhập")
    expect(voiceErrorText("Failed to fetch realtime setup: 503")).toContain("tạm ngưng")
    expect(voiceErrorText("Failed to fetch realtime setup: 500")).toContain("Chưa kết nối được")
  })

  it("passes other SDK errors through", () => {
    expect(voiceErrorText("WebSocket closed")).toBe("WebSocket closed")
  })
})

describe("appendableText", () => {
  it("keeps short text and trims long text to one append", () => {
    expect(appendableText("Đã xong.")).toBe("Đã xong.")
    expect(appendableText("a".repeat(5000))).toHaveLength(1200)
  })
})

describe("voiceSessionConfig", () => {
  it("delegates to the client and greets the user by name", () => {
    const config = voiceSessionConfig("  Nguyễn Văn An ")
    const openai = config.providerOptions?.openai
    expect(openai).toMatchObject({ delegation: { type: "client" } })
    expect(JSON.stringify(openai)).toContain('họ tên: \\"Nguyễn Văn An\\"')
    expect(config.instructions).toContain("Delegation policy:")
  })

  it("greets without a name when there is none", () => {
    expect(JSON.stringify(voiceSessionConfig(undefined).providerOptions)).not.toContain("họ tên")
  })
})

describe("voiceRecipeContext", () => {
  it("summarises the open recipe with amounts, notes and numbered steps", () => {
    const text = voiceRecipeContext({
      id: "r1",
      title: "Đậu hũ sốt cà",
      servings: 2,
      ingredients: [
        { name: "đậu hũ", quantity: 300, unit: "g", note: "để ráo" },
        { name: "muối", quantity: null, unit: null, note: null },
      ],
      steps: ["Chiên đậu.", "Sốt cà."],
    })
    expect(text).toBe(
      'Màn hình đang mở công thức "Đậu hũ sốt cà" (2 khẩu phần).\nNguyên liệu: 300 g đậu hũ (để ráo), muối.\nCác bước: 1. Chiên đậu. 2. Sốt cà.'
    )
  })
})

describe("reading a voice reply", () => {
  const reply = message([
    { type: "text", text: "Mình đã thêm" },
    toolPart("fillSlots", "output-available", { day: "SAT" }, planChange(["SAT"])),
    toolPart("logMeal", "input-available", { name: "phở" }),
    { type: "text", text: "món cho thứ Bảy." },
  ])

  it("lists only finished tools, in order", () => {
    expect(finishedActions(reply)).toEqual([
      { toolCallId: "call_fillSlots", tool: "fillSlots", input: { day: "SAT" }, output: planChange(["SAT"]) },
    ])
  })

  it("joins the text parts into the spoken reply", () => {
    expect(replyText(reply)).toBe("Mình đã thêm món cho thứ Bảy.")
  })
})

describe("actionSummary", () => {
  it("builds a concise factual line for quick screen and endCall actions", () => {
    expect(actionSummary([action("endCall", { ended: true })])).toContain("tạm biệt")
    expect(
      actionSummary([action("setScreen", screen("recipe", { recipeId: "r1", title: "Phở chay", section: "steps" }))])
    ).toBe('Đã mở công thức "Phở chay" trên màn hình, ở phần cách làm.')
    expect(actionSummary([action("setScreen", screen("eatingLog", { date: "2026-11-25" }))])).toBe(
      "Đã mở nhật ký ăn uống ngày 2026-11-25 trên màn hình."
    )
    expect(
      actionSummary([
        action("setScreen", screen("bodyMetrics", { metrics: { weightKg: 58, bmi: 21.4, dailyCalorieTarget: 1800 } })),
      ])
    ).toBe("Đã mở bảng chỉ số cơ thể trên màn hình (cân nặng 58 kg, BMI 21.4, mục tiêu khoảng 1800 kcal mỗi ngày).")
    expect(actionSummary([action("setScreen", screen("calendar", { day: "FRI" }))])).toBe(
      "Đã đóng bảng và chuyển lịch tới Thứ Sáu."
    )
  })

  it("returns null when no screen action was applied", () => {
    expect(actionSummary([action("setScreen", { ...screen("recipe"), applied: false })])).toBeNull()
  })
})

describe("progressLine", () => {
  it("names the days of a saved plan change", () => {
    expect(progressLine(action("editPlan", planChange(["MON", "SUN"])))).toBe(
      "Đã lưu thay đổi thực đơn cho Thứ Hai, Chủ nhật, đang làm tiếp."
    )
  })

  it("says nothing for a change that was not applied, or a read-only tool", () => {
    expect(progressLine(action("editPlan", planChange(["MON"], false)))).toBeNull()
    expect(progressLine(action("setScreen", screen("bodyMetrics")))).toBeNull()
  })

  it("has a line for each write tool", () => {
    expect(progressLine(action("logMeal", {}))).toContain("nhật ký")
    expect(progressLine(action("updateBodyMetrics", {}))).toContain("chỉ số")
    expect(progressLine(action("undoLastChange", {}))).toContain("hoàn tác")
  })
})

describe("voiceEffects", () => {
  it("does nothing for no tools", () => {
    expect(voiceEffects([])).toEqual({
      focus: null,
      close: null,
      planChanged: false,
      logChanged: false,
      nutritionChanged: false,
      dietaryChanged: false,
      endCall: false,
    })
  })

  it("refreshes the plan and opens the last changed day", () => {
    const effects = voiceEffects([action("fillSlots", planChange(["TUE"])), action("editPlan", planChange(["FRI"]))])
    expect(effects.planChanged).toBe(true)
    expect(effects.focus).toEqual({ kind: "planDay", weekStart: "2026-11-23", day: "FRI" })
  })

  it("refreshes but does not move for a plan change that was not applied", () => {
    const effects = voiceEffects([action("editPlan", planChange(["FRI"], false))])
    expect(effects.planChanged).toBe(true)
    expect(effects.focus).toBeNull()
  })

  it("prefers a panel the agent opened over the changed day", () => {
    const effects = voiceEffects([
      action("setScreen", screen("recipe", { recipeId: "r1", title: "Phở chay", section: "steps" })),
      action("editPlan", planChange(["FRI"])),
    ])
    expect(effects.focus).toEqual({ kind: "recipe", recipeId: "r1", title: "Phở chay", section: "steps" })
  })

  it("closes panels and shows the week for the calendar view", () => {
    const effects = voiceEffects([action("setScreen", screen("calendar", { weekStart: "2026-11-30", day: "WED" }))])
    expect(effects.close).toBe("all")
    expect(effects.focus).toEqual({ kind: "planDay", weekStart: "2026-11-30", day: "WED" })
  })

  it("ignores a screen change the API refused or that does not parse", () => {
    expect(voiceEffects([action("setScreen", { ...screen("bodyMetrics"), applied: false })]).focus).toBeNull()
    expect(voiceEffects([action("setScreen", screen("recipe"))]).focus).toBeNull()
    expect(voiceEffects([action("setScreen", { view: "somewhere" })]).focus).toBeNull()
  })

  it("opens the eating log on the logged day and refreshes it", () => {
    const effects = voiceEffects([action("logMeal", { entry: { date: "2026-11-25" } })])
    expect(effects.logChanged).toBe(true)
    expect(effects.focus).toEqual({ kind: "eatingLog", date: "2026-11-25" })
  })

  it("shows body metrics after updating them", () => {
    const effects = voiceEffects([action("updateBodyMetrics", { bmi: 21 })])
    expect(effects.nutritionChanged).toBe(true)
    expect(effects.focus).toEqual({ kind: "bodyMetrics" })
  })

  it("goes to the first restored day after an undo", () => {
    const effects = voiceEffects([
      action("undoLastChange", { weeks: [{ weekStart: "2026-11-23", restored: ["THU", "FRI"] }] }),
    ])
    expect(effects.planChanged).toBe(true)
    expect(effects.focus).toEqual({ kind: "planDay", weekStart: "2026-11-23", day: "THU" })
  })

  it("marks memory updates and the end of the call", () => {
    const effects = voiceEffects([action("updateMemory", {}), action("endCall", { ended: true })])
    expect(effects.dietaryChanged).toBe(true)
    expect(effects.endCall).toBe(true)
  })
})

/** A UI message stream response, as `POST /meal-plan/voice/turns` sends it. */
function sse(chunks: unknown[], status = 200) {
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n"
  return new Response(body, { status, headers: { "Content-Type": "text/event-stream" } })
}

describe("streamVoiceTurn", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const request = { weekStart: "2026-11-23", message: "thêm phở vào thứ bảy", requestId: "item_1" }

  async function collect(turn: AsyncGenerator<UIMessage>) {
    const updates: UIMessage[] = []
    for await (const update of turn) updates.push(update)
    return updates
  }

  it("posts the turn with the token and yields the reply as it grows", async () => {
    const fetchMock = vi.fn(async () =>
      sse([
        { type: "start", messageId: "msg_1" },
        { type: "tool-input-available", toolCallId: "call_1", toolName: "fillSlots", input: { day: "SAT" } },
        { type: "tool-output-available", toolCallId: "call_1", output: planChange(["SAT"]) },
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: "Đã thêm phở." },
        { type: "text-end", id: "t1" },
        { type: "finish" },
      ])
    )
    vi.stubGlobal("fetch", fetchMock)

    const updates = await collect(streamVoiceTurn("token_1", request, new AbortController().signal))

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("http://api.test/api/v1/meal-plan/voice/turns")
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token_1")
    expect(JSON.parse(String(init.body))).toEqual(request)

    const last = updates.at(-1)
    if (!last) throw new Error("no update")
    expect(replyText(last)).toBe("Đã thêm phở.")
    expect(finishedActions(last).map(({ tool }) => tool)).toEqual(["fillSlots"])
    expect(isVoiceReplyReady(last)).toBe(true)
  })

  it("yields a ready reply immediately on the finish chunk before the stream closes", async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c
      },
    })
    vi.stubGlobal(
      "fetch",
      async () => new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })
    )

    const turn = streamVoiceTurn("token_1", request, new AbortController().signal)
    const push = (chunk: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
    push({ type: "start", messageId: "msg_1" })
    push({ type: "text-start", id: "t1" })
    push({ type: "text-delta", id: "t1", delta: "Đã xong." })
    push({ type: "text-end", id: "t1" })
    push({ type: "finish" })

    const ready: UIMessage[] = []
    for await (const update of turn) {
      if (isVoiceReplyReady(update)) {
        ready.push(update)
        controller.close()
      }
    }
    expect(ready).toHaveLength(1)
    expect(replyText(ready[0])).toBe("Đã xong.")
  })

  it("throws when the stream reports an error part", async () => {
    vi.stubGlobal("fetch", async () =>
      sse([{ type: "start", messageId: "msg_1" }, { type: "error", errorText: "Moderation failed" }])
    )
    await expect(collect(streamVoiceTurn("token_1", request, new AbortController().signal))).rejects.toThrow(
      "Moderation failed"
    )
  })

  it("throws the API error before streaming", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ statusCode: 429, code: "AI_QUOTA_EXCEEDED", message: "Hết lượt" }, { status: 429 })
    )
    const turn = collect(streamVoiceTurn("token_1", request, new AbortController().signal))
    await expect(turn).rejects.toBeInstanceOf(ApiError)
    await expect(turn).rejects.toMatchObject({ status: 429, code: "AI_QUOTA_EXCEEDED" })
  })
})

describe("classifyInterruption", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns the API's reading", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ action: "progress" }))
    await expect(classifyInterruption("token_1", { running: "thêm phở", utterance: "xong chưa" })).resolves.toBe(
      "progress"
    )
  })

  it("rejects an answer outside the three actions", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ action: "ignore" }))
    await expect(classifyInterruption("token_1", { running: "thêm phở", utterance: "ừ" })).rejects.toThrow()
  })
})
