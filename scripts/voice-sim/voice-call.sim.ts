// Live voice-call simulation against the local API: VOICE_SIM_SCENARIO=A|B|C|D pnpm vitest run --config scripts/voice-sim/vitest.config.mts
import { createHash, randomUUID } from "node:crypto"
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { performance } from "node:perf_hooks"
import {
  createGateway,
  experimental_decodeRealtimeAudio as decodeRealtimeAudio,
  experimental_encodeRealtimeAudio as encodeRealtimeAudio,
  experimental_generateSpeech as generateSpeech,
  experimental_resampleAudio as resampleAudio,
  gateway,
  type Experimental_RealtimeClientEvent as ClientEvent,
  type Experimental_RealtimeServerEvent as ServerEvent,
} from "ai"
import { test } from "vitest"

import { appendableText, streamVoiceTurn, VOICE_MODEL_ID, voicePageContext, voiceSessionConfig } from "@/features/meal-plan/voice"
import { FarewellTracker, VoiceCallLedger } from "@/features/meal-plan/voice-call"
import { handleDelegation, reviseTurn, runVoiceTurn, type QueueTurn } from "@/features/meal-plan/voice-turn-runner"

const RATE = 24_000
const FRAME = RATE / 50
const API_URL = process.env.VOICE_SIM_API_URL ?? "http://localhost:4000/api/v1"
const API_ENV = process.env.VOICE_SIM_API_ENV ?? join(import.meta.dirname, "../../../vedora-api/.env")
const OUT_DIR = process.env.VOICE_SIM_OUT ?? join(tmpdir(), "vedora-voice-sim")
const SCENARIO = (process.env.VOICE_SIM_SCENARIO ?? "A").toUpperCase()

const PLAN_WEEK = "Lên thực đơn chay cho cả tuần sau giúp mình nhé."
const INTERRUPT = "Khoan đã, dừng lại đi. Chỉ cần gợi ý bữa sáng ngày mai thôi."
const FAREWELL = "Cảm ơn nhé, mình tắt máy đây. Tạm biệt!"
const CHANGE_MIND = "À khoan, cho mình hỏi thêm, tối mai ăn gì?"
const PHRASES: Record<string, string[]> = {
  A: [PLAN_WEEK],
  B: [PLAN_WEEK, INTERRUPT],
  C: [FAREWELL],
  D: [FAREWELL, CHANGE_MIND],
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function readEnv(path: string) {
  const entries = readFileSync(path, "utf8")
    .split("\n")
    .map((line) => /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line))
    .filter((match) => match !== null)
    .map((match) => [match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")])
  return Object.fromEntries(entries) as Record<string, string | undefined>
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function wavSamples(bytes: Buffer) {
  let rate = 0
  let channels = 1
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const id = bytes.toString("ascii", offset, offset + 4)
    const size = bytes.readUInt32LE(offset + 4)
    if (id === "fmt ") {
      channels = bytes.readUInt16LE(offset + 10)
      rate = bytes.readUInt32LE(offset + 12)
    }
    if (id === "data") {
      const frames = Math.floor((Math.min(size, bytes.length - offset - 8) / 2) / channels)
      const samples = new Float32Array(frames)
      for (let i = 0; i < frames; i++) samples[i] = bytes.readInt16LE(offset + 8 + i * 2 * channels) / 32768
      return rate === RATE ? samples : resampleAudio(samples, rate, RATE)
    }
    offset += 8 + size + (size % 2)
  }
  throw new Error("TTS did not return 16-bit WAV")
}

async function speech(text: string, apiKey: string) {
  const file = join(OUT_DIR, `tts-${createHash("sha256").update(text).digest("hex").slice(0, 12)}.wav`)
  if (!existsSync(file)) {
    const { audio } = await generateSpeech({
      model: createGateway({ apiKey }).speech("openai/tts-1"),
      text,
      voice: "alloy",
      outputFormat: "wav",
    })
    writeFileSync(file, audio.uint8Array)
  }
  return wavSamples(readFileSync(file))
}

test(`voice call scenario ${SCENARIO}`, async () => {
  if (!PHRASES[SCENARIO]) throw new Error(`Unknown scenario ${SCENARIO}`)
  mkdirSync(OUT_DIR, { recursive: true })
  const logFile = join(OUT_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-${SCENARIO}.log`)
  let t0 = performance.now()
  const now = () => Math.round(performance.now() - t0)
  let assistantText = ""
  const write = (line: string) => {
    const text = `+${String(now()).padStart(6)}ms ${line}\n`
    process.stdout.write(text)
    appendFileSync(logFile, text)
  }
  const flushAssistant = () => {
    if (assistantText) write(`assistant: ${JSON.stringify(assistantText.trim())}`)
    assistantText = ""
  }
  const log = (line: string) => {
    flushAssistant()
    write(line)
  }

  const env = readEnv(API_ENV)
  const password = process.env.VOICE_SIM_PASSWORD ?? env.SEED_USER_PASSWORD
  if (!env.AI_GATEWAY_API_KEY || !password) throw new Error(`Need AI_GATEWAY_API_KEY and SEED_USER_PASSWORD in ${API_ENV}`)
  const audio = new Map<string, Float32Array>()
  for (const text of PHRASES[SCENARIO]) audio.set(text, await speech(text, env.AI_GATEWAY_API_KEY))

  const post = async (path: string, body: unknown, token?: string) => {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`${path} ${response.status} ${await response.text()}`)
    return response.json()
  }
  const { accessToken } = (await post("/auth/login", {
    username: process.env.VOICE_SIM_USERNAME ?? "vedora.admin",
    password,
    turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
  })) as { accessToken: string }
  const threadId = randomUUID()
  const setup = (await post("/meal-plan/voice/session", { threadId }, accessToken)) as { token: string; url: string }

  const model = gateway.experimental_realtime(VOICE_MODEL_ID) as ReturnType<typeof gateway.experimental_realtime> & {
    createServerEventParser?: () => (raw: unknown) => ServerEvent | ServerEvent[]
    getHealthCheckResponse?: (raw: unknown) => unknown
  }
  const parse = model.createServerEventParser?.() ?? model.parseServerEvent.bind(model)
  const wsConfig = model.getWebSocketConfig!({ token: setup.token, url: setup.url })
  const socket = new WebSocket(wsConfig.url, wsConfig.protocols)
  socket.binaryType = "arraybuffer"
  const send = async (event: ClientEvent) => {
    const data = await model.serializeClientEvent(event)
    if (socket.readyState !== WebSocket.OPEN || data == null) return
    socket.send(typeof data === "string" || data instanceof ArrayBuffer ? data : JSON.stringify(data))
  }

  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const weekStart = isoDate(monday)
  const ledger = new VoiceCallLedger()
  const farewell = new FarewellTracker()
  const counts: Record<string, number> = {}
  let ready = false
  let closed = false
  let ending = false
  let ended = false
  let pending = 0
  let playbackUntil = 0
  let lastAssistantAt = 0
  let lastCommentaryAt = 0
  let bargedIn = false
  const mic: Float32Array[] = []
  const playing = () => performance.now() < playbackUntil

  const append = async (delegationId: string | null, channel: "thinking" | "commentary", content: string) => {
    if (channel === "commentary") lastCommentaryAt = performance.now()
    log(`>>> ${channel} ${delegationId ?? "-"}: ${JSON.stringify(content)}`)
    await send({
      type: "context-append",
      delegationId,
      content: appendableText(content),
      providerOptions: { openai: { channel } },
    } as ClientEvent)
  }
  const keepTalking = () => {
    log("[farewell] keepTalking")
    farewell.reset()
    ending = false
  }

  const queueTurn: QueueTurn = ({ delegationId, message, revision }) => {
    log(`[turn] ${revision ? "revision" : "delegation"} ${delegationId}: ${JSON.stringify(message)}`)
    return runVoiceTurn({
      delegationId,
      message,
      revision,
      accessToken,
      weekStart,
      threadId,
      screen: undefined,
      turns: ledger.turns,
      farewell,
      append,
      hasNewSpeech: () => ledger.utterances.hasUtterance(),
      onRevise: () => {
        log(`[turn] user spoke again before the result of ${delegationId}, revising`)
        reviseTurn(delegationId, { ledger, queueTurn })
      },
      onScreen: () => {},
      onState: () => {},
      onAbortInvalidate: () => log(`[turn] aborted ${delegationId}`),
      onPendingChange: (delta) => (pending += delta),
      onEnding: () => {
        log("[turn] end-call")
        ending = true
      },
      onTurnEnd: () => {},
      streamTurn: async function* (token, request, signal) {
        const start = now()
        try {
          yield* streamVoiceTurn(token, request, signal)
        } finally {
          log(`[turn] closed ${delegationId} after ${now() - start}ms aborted=${signal.aborted}`)
        }
      },
    })
  }

  function handle(event: ServerEvent) {
    counts[event.type] = (counts[event.type] ?? 0) + 1
    if (event.type === "audio-chunk") {
      playbackUntil = Math.max(performance.now(), playbackUntil) + (decodeRealtimeAudio(event.delta).length / RATE) * 1000
    } else if (event.type === "session-started") {
      t0 = performance.now()
      ready = true
      void append(null, "thinking", voicePageContext(weekStart, isoDate(today)))
    } else if (event.type === "transcript-fragment" && event.speaker === "assistant") {
      if (performance.now() - lastAssistantAt > 700) log(`[assistant] starts speaking at audio ${event.startMs}ms`)
      assistantText += event.delta
      lastAssistantAt = performance.now()
      farewell.spoke(event.startMs, event.endMs)
    } else if (event.type === "transcript-fragment") {
      log(`user [${event.startMs}-${event.endMs}]: ${JSON.stringify(event.delta)}`)
      ledger.utterances.addFragment({ text: event.delta, startMs: event.startMs, endMs: event.endMs })
      if (playing() && event.delta.trim() && !bargedIn) {
        bargedIn = true
        log("[speaker] stopPlayback")
      }
      if (event.delta.trim()) playbackUntil = Math.min(playbackUntil, performance.now())
      if (farewell.shouldCancel(event.delta)) keepTalking()
    } else if (event.type === "delegation-created") {
      log(`[delegate] created ${event.delegationId} offsetMs=${event.offsetMs}`)
      if (farewell.phase !== "idle") keepTalking()
      void handleDelegation(event.delegationId, { ledger, append, queueTurn })
    } else if (event.type === "error") {
      log(`[error] ${JSON.stringify(event)}`)
    } else if (event.type === "session-closed") {
      closed = true
      log(`[session] closed ${event.reason}, billed ${event.usage.seconds}s`)
    }
  }

  let incoming = Promise.resolve()
  socket.onmessage = ({ data }) => {
    incoming = incoming
      .then(() => {
        const value = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data)) as unknown
        const health = model.getHealthCheckResponse?.(value)
        if (health != null) socket.send(JSON.stringify(health))
        const result = parse(value)
        for (const event of Array.isArray(result) ? result : [result]) handle(event)
      })
      .catch((error: unknown) => log(`[error] ${String(error)}`))
  }
  socket.onclose = ({ code }) => {
    closed = true
    log(`[socket] closed ${code}`)
  }
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = () => reject(new Error("WebSocket failed to open"))
  })
  const format = { type: "audio/pcm", rate: RATE }
  await send({
    type: model.capabilities?.startup ?? "session-update",
    config: { ...voiceSessionConfig(undefined), inputAudioFormat: format, outputAudioFormat: format },
  } as ClientEvent)

  async function until(label: string, done: () => boolean, timeoutMs: number) {
    const start = performance.now()
    while (!done() && !closed && performance.now() - start < timeoutMs) await sleep(20)
    log(`[wait] ${label}: ${done() ? "ok" : "TIMEOUT"} after ${Math.round(performance.now() - start)}ms`)
  }
  await until("session started", () => ready, 20_000)

  const micStart = performance.now()
  let frames = 0
  let offset = 0
  const micTimer = setInterval(() => {
    for (; frames < (performance.now() - micStart) / 20; frames++) {
      const frame = new Float32Array(FRAME)
      for (let filled = 0; filled < FRAME && mic.length > 0; ) {
        const take = Math.min(FRAME - filled, mic[0].length - offset)
        frame.set(mic[0].subarray(offset, offset + take), filled)
        filled += take
        offset += take
        if (offset >= mic[0].length) {
          mic.shift()
          offset = 0
        }
      }
      void send({ type: "input-audio-append", audio: encodeRealtimeAudio(frame) })
    }
  }, 5)
  const endTimer = setInterval(() => {
    if (ending && !ended && farewell.done(playing())) {
      ended = true
      log("[farewell] END CALL")
    }
  }, 200)

  async function say(text: string) {
    bargedIn = false
    log(`[user] says ${JSON.stringify(text)}`)
    mic.push(audio.get(text)!)
    while (mic.length > 0) await sleep(10)
  }
  const quiet = (ms: number) => () => lastAssistantAt > 0 && performance.now() - lastAssistantAt > ms
  const settled = () => pending === 0 && lastAssistantAt > lastCommentaryAt && quiet(2500)()

  try {
    await until("greeting", quiet(500), 8000)
    if (SCENARIO === "A" || SCENARIO === "B") {
      await say(PLAN_WEEK)
      await until("turn running", () => ledger.turns.running() !== null, 10_000)
      if (SCENARIO === "B") {
        await sleep(Number(process.env.VOICE_SIM_INTERRUPT_AFTER_MS ?? 1500))
        await say(INTERRUPT)
      }
      await until("settled", settled, 30_000)
    } else {
      await say(FAREWELL)
      if (SCENARIO === "C") {
        await until("call ended", () => ended, 20_000)
      } else {
        await until("end-call", () => ending, 15_000)
        await sleep(Number(process.env.VOICE_SIM_CHANGE_MIND_AFTER_MS ?? 1000))
        await say(CHANGE_MIND)
        await until("settled", settled, 25_000)
        log(`[farewell] ended=${ended}`)
      }
    }
  } finally {
    clearInterval(micTimer)
    clearInterval(endTimer)
    ledger.endCall()
    await send({ type: "session-close" } as ClientEvent).catch(() => {})
    await until("session closed", () => closed, 3000)
    socket.close()
    log(`[summary] events ${JSON.stringify(counts)}`)
    log(`[summary] log ${logFile}`)
  }
})
