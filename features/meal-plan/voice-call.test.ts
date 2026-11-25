import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FarewellTracker, TRANSCRIPT_SETTLE_MS, VoiceCallLedger } from "@/features/meal-plan/voice-call"

function words(ledger: VoiceCallLedger, fragments: [text: string, startMs: number, endMs: number][]) {
  for (const [text, startMs, endMs] of fragments) ledger.addFragment({ text, startMs, endMs })
}

describe("VoiceCallLedger.takeUtterance", () => {
  it("joins the words around the delegation point, trailing words included", () => {
    const ledger = new VoiceCallLedger()
    words(ledger, [
      ["trưa nay", 0, 600],
      [" mình ăn", 700, 1200],
      [" phở chay", 1300, 2000],
    ])
    expect(ledger.takeUtterance(800)).toBe("trưa nay mình ăn phở chay")
  })

  it("leaves words after a long pause for the next delegation", () => {
    const ledger = new VoiceCallLedger()
    words(ledger, [
      ["xin chào", 0, 800],
      ["đổi bữa tối", 5000, 6000],
    ])
    expect(ledger.takeUtterance(100)).toBe("xin chào")
    expect(ledger.takeUtterance(5200)).toBe("đổi bữa tối")
  })

  it("does not hand out words twice, and gives nothing without words", () => {
    const ledger = new VoiceCallLedger()
    expect(ledger.takeUtterance(undefined)).toBe("")
    words(ledger, [["ừ", 0, 300]])
    expect(ledger.takeUtterance(undefined)).toBe("ừ")
    expect(ledger.takeUtterance(undefined)).toBe("")
  })
})

describe("VoiceCallLedger.utteranceReady", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("waits while the transcript has not reached the delegation point", () => {
    const ledger = new VoiceCallLedger()
    expect(ledger.utteranceReady(500, Date.now() + 5000)).toBe(false)
    words(ledger, [["thêm đậu hũ.", 0, 400]])
    expect(ledger.utteranceReady(500, Date.now() + 5000)).toBe(false)
  })

  it("takes a finished sentence at once", () => {
    const ledger = new VoiceCallLedger()
    words(ledger, [["thêm đậu hũ vào tối thứ bảy.", 0, 1200]])
    expect(ledger.utteranceReady(1000, Date.now())).toBe(true)
    words(ledger, [[" Được không?", 1300, 1800]])
    expect(ledger.utteranceReady(1000, Date.now())).toBe(true)
  })

  it("waits for a short pause when the sentence is not finished", () => {
    const ledger = new VoiceCallLedger()
    words(ledger, [["thêm đậu hũ vào tối thứ", 0, 1200]])
    expect(ledger.utteranceReady(1000, Date.now() + TRANSCRIPT_SETTLE_MS - 1)).toBe(false)
    expect(ledger.utteranceReady(1000, Date.now() + TRANSCRIPT_SETTLE_MS)).toBe(true)
  })

  it("needs some words even without a delegation point", () => {
    const ledger = new VoiceCallLedger()
    expect(ledger.utteranceReady(undefined, Date.now() + 5000)).toBe(false)
    words(ledger, [["ừ", 0, 200]])
    expect(ledger.utteranceReady(undefined, Date.now() + TRANSCRIPT_SETTLE_MS)).toBe(true)
  })
})

describe("VoiceCallLedger.waitForUtterance", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("resolves immediately when an arriving fragment finishes a sentence", async () => {
    const ledger = new VoiceCallLedger()
    let settled: boolean | undefined
    void ledger.waitForUtterance(900, 3000).then((active) => {
      settled = active
    })

    await Promise.resolve()
    expect(settled).toBeUndefined()

    ledger.addFragment({ text: "thêm phở.", startMs: 0, endMs: 1000 })
    await Promise.resolve()
    expect(settled).toBe(true)
  })

  it("waits once for TRANSCRIPT_SETTLE_MS when the sentence has no end punctuation", async () => {
    const ledger = new VoiceCallLedger()
    let settled: boolean | undefined
    void ledger.waitForUtterance(500, 3000).then((active) => {
      settled = active
    })

    ledger.addFragment({ text: "thêm phở", startMs: 0, endMs: 600 })
    await vi.advanceTimersByTimeAsync(TRANSCRIPT_SETTLE_MS - 1)
    expect(settled).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
  })

  it("resolves false cleanly when endCall stops a pending wait", async () => {
    const ledger = new VoiceCallLedger()
    const waiting = ledger.waitForUtterance(500, 3000)
    ledger.endCall()
    await expect(waiting).resolves.toBe(false)
  })
})

describe("VoiceCallLedger.enqueue", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("runs tasks in order, and a failed task does not stop the ones after it", async () => {
    const ledger = new VoiceCallLedger()
    const ran: string[] = []
    ledger.enqueue(async () => {
      ran.push("first")
      throw new Error("Realtime session is not accepting submissions")
    })
    ledger.enqueue(async () => {
      ran.push("second")
    })
    await ledger.idle()
    expect(ran).toEqual(["first", "second"])
  })

  it("drops what was queued when the call ends, and runs the next call's tasks", async () => {
    const ledger = new VoiceCallLedger()
    const ran: string[] = []
    let release = () => {}
    ledger.enqueue(() => new Promise<void>((resolve) => (release = resolve)))
    ledger.enqueue(async () => {
      ran.push("queued before the call ended")
    })
    ledger.endCall()
    release()
    await ledger.idle()

    ledger.reset()
    ledger.enqueue(async () => {
      ran.push("next call")
    })
    await ledger.idle()
    expect(ran).toEqual(["next call"])
  })

  it("stops the running delegation when the call ends", () => {
    const ledger = new VoiceCallLedger()
    const controller = ledger.begin("item_1", "thêm đậu hũ vào thứ bảy")
    ledger.endCall()
    expect(controller.signal.aborted).toBe(true)
    expect(ledger.running()).toBeNull()
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
