import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  FarewellTracker,
  TRANSCRIPT_SETTLE_MS,
  TurnQueue,
  UtteranceAssembler,
  VoiceCallLedger,
} from "@/features/meal-plan/voice-call"

function words(assembler: UtteranceAssembler, fragments: [text: string, startMs: number, endMs: number][]) {
  for (const [text, startMs, endMs] of fragments) assembler.addFragment({ text, startMs, endMs })
}

describe("UtteranceAssembler.takeUtterance", () => {
  it("joins the words around the delegation point, trailing words included", () => {
    const assembler = new UtteranceAssembler()
    words(assembler, [
      ["trưa nay", 0, 600],
      [" mình ăn", 700, 1200],
      [" phở chay", 1300, 2000],
    ])
    expect(assembler.takeUtterance(800)).toBe("trưa nay mình ăn phở chay")
  })

  it("leaves words after a long pause for the next delegation", () => {
    const assembler = new UtteranceAssembler()
    words(assembler, [
      ["xin chào", 0, 800],
      ["đổi bữa tối", 5000, 6000],
    ])
    expect(assembler.takeUtterance(100)).toBe("xin chào")
    expect(assembler.takeUtterance(5200)).toBe("đổi bữa tối")
  })

  it("does not hand out words twice, and gives nothing without words", () => {
    const assembler = new UtteranceAssembler()
    expect(assembler.takeUtterance(undefined)).toBe("")
    words(assembler, [["ừ", 0, 300]])
    expect(assembler.takeUtterance(undefined)).toBe("ừ")
    expect(assembler.takeUtterance(undefined)).toBe("")
  })
})

describe("UtteranceAssembler.utteranceReady", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("waits while the transcript has not reached the delegation point", () => {
    const assembler = new UtteranceAssembler()
    expect(assembler.utteranceReady(500, Date.now() + 5000)).toBe(false)
    words(assembler, [["thêm đậu hũ.", 0, 400]])
    expect(assembler.utteranceReady(500, Date.now() + 5000)).toBe(false)
  })

  it("takes a finished sentence at once", () => {
    const assembler = new UtteranceAssembler()
    words(assembler, [["thêm đậu hũ vào tối thứ bảy.", 0, 1200]])
    expect(assembler.utteranceReady(1000, Date.now())).toBe(true)
    words(assembler, [[" Được không?", 1300, 1800]])
    expect(assembler.utteranceReady(1000, Date.now())).toBe(true)
  })

  it("waits for a short pause when the sentence is not finished", () => {
    const assembler = new UtteranceAssembler()
    words(assembler, [["thêm đậu hũ vào tối thứ", 0, 1200]])
    expect(assembler.utteranceReady(1000, Date.now() + TRANSCRIPT_SETTLE_MS - 1)).toBe(false)
    expect(assembler.utteranceReady(1000, Date.now() + TRANSCRIPT_SETTLE_MS)).toBe(true)
  })

  it("needs some words even without a delegation point", () => {
    const assembler = new UtteranceAssembler()
    expect(assembler.utteranceReady(undefined, Date.now() + 5000)).toBe(false)
    words(assembler, [["ừ", 0, 200]])
    expect(assembler.utteranceReady(undefined, Date.now() + TRANSCRIPT_SETTLE_MS)).toBe(true)
  })
})

describe("UtteranceAssembler.waitForUtterance", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("resolves immediately when an arriving fragment finishes a sentence", async () => {
    const assembler = new UtteranceAssembler()
    let settled: boolean | undefined
    void assembler.waitForUtterance(900, 3000).then((active) => {
      settled = active
    })

    await Promise.resolve()
    expect(settled).toBeUndefined()

    assembler.addFragment({ text: "thêm phở.", startMs: 0, endMs: 1000 })
    await Promise.resolve()
    expect(settled).toBe(true)
  })

  it("waits once for TRANSCRIPT_SETTLE_MS when the sentence has no end punctuation", async () => {
    const assembler = new UtteranceAssembler()
    let settled: boolean | undefined
    void assembler.waitForUtterance(500, 3000).then((active) => {
      settled = active
    })

    assembler.addFragment({ text: "thêm phở", startMs: 0, endMs: 600 })
    await vi.advanceTimersByTimeAsync(TRANSCRIPT_SETTLE_MS - 1)
    expect(settled).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
  })

  it("resolves false cleanly when endCall stops a pending wait", async () => {
    const ledger = new VoiceCallLedger()
    const waiting = ledger.utterances.waitForUtterance(500, 3000)
    ledger.endCall()
    await expect(waiting).resolves.toBe(false)
  })
})

describe("TurnQueue", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("runs tasks in order, and a failed task does not stop the ones after it", async () => {
    const turns = new TurnQueue()
    const ran: string[] = []
    turns.enqueue(async () => {
      ran.push("first")
      throw new Error("Realtime session is not accepting submissions")
    })
    turns.enqueue(async () => {
      ran.push("second")
    })
    await turns.idle()
    expect(ran).toEqual(["first", "second"])
  })

  it("drops what was queued when the call ends, and runs the next call's tasks", async () => {
    const ledger = new VoiceCallLedger()
    const ran: string[] = []
    let release = () => {}
    ledger.turns.enqueue(() => new Promise<void>((resolve) => (release = resolve)))
    ledger.turns.enqueue(async () => {
      ran.push("queued before the call ended")
    })
    ledger.endCall()
    release()
    await ledger.turns.idle()

    ledger.reset()
    ledger.turns.enqueue(async () => {
      ran.push("next call")
    })
    await ledger.turns.idle()
    expect(ran).toEqual(["next call"])
  })

  it("stops the running delegation when the call ends", () => {
    const ledger = new VoiceCallLedger()
    const controller = ledger.turns.begin("item_1", "thêm đậu hũ vào thứ bảy")
    ledger.endCall()
    expect(controller.signal.aborted).toBe(true)
    expect(ledger.turns.running()).toBeNull()
  })
})

describe("FarewellTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function advance(ms: number) {
    vi.setSystemTime(Date.now() + ms)
  }

  it("is never done before a farewell was sent", () => {
    const tracker = new FarewellTracker()
    advance(60_000)
    expect(tracker.done(false)).toBe(false)
  })

  it("waits for the farewell to start, then ends once its audio has had time to play", () => {
    const tracker = new FarewellTracker()
    tracker.sent()
    advance(1000)
    expect(tracker.done(false)).toBe(false)

    tracker.spoke(10_000, 11_000)
    tracker.spoke(11_000, 12_000)
    // Two seconds of audio from when it started arriving, plus the pause after speech.
    advance(2599)
    expect(tracker.done(false)).toBe(false)
    advance(1)
    expect(tracker.done(false)).toBe(true)
  })

  it("ends as soon as the player stops after it was heard playing", () => {
    const tracker = new FarewellTracker()
    tracker.sent()
    tracker.spoke(0, 10_000)
    advance(700)
    expect(tracker.done(true)).toBe(false)
    expect(tracker.done(false)).toBe(true)
  })

  it("hangs up after the safety limit even if GPT-Live never says goodbye", () => {
    const tracker = new FarewellTracker()
    tracker.sent()
    advance(19_999)
    expect(tracker.done(false)).toBe(false)
    advance(1)
    expect(tracker.done(false)).toBe(true)
  })

  it("stays open once reset, when the user keeps talking", () => {
    const tracker = new FarewellTracker()
    tracker.sent()
    tracker.reset()
    advance(30_000)
    expect(tracker.done(false)).toBe(false)
  })
})
