import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  END_LIMIT_MS,
  END_NO_SPEECH_LIMIT_MS,
  FAREWELL_CANCEL_GRACE_MS,
  FarewellTracker,
  TurnQueue,
  UtteranceAssembler,
  VoiceCallLedger,
} from "@/features/meal-plan/voice-call"
import { GATE_HOLD_MS, VoiceNoiseGate } from "@/features/meal-plan/voice-capture"

function words(assembler: UtteranceAssembler, fragments: [text: string, startMs: number, endMs: number][]) {
  for (const [text, startMs, endMs] of fragments) assembler.addFragment({ text, startMs, endMs })
}

describe("UtteranceAssembler.takeUtterance", () => {
  it("hands over everything said since the last delegation, ordered by audio time", () => {
    const assembler = new UtteranceAssembler()
    words(assembler, [
      ["ừm", 0, 300],
      [" phở chay", 5300, 6000],
      [" lên thực đơn", 5000, 5300],
    ])
    expect(assembler.takeUtterance()).toBe("ừm lên thực đơn phở chay")
  })

  it("keeps a late fragment for the next delegation instead of dropping it", () => {
    const assembler = new UtteranceAssembler()
    words(assembler, [["đổi bữa tối", 5000, 6000]])
    expect(assembler.takeUtterance()).toBe("đổi bữa tối")
    words(assembler, [[" nhé", 6000, 6200]])
    expect(assembler.takeUtterance()).toBe("nhé")
  })

  it("does not hand out words twice, and gives nothing without words", () => {
    const assembler = new UtteranceAssembler()
    expect(assembler.takeUtterance()).toBe("")
    words(assembler, [["ừ", 0, 300]])
    expect(assembler.takeUtterance()).toBe("ừ")
    expect(assembler.takeUtterance()).toBe("")
  })
})

describe("UtteranceAssembler.waitForUtterance", () => {
  it("resolves at once when unconsumed words are already there", async () => {
    const assembler = new UtteranceAssembler()
    words(assembler, [["lên thực đơn", 0, 600], [" nhé", 600, 800]])
    await expect(assembler.waitForUtterance()).resolves.toBe(true)
  })

  it("waits for the next fragment when everything was consumed", async () => {
    const assembler = new UtteranceAssembler()
    words(assembler, [["ừ", 0, 200]])
    assembler.takeUtterance()
    let settled: boolean | undefined
    void assembler.waitForUtterance().then((active) => {
      settled = active
    })

    await Promise.resolve()
    expect(settled).toBeUndefined()

    assembler.addFragment({ text: "thêm phở", startMs: 3000, endMs: 3400 })
    await Promise.resolve()
    expect(settled).toBe(true)
  })

  it("resolves false cleanly when endCall stops a pending wait", async () => {
    const ledger = new VoiceCallLedger()
    const waiting = ledger.utterances.waitForUtterance()
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

  it("skips a queued delegation once a newer delegation claims priority", async () => {
    const turns = new TurnQueue()
    const ran: string[] = []
    let release = () => {}

    const first = turns.claimDelegation()
    turns.enqueue(() => new Promise<void>((resolve) => (release = resolve)), first)

    const second = turns.claimDelegation()
    turns.enqueue(async () => {
      ran.push("second")
    }, second)

    const third = turns.claimDelegation()
    expect(turns.isLatestDelegation(second)).toBe(false)
    expect(turns.isLatestDelegation(third)).toBe(true)
    turns.enqueue(async () => {
      ran.push("third")
    }, third)

    release()
    await turns.idle()
    expect(ran).toEqual(["third"])
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

  it("hangs up after the shorter no-speech limit if GPT-Live never says goodbye", () => {
    const tracker = new FarewellTracker()
    tracker.sent()
    advance(END_NO_SPEECH_LIMIT_MS - 1)
    expect(tracker.done(false)).toBe(false)
    advance(1)
    expect(tracker.done(false)).toBe(true)
  })

  it("hangs up after the speaking safety limit even if playback never ends", () => {
    const tracker = new FarewellTracker()
    tracker.sent()
    tracker.spoke(0, 30_000)
    advance(END_LIMIT_MS - 1)
    expect(tracker.done(true)).toBe(false)
    advance(1)
    expect(tracker.done(true)).toBe(true)
  })

  it("ignores late trailing fragments and brief goodbye replies when deciding whether to cancel", () => {
    const tracker = new FarewellTracker()
    tracker.sent()
    advance(FAREWELL_CANCEL_GRACE_MS - 100)
    expect(tracker.shouldCancel("đi nhé")).toBe(false)
    advance(200)
    expect(tracker.shouldCancel("Ok")).toBe(false)
    expect(tracker.shouldCancel("tạm biệt!")).toBe(false)
    expect(tracker.shouldCancel("cảm ơn nhé.")).toBe(false)
    expect(tracker.shouldCancel("à khoan đổi bữa tối thứ sáu")).toBe(true)
  })

  it("stays open once reset, when the user keeps talking", () => {
    const tracker = new FarewellTracker()
    tracker.sent()
    tracker.reset()
    advance(30_000)
    expect(tracker.done(false)).toBe(false)
  })
})

describe("VoiceNoiseGate", () => {
  it("blocks quiet background noise and opens for speech with hangover hold in manual mode", () => {
    const gate = new VoiceNoiseGate({ autoSensitivity: false, thresholdDb: -40 })
    expect(gate.processDb(-55, 0)).toBe(false)
    expect(gate.processDb(-41, 20)).toBe(false)
    expect(gate.processDb(-35, 40)).toBe(true)
    expect(gate.processDb(-44, 60)).toBe(true)
    expect(gate.processDb(-60, 60 + GATE_HOLD_MS - 10)).toBe(true)
    expect(gate.processDb(-60, 60 + GATE_HOLD_MS)).toBe(false)
  })

  it("adapts threshold automatically above steady ambient room noise", () => {
    const gate = new VoiceNoiseGate({ autoSensitivity: true, thresholdDb: -45 })
    let t = 0
    for (let i = 0; i < 250; i += 1) {
      t += 20
      gate.processDb(-45, t)
    }
    expect(gate.effectiveThresholdDb()).toBeGreaterThan(-45)
    expect(gate.processDb(-45, t + 1000)).toBe(false)
    expect(gate.processDb(-20, t + 1020)).toBe(true)
  })
})
