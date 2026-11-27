import { parseJsonEventStream, uiMessageChunkSchema } from "ai"
import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import {
  plannerStateEventSchema,
  type PlannerStateEvent,
} from "@/features/meal-plan/lib/planner-state-protocol"
import {
  SCREEN_SCROLL_DIRECTIONS,
  type ScreenScrollDirection,
  type VoiceScrollState,
} from "@/features/meal-plan/lib/scroll"
import { WEEKDAYS, type MealSection, type Weekday } from "@/features/meal-plan/schemas/meal-plan.schema"
import { send } from "@/features/shared/lib/api-client"

export type VoiceTurnRequest = {
  weekStart: string
  message: string
  threadId?: string
  requestId?: string
  screen?: VoiceScreen
}

export const RECIPE_SECTIONS = ["top", "ingredients", "steps"] as const
export type RecipeSection = (typeof RECIPE_SECTIONS)[number]

export type VoiceScreenPanel = "recipe" | "eatingLog" | "bodyMetrics" | "shoppingList" | "all"

export const BODY_METRICS_TABS = ["weekly", "bmi", "dietary"] as const
export type BodyMetricsTab = (typeof BODY_METRICS_TABS)[number]

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
      expandItems?: string[] | null
      collapseItems?: string[] | null
    }
  | { kind: "planDay"; weekStart: string; day: Weekday | null }

export const VOICE_GLOW_MS = 1800

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
    expandItems: z.array(z.string()).nullable().optional(),
    collapseItems: z.array(z.string()).nullable().optional(),
  }),
  z.object({ kind: z.literal("planDay"), weekStart: z.string(), day: z.enum(WEEKDAYS).nullable() }),
])

const voiceScreenDataSchema = z.object({
  focus: voiceFocusSchema.nullable(),
  close: z.enum(["recipe", "eatingLog", "bodyMetrics", "shoppingList", "all"]).nullable(),
  scroll: z.enum(SCREEN_SCROLL_DIRECTIONS).nullable().optional(),
})

const voiceTextDataSchema = z.object({ text: z.string().min(1) })

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
