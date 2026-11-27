import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { PlannerStateEvent } from "@/features/meal-plan/lib/planner-state-protocol"
import { readScrollState } from "@/features/meal-plan/lib/scroll"
import {
  appendableText,
  plainSpokenText,
  VOICE_QUOTA_STATUS,
  VOICE_SESSION_ROUTE,
  voiceErrorText,
  voiceRecipeContext,
  voiceSessionConfig,
  voiceSessionRoute,
} from "@/features/meal-plan/voice/voice-session"
import {
  streamVoiceTurn,
  type VoiceScreenCommand,
  type VoiceTurnEvent,
} from "@/features/meal-plan/voice/voice-stream"
import { FarewellTracker, TurnQueue, VoiceCallLedger } from "@/features/meal-plan/voice/voice-call"
import {
  handleDelegation,
  OUTDATED_RESULT_NOTE,
  reviseTurn,
  runVoiceTurn,
  SUPERSEDED_NOTE,
  supersededNote,
  type QueueTurn,
} from "@/features/meal-plan/voice/voice-turn-runner"
import { ApiError } from "@/features/shared/lib/api-client"

describe("voiceErrorText", () => {
  it("explains setup failures by their status", () => {
    expect(voiceErrorText(`Failed to fetch realtime setup: ${VOICE_QUOTA_STATUS}`)).toContain("hết lượt")
    expect(voiceErrorText("Failed to fetch realtime setup: 429")).toContain("hơi nhanh")
    expect(voiceErrorText("Failed to fetch realtime setup: 401")).toContain("Phiên đăng nhập")
    expect(voiceErrorText("Failed to fetch realtime setup: 403")).toContain("Pro còn hiệu lực")
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
    expect(JSON.stringify(openai)).toContain('full name: \\"Nguyễn Văn An\\"')
    expect(config.instructions).toContain("Delegation policy:")
  })

  it("greets without a name when there is none", () => {
    expect(JSON.stringify(voiceSessionConfig(undefined).providerOptions)).not.toContain("full name")
  })

  it("appends threadId to the session route when provided", () => {
    expect(voiceSessionRoute()).toBe(VOICE_SESSION_ROUTE)
    expect(voiceSessionRoute("thread-1")).toBe(`${VOICE_SESSION_ROUTE}?threadId=thread-1`)
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

describe("readScrollState", () => {
  it("reads live scroll position of a scrollable container", () => {
    const fakeEl = { scrollTop: 500, scrollHeight: 1500, clientHeight: 500 } as HTMLElement
    expect(readScrollState(fakeEl)).toEqual({ percent: 50, atTop: false, atBottom: false })
    const fitEl = { scrollTop: 0, scrollHeight: 400, clientHeight: 500 } as HTMLElement
    expect(readScrollState(fitEl)).toEqual({ percent: 0, atTop: true, atBottom: true })
  })
})

function sse(chunks: unknown[], status = 200) {
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n"
  return new Response(body, { status, headers: { "Content-Type": "text/event-stream" } })
}

describe("streamVoiceTurn", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const request = { weekStart: "2026-11-23", message: "thêm phở vào thứ bảy", requestId: "item_1" }

  async function collect(turn: AsyncGenerator<VoiceTurnEvent>) {
    const events: VoiceTurnEvent[] = []
    for await (const event of turn) events.push(event)
    return events
  }

  it("posts the turn with the token and yields data parts, text deltas, and ready", async () => {
    const fetchMock = vi.fn(async () =>
      sse([
        { type: "start", messageId: "msg_1" },
        { type: "data-state", data: { invalidate: ["plan", "shoppingList"] }, transient: true },
        {
          type: "data-screen",
          data: { focus: { kind: "planDay", weekStart: "2026-11-23", day: "SAT" }, close: null },
          transient: true,
        },
        { type: "data-progress", data: { text: "Đã lưu thay đổi thực đơn cho Thứ Bảy, đang làm tiếp." }, transient: true },
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: "Đã thêm phở." },
        { type: "text-end", id: "t1" },
        { type: "finish", messageMetadata: { voiceDone: true } },
      ])
    )
    vi.stubGlobal("fetch", fetchMock)

    const events = await collect(streamVoiceTurn("token_1", request, new AbortController().signal))

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("http://api.test/api/v1/meal-plan/voice/turns")
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token_1")
    expect(JSON.parse(String(init.body))).toEqual(request)

    expect(events).toEqual([
      { type: "started" },
      { type: "state", state: { invalidate: ["plan", "shoppingList"] } },
      { type: "screen", screen: { focus: { kind: "planDay", weekStart: "2026-11-23", day: "SAT" }, close: null } },
      { type: "progress", text: "Đã lưu thay đổi thực đơn cho Thứ Bảy, đang làm tiếp." },
      { type: "text", delta: "Đã thêm phở." },
      { type: "ready" },
    ])
  })

  it("yields ready immediately on finish before the stream closes", async () => {
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

    const seen: VoiceTurnEvent[] = []
    for await (const event of turn) {
      seen.push(event)
      if (event.type === "ready") controller.close()
    }
    expect(seen).toContainEqual({ type: "text", delta: "Đã xong." })
    expect(seen).toContainEqual({ type: "ready" })
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

  it("parses shoppingList expandItems and collapseItems in data-screen", async () => {
    vi.stubGlobal("fetch", async () =>
      sse([
        { type: "start", messageId: "msg_1" },
        {
          type: "data-screen",
          data: {
            focus: {
              kind: "shoppingList",
              expandItems: ["đậu phụ"],
              collapseItems: ["cà chua"],
            },
            close: null,
          },
          transient: true,
        },
        { type: "finish" },
      ])
    )
    const events = await collect(streamVoiceTurn("token_1", request, new AbortController().signal))
    expect(events).toContainEqual({
      type: "screen",
      screen: {
        focus: {
          kind: "shoppingList",
          expandItems: ["đậu phụ"],
          collapseItems: ["cà chua"],
        },
        close: null,
      },
    })
  })
})

describe("runVoiceTurn", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("dispatches screen/state/end-call events and falls back to summary when text is empty", async () => {
    const turns = new TurnQueue()
    const farewell = new FarewellTracker()
    const appended: [string, "thinking" | "commentary", string][] = []
    const screens: VoiceScreenCommand[] = []
    const states: PlannerStateEvent[] = []
    const pendingDeltas: number[] = []
    let endingCalled = false
    let endedThread: string | null = null

    await runVoiceTurn({
      delegationId: "del_1",
      message: "tạm biệt nhé",
      accessToken: "tok",
      weekStart: "2026-11-23",
      threadId: "thread_1",
      screen: undefined,
      turns,
      farewell,
      append: async (id, ch, text) => {
        appended.push([id, ch, text])
      },
      hasNewSpeech: () => false,
      onRevise: vi.fn(),
      onScreen: (s) => screens.push(s),
      onState: (s) => states.push(s),
      onAbortInvalidate: vi.fn(),
      onPendingChange: (d) => pendingDeltas.push(d),
      onEnding: () => {
        endingCalled = true
      },
      onTurnEnd: (t) => {
        endedThread = t
      },
      streamTurn: async function* () {
        yield { type: "started" }
        yield { type: "state", state: { invalidate: ["plan"] } }
        yield { type: "screen", screen: { focus: { kind: "bodyMetrics" }, close: null } }
        yield { type: "end-call" }
        yield { type: "summary", text: "Người dùng muốn kết thúc cuộc gọi, hãy chào tạm biệt ngắn gọn." }
        yield { type: "ready" }
      },
    })

    expect(states).toEqual([{ invalidate: ["plan"] }])
    expect(screens).toEqual([{ focus: { kind: "bodyMetrics" }, close: null }])
    expect(endingCalled).toBe(true)
    expect(farewell.phase).toBe("sent")
    expect(appended).toEqual([
      ["del_1", "commentary", "Người dùng muốn kết thúc cuộc gọi, hãy chào tạm biệt ngắn gọn."],
    ])
    expect(pendingDeltas).toEqual([1, -1])
    expect(endedThread).toBe("thread_1")
  })

  it("passes progress as thinking only and invalidates all on abort", async () => {
    const turns = new TurnQueue()
    const farewell = new FarewellTracker()
    const appended: [string, "thinking" | "commentary", string][] = []
    const onAbortInvalidate = vi.fn()

    let release: (() => void) | undefined
    const running = runVoiceTurn({
      delegationId: "del_2",
      message: "lên thực đơn cả tuần",
      accessToken: "tok",
      weekStart: "2026-11-23",
      threadId: "thread_1",
      screen: undefined,
      turns,
      farewell,
      append: async (id, ch, text) => {
        appended.push([id, ch, text])
      },
      hasNewSpeech: () => false,
      onRevise: vi.fn(),
      onScreen: vi.fn(),
      onState: vi.fn(),
      onAbortInvalidate,
      onPendingChange: vi.fn(),
      onEnding: vi.fn(),
      onTurnEnd: vi.fn(),
      streamTurn: async function* (_token, _req, signal) {
        yield { type: "started" }
        await new Promise((resolve) => setTimeout(resolve, 10_000))
        yield { type: "progress", text: "Đã lưu thay đổi thực đơn cho Thứ Hai, đang làm tiếp." }
        await new Promise<void>((resolve, reject) => {
          release = resolve
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        })
      },
    })

    await vi.advanceTimersByTimeAsync(30_000)
    expect(appended).toEqual([["del_2", "thinking", "Đã lưu thay đổi thực đơn cho Thứ Hai, đang làm tiếp."]])

    turns.cancel()
    release?.()
    await running
    expect(onAbortInvalidate).toHaveBeenCalledTimes(1)
  })

  it("does not deliver commentary when aborted right before ready", async () => {
    const turns = new TurnQueue()
    const farewell = new FarewellTracker()
    const appended: [string, "thinking" | "commentary", string][] = []

    await runVoiceTurn({
      delegationId: "del_3",
      message: "gợi ý cả tuần",
      accessToken: "tok",
      weekStart: "2026-11-23",
      threadId: "thread_1",
      screen: undefined,
      turns,
      farewell,
      append: async (id, ch, text) => {
        appended.push([id, ch, text])
      },
      hasNewSpeech: () => false,
      onRevise: vi.fn(),
      onScreen: vi.fn(),
      onState: vi.fn(),
      onAbortInvalidate: vi.fn(),
      onPendingChange: vi.fn(),
      onEnding: vi.fn(),
      onTurnEnd: vi.fn(),
      streamTurn: async function* () {
        yield { type: "started" }
        yield { type: "text", delta: "Thực đơn cũ" }
        turns.cancel()
        yield { type: "ready" }
      },
    })

    expect(appended).toEqual([])
  })
})

describe("updated requests while a turn runs", () => {
  type Appended = [string | null, "thinking" | "commentary", string]

  function turnOptions(overrides: Partial<Parameters<typeof runVoiceTurn>[0]>) {
    return {
      delegationId: "del_1",
      message: "lên thực đơn cả tuần",
      accessToken: "tok",
      weekStart: "2026-11-23",
      threadId: "thread_1",
      screen: undefined,
      turns: new TurnQueue(),
      farewell: new FarewellTracker(),
      append: async () => {},
      hasNewSpeech: () => false,
      onRevise: vi.fn(),
      onScreen: vi.fn(),
      onState: vi.fn(),
      onAbortInvalidate: vi.fn(),
      onPendingChange: vi.fn(),
      onEnding: vi.fn(),
      onTurnEnd: vi.fn(),
      ...overrides,
    }
  }

  it("keeps a result out of commentary and revises when the user spoke after delegating", async () => {
    const appended: Appended[] = []
    const onRevise = vi.fn()
    const onEnding = vi.fn()
    const farewell = new FarewellTracker()

    await runVoiceTurn(
      turnOptions({
        farewell,
        append: async (id, ch, text) => {
          appended.push([id, ch, text])
        },
        hasNewSpeech: () => true,
        onRevise,
        onEnding,
        streamTurn: async function* () {
          yield { type: "end-call" }
          yield { type: "text", delta: "Kết quả cũ" }
          yield { type: "ready" }
        },
      })
    )

    expect(appended).toEqual([["del_1", "thinking", `${OUTDATED_RESULT_NOTE} Kết quả cũ`]])
    expect(onRevise).toHaveBeenCalledTimes(1)
    expect(onEnding).not.toHaveBeenCalled()
    expect(farewell.phase).toBe("idle")
  })

  it("starts a revision with everything said since the delegation", async () => {
    const ledger = new VoiceCallLedger()
    const queued: Parameters<QueueTurn>[0][] = []
    const queueTurn: QueueTurn = async (turn) => {
      queued.push(turn)
    }

    ledger.utterances.addFragment({ text: "chỉ bữa sáng thôi", startMs: 0, endMs: 900 })
    reviseTurn("del_1", { ledger, queueTurn })
    await ledger.turns.idle()

    expect(queued).toEqual([{ delegationId: "del_1", message: "chỉ bữa sáng thôi", revision: true }])
  })

  it("lets a later delegation take the words instead of a queued revision", async () => {
    const ledger = new VoiceCallLedger()
    const queued: Parameters<QueueTurn>[0][] = []
    const queueTurn: QueueTurn = async (turn) => {
      queued.push(turn)
    }

    ledger.utterances.addFragment({ text: "đổi bữa tối", startMs: 0, endMs: 900 })
    reviseTurn("del_1", { ledger, queueTurn })
    await handleDelegation("del_2", { ledger, append: async () => {}, queueTurn })
    await ledger.turns.idle()

    expect(queued).toEqual([{ delegationId: "del_2", message: "đổi bữa tối", revision: false }])
  })

  it("carries the words of a cancelled revision into the delegation that replaces it", async () => {
    const ledger = new VoiceCallLedger()
    const appended: Appended[] = []
    const queued: Parameters<QueueTurn>[0][] = []
    ledger.turns.begin("del_1", "chỉ bữa sáng thôi", true)

    await handleDelegation("del_2", {
      ledger,
      append: async (id, ch, text) => {
        appended.push([id, ch, text])
      },
      queueTurn: async (turn) => {
        queued.push(turn)
      },
    })
    await ledger.turns.idle()

    expect(appended).toEqual([["del_1", "thinking", SUPERSEDED_NOTE]])
    expect(queued).toEqual([{ delegationId: "del_2", message: "chỉ bữa sáng thôi", revision: false }])
  })
})

describe("supersededNote", () => {
  it("tells the model what was saved before a cancelled turn stopped", async () => {
    const ledger = new VoiceCallLedger()
    const appended: [string | null, "thinking" | "commentary", string][] = []
    ledger.turns.begin("del_1", "lên thực đơn cả tuần")
    ledger.turns.recordSaved("del_1", "Đã lưu thay đổi thực đơn cho Thứ Hai, đang làm tiếp.")
    ledger.utterances.addFragment({ text: "thôi dừng lại", startMs: 0, endMs: 600 })

    await handleDelegation("del_2", {
      ledger,
      append: async (id, ch, text) => {
        appended.push([id, ch, text])
      },
      queueTurn: async () => {},
    })

    expect(appended).toEqual([
      ["del_1", "thinking", supersededNote(["Đã lưu thay đổi thực đơn cho Thứ Hai, đang làm tiếp."])],
    ])
    expect(appended[0][2]).toContain("Đã lưu thay đổi thực đơn cho Thứ Hai")
  })

  it("stays neutral when no saved change was reported", () => {
    expect(supersededNote([])).toBe(SUPERSEDED_NOTE)
  })
})

describe("plainSpokenText", () => {
  it("drops display formatting but keeps every word and number", () => {
    const markdown = "## Tuần sau\n\n- **Calo:** khoảng 1.730 kcal\n2. Giữ `nguyên` thực đơn\n* _ít dầu_"
    expect(plainSpokenText(markdown)).toBe("Tuần sau Calo: khoảng 1.730 kcal Giữ nguyên thực đơn _ít dầu_")
  })

  it("leaves plain sentences unchanged", () => {
    expect(plainSpokenText("Mình đã đổi bữa tối. Bạn xem nhé.")).toBe("Mình đã đổi bữa tối. Bạn xem nhé.")
  })
})
