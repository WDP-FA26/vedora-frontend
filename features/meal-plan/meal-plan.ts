import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import { recipeTagSchema } from "@/features/recipes/tags"
import { send, sendJson } from "@/features/shared/lib/api-client"

// Mirrors vedora-api's `/meal-plan` routes: the signed-in user's weekly timetable.

export const MEAL_PLANNER_PATH = "/meal-planner"

const MEAL_PLAN_URL = `${API_URL}/meal-plan`

/**
 * The SWR key is `[url, accessToken]`. A week is its Monday as `YYYY-MM-DD`;
 * without one the API answers for the current week, so the key has no query.
 */
export function mealPlanKey(weekStart?: string) {
  return weekStart ? `${MEAL_PLAN_URL}?weekStart=${weekStart}` : MEAL_PLAN_URL
}
export const MEAL_PLANNER_CHAT_URL = `${API_URL}/meal-plan/chat`
export const MEAL_PLANNER_CHAT_THREADS_KEY = `${API_URL}/meal-plan/chat/threads`
const SHOPPING_LIST_URL = `${API_URL}/meal-plan/shopping-list`

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const
export const MEAL_SECTIONS = ["BREAKFAST", "LUNCH", "DINNER", "OTHER"] as const
export type Weekday = (typeof WEEKDAYS)[number]
export type MealSection = (typeof MEAL_SECTIONS)[number]

export const DAY_LABELS: Record<Weekday, string> = {
  MON: "Thứ Hai",
  TUE: "Thứ Ba",
  WED: "Thứ Tư",
  THU: "Thứ Năm",
  FRI: "Thứ Sáu",
  SAT: "Thứ Bảy",
  SUN: "Chủ nhật",
}

/** "Khác" holds everything outside the three meals: snacks, drinks, desserts. */
export const SECTION_LABELS: Record<MealSection, string> = {
  BREAKFAST: "Sáng",
  LUNCH: "Trưa",
  DINNER: "Tối",
  OTHER: "Khác",
}

const daySchema = z.enum(WEEKDAYS)
const sectionSchema = z.enum(MEAL_SECTIONS)

const mealRecipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  imageUrl: z.string().nullable(),
  tag: recipeTagSchema.nullable(),
  servings: z.number(),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      note: z.string().nullable(),
    })
  ),
  steps: z.array(z.string()),
})

export const problemSchema = z.object({
  code: z.enum(["UNKNOWN_RECIPE", "AVOIDED_INGREDIENT", "DAY_CONFLICT"]),
  day: daySchema,
  recipes: z.array(z.string()),
  /** The dishes involved, for flagging them on the plan. */
  recipeIds: z.array(z.string()),
  ingredients: z.array(z.string()),
  reason: z.string().nullable(),
})

const mealPlanSchema = z.object({
  /** Monday of this week. */
  weekStart: z.string(),
  /** Monday of the week that holds today. */
  currentWeekStart: z.string(),
  /** Today in the app time zone, `YYYY-MM-DD`. */
  today: z.string(),
  /** Earliest week worth browsing back to. */
  minWeekStart: z.string(),
  /** Last week a plan may be made for. */
  maxWeekStart: z.string(),
  /** False once the whole week is over. */
  editable: z.boolean(),
  days: z.array(
    z.object({
      day: daySchema,
      /** Calendar date of this day, `YYYY-MM-DD`. */
      date: z.string(),
      /** False for a day before today: it can only be read. */
      editable: z.boolean(),
      sections: z.array(
        z.object({ section: sectionSchema, recipes: z.array(mealRecipeSchema) })
      ),
    })
  ),
  problems: z.array(problemSchema),
})

const recipeRefSchema = z.object({
  id: z.string(),
  title: z.string(),
  tag: recipeTagSchema.nullable(),
})

/** Output of the planner's `proposeMealPlan` tool: checked, not saved. */
export const proposalSchema = z.object({
  /** The week the proposal is for. Missing on proposals saved before plans were weekly. */
  weekStart: z.string().optional(),
  ok: z.boolean(),
  days: z.array(
    z.object({
      day: daySchema,
      sections: z.array(
        z.object({
          section: sectionSchema,
          recipes: z.array(recipeRefSchema),
          previous: z.array(recipeRefSchema),
        })
      ),
    })
  ),
})

/**
 * `GET /meal-plan/shopping-list`: the saved plan's ingredients, summed per
 * ingredient and unit. Quantities are decimal text; each time a recipe is on
 * the plan it adds its full quantities, not scaled per person.
 */
export const shoppingListSchema = z.object({
  weekStart: z.string(),
  days: z.array(daySchema),
  quantityBasis: z.literal("RECIPE_PER_OCCURRENCE"),
  items: z.array(
    z.object({
      ingredientId: z.string(),
      name: z.string(),
      unit: z.string().nullable(),
      /** Only the known part when `hasUnknownQuantity`; null if no source has one. */
      knownQuantity: z.string().nullable(),
      hasUnknownQuantity: z.boolean(),
      contributions: z.array(
        z.object({
          recipeId: z.string(),
          recipeTitle: z.string(),
          day: daySchema,
          section: sectionSchema,
          servings: z.number(),
          quantity: z.string().nullable(),
          note: z.string().nullable(),
        })
      ),
    })
  ),
})

export type MealRecipe = z.infer<typeof mealRecipeSchema>
export type MealPlan = z.infer<typeof mealPlanSchema>
export type MealPlanProblem = z.infer<typeof problemSchema>
export type MealPlanProposal = z.infer<typeof proposalSchema>
export type PlannedDay = MealPlan["days"][number]
export type ShoppingList = z.infer<typeof shoppingListSchema>
export type ShoppingItem = ShoppingList["items"][number]
/** The complete new content of one day, as `PUT /meal-plan/days` takes it. */
export type MealDayInput = {
  day: Weekday
  breakfast: string[]
  lunch: string[]
  dinner: string[]
  others: string[]
}

export function toDayInputs(proposal: MealPlanProposal): MealDayInput[] {
  return proposal.days.map(({ day, sections }) => {
    const ids = (section: MealSection) =>
      sections.find((item) => item.section === section)?.recipes.map(({ id }) => id) ?? []
    return {
      day,
      breakfast: ids("BREAKFAST"),
      lunch: ids("LUNCH"),
      dinner: ids("DINNER"),
      others: ids("OTHER"),
    }
  })
}

export function problemText({ code, recipes, ingredients, reason }: MealPlanProblem) {
  if (code === "AVOIDED_INGREDIENT") {
    return `${recipes.join(", ")} có ${ingredients.join(", ")}, thứ bạn không ăn.`
  }
  if (code === "DAY_CONFLICT") {
    return `${ingredients.join(" và ")} không nên ăn cùng bữa${reason ? ` (${reason})` : ""}. Có trong: ${recipes.join(", ")}.`
  }
  return "Có món không còn tồn tại."
}

/** Key of a dish on one day of the plan, as used by `dishWarnings`. */
export function dishKey(day: Weekday, recipeId: string) {
  return `${day}:${recipeId}`
}

function dishWarningText({ code, ingredients, reason }: MealPlanProblem) {
  if (code === "DAY_CONFLICT") {
    return `${ingredients.join(" và ")} không nên ăn cùng bữa${reason ? ` (${reason})` : ""}`
  }
  return `Có ${ingredients.join(", ")}, thứ bạn không ăn`
}

/** What is wrong with each dish, so it can be marked where it sits on the plan. */
export function dishWarnings(problems: MealPlanProblem[]) {
  const warnings = new Map<string, string[]>()
  for (const problem of problems) {
    const text = dishWarningText(problem)
    for (const recipeId of problem.recipeIds) {
      const key = dishKey(problem.day, recipeId)
      const texts = warnings.get(key) ?? []
      if (!texts.includes(text)) texts.push(text)
      warnings.set(key, texts)
    }
  }
  return warnings
}

export const MAX_DISHES_PER_SECTION = 5

export type SlotRef = { day: Weekday; section: MealSection }
/** The full new recipe list of one meal slot. */
export type SlotChange = SlotRef & { recipeIds: string[] }

export function recipesAt(plan: MealPlan, { day, section }: SlotRef): MealRecipe[] {
  const planned = plan.days.find((item) => item.day === day)
  return planned?.sections.find((item) => item.section === section)?.recipes ?? []
}

/** PUT replaces a whole day, so every section of an edited day is sent. */
export function inputsForChanges(plan: MealPlan, changes: SlotChange[]): MealDayInput[] {
  const days = WEEKDAYS.filter((day) => changes.some((change) => change.day === day))
  return days.map((day) => {
    const ids = (section: MealSection) => {
      const change = changes.find((item) => item.day === day && item.section === section)
      if (change) return change.recipeIds
      return recipesAt(plan, { day, section }).map(({ id }) => id)
    }
    return {
      day,
      breakfast: ids("BREAKFAST"),
      lunch: ids("LUNCH"),
      dinner: ids("DINNER"),
      others: ids("OTHER"),
    }
  })
}

/**
 * The plan as it will look after `changes`, for an optimistic update. Returns
 * null when a recipe id is not in the plan yet (e.g. a freshly added dish).
 */
export function planAfterChanges(plan: MealPlan, changes: SlotChange[]): MealPlan | null {
  const known = new Map<string, MealRecipe>()
  for (const day of plan.days) {
    for (const section of day.sections) {
      for (const recipe of section.recipes) known.set(recipe.id, recipe)
    }
  }

  const days = plan.days.map((planned) => {
    const sections = MEAL_SECTIONS.map((section) => ({
      section,
      recipes: recipesAt(plan, { day: planned.day, section }),
    }))
    return { ...planned, sections }
  })

  for (const change of changes) {
    const recipes: MealRecipe[] = []
    for (const id of change.recipeIds) {
      const recipe = known.get(id)
      if (!recipe) return null
      recipes.push(recipe)
    }
    const day = days.find((item) => item.day === change.day)
    const section = day?.sections.find((item) => item.section === change.section)
    if (!section) return null
    section.recipes = recipes
  }
  return { ...plan, days }
}

const recipeSearchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      totalMinutes: z.number().nullable(),
      servings: z.number(),
    })
  ),
})

export type RecipeOption = z.infer<typeof recipeSearchSchema>["items"][number]

/** Recipes this user can eat (avoided ingredients are already left out). */
export function searchRecipeOptions(token: string, query: string) {
  const params = new URLSearchParams({ suitableForMe: "true", limit: "20" })
  const text = query.trim()
  if (text) params.set("q", text)
  return sendJson(recipeSearchSchema, `${API_URL}/recipes?${params.toString()}`, token)
}

export function fetchMealPlan([url, token]: readonly [string, string]) {
  return sendJson(mealPlanSchema, url, token)
}

/** Mirrors `GenerateMealDaysDto`: the algorithm picks one dish per chosen slot. */
export type GenerateRequest = {
  /** Monday of the week to fill. */
  weekStart: string
  days: Weekday[]
  sections: MealSection[]
  /** Keep every slot that already has a dish. */
  onlyEmpty: boolean
  maxMinutes?: number
  /** A dish or ingredient to prefer; never a hard filter. */
  query?: string
}

/** What the form asks for; the week it applies to is added when it is sent. */
export type GenerateInput = Omit<GenerateRequest, "weekStart">

export const MAX_GENERATE_QUERY_LENGTH = 100

const generatedSchema = proposalSchema
  .omit({ ok: true })
  .extend({ problems: z.array(problemSchema) })

/** `POST /meal-plan/generate`: a checked preview, nothing saved. `days` is empty when no dish fits. */
export async function generateMealDays(token: string, request: GenerateRequest) {
  const preview = await sendJson(generatedSchema, `${MEAL_PLAN_URL}/generate`, token, {
    method: "POST",
    body: JSON.stringify(request),
  })
  return { days: preview.days, ok: preview.problems.length === 0 }
}

export function saveMealDays(token: string, weekStart: string, days: MealDayInput[]) {
  return sendJson(mealPlanSchema, `${MEAL_PLAN_URL}/days`, token, {
    method: "PUT",
    body: JSON.stringify({ weekStart, days }),
  })
}

/** `DELETE /meal-plan/draft`: drops the assistant's unsaved draft of one week. */
export async function discardMealDraft(token: string, weekStart: string) {
  await send(`${MEAL_PLAN_URL}/draft?weekStart=${weekStart}`, token, { method: "DELETE" })
}

/** The list of one week for `days`, in week order; all seven days is the API default, so no `days` query. */
export function shoppingListKey(weekStart: string, days: readonly Weekday[]) {
  const picked = WEEKDAYS.filter((day) => days.includes(day))
  const params = new URLSearchParams({ weekStart })
  if (picked.length !== WEEKDAYS.length) params.set("days", picked.join(","))
  return `${SHOPPING_LIST_URL}?${params.toString()}`
}

export function fetchShoppingList([url, token]: readonly [string, string]) {
  return sendJson(shoppingListSchema, url, token)
}

/** "100.25" → "100,25", "2.00" → "2": Vietnamese decimals without trailing zeros. */
export function formatQuantity(quantity: string) {
  const [whole, fraction = ""] = quantity.split(".")
  const trimmed = fraction.replace(/0+$/, "")
  return trimmed ? `${whole},${trimmed}` : whole
}

export const proposalStatusSchema = z.enum(["staged", "saved", "dismissed"])

export const chatThreadSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  messageCount: z.number(),
  lastMessagePreview: z.string().nullable(),
  lastMessageAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const chatThreadListSchema = z.object({
  items: z.array(chatThreadSummarySchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
})

export const chatMessageRecordSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  parts: z.array(z.record(z.string(), z.unknown())),
  metadata: z.object({ refused: z.boolean().optional() }).nullable().optional(),
  createdAt: z.string(),
})

export const chatThreadDetailSchema = chatThreadSummarySchema.extend({
  proposalStatuses: z.record(z.string(), proposalStatusSchema),
  messages: z.array(chatMessageRecordSchema),
})

export type ChatThreadSummary = z.infer<typeof chatThreadSummarySchema>
export type ChatThreadList = z.infer<typeof chatThreadListSchema>
export type ChatMessageRecord = z.infer<typeof chatMessageRecordSchema>
export type ChatThreadDetail = z.infer<typeof chatThreadDetailSchema>

export type SyncChatMessageInput = {
  id: string
  role: "user" | "assistant"
  text?: string
  parts?: Record<string, unknown>[]
  metadata?: { refused?: boolean } | null
}

export function fetchChatThreads([url, token]: readonly [string, string]) {
  return sendJson(chatThreadListSchema, url, token)
}

export function fetchChatThread(token: string, threadId: string) {
  return sendJson(chatThreadDetailSchema, `${MEAL_PLANNER_CHAT_THREADS_KEY}/${threadId}`, token)
}

export function createChatThread(token: string, body: { id?: string; title?: string } = {}) {
  return sendJson(chatThreadDetailSchema, MEAL_PLANNER_CHAT_THREADS_KEY, token, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function updateChatThread(
  token: string,
  threadId: string,
  body: {
    title?: string
    proposalStatuses?: Record<string, z.infer<typeof proposalStatusSchema>>
    messages?: SyncChatMessageInput[]
  }
) {
  return sendJson(chatThreadDetailSchema, `${MEAL_PLANNER_CHAT_THREADS_KEY}/${threadId}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function deleteChatThread(token: string, threadId: string) {
  await send(`${MEAL_PLANNER_CHAT_THREADS_KEY}/${threadId}`, token, {
    method: "DELETE",
  })
}

/** `2026-11-16` → `16/11`. */
export function formatDayMonth(date: string) {
  const [, month, day] = date.split("-")
  return `${Number(day)}/${Number(month)}`
}

/** Day of the month of a `YYYY-MM-DD` date. */
export function dayOfMonth(date: string) {
  return Number(date.split("-")[2])
}

/** `16/11 – 22/11/2026` for a week's seven days. */
export function weekRangeLabel(plan: MealPlan) {
  const first = plan.days[0]
  const last = plan.days[plan.days.length - 1]
  if (!first || !last) return ""
  return `${formatDayMonth(first.date)} – ${formatDayMonth(last.date)}/${last.date.split("-")[0]}`
}

/** `16/11 – 22/11` for the week starting `weekStart`. */
export function weekStartRangeLabel(weekStart: string) {
  return `${formatDayMonth(weekStart)} – ${formatDayMonth(shiftDays(weekStart, 6))}`
}

function shiftDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** Monday of the week `weeks` after (or before, when negative) the week starting `weekStart`. */
export function shiftWeek(weekStart: string, weeks: number) {
  const [year, month, day] = weekStart.split("-").map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + weeks * 7))
  return shifted.toISOString().slice(0, 10)
}

/** The weekday of `plan` that is today, or undefined when today is not in this week. */
export function todayOf(plan: MealPlan): Weekday | undefined {
  return plan.days.find(({ date }) => date === plan.today)?.day
}

export function editableDaysOf(plan: MealPlan): Weekday[] {
  return plan.days.filter(({ editable }) => editable).map(({ day }) => day)
}

export function isDayEditable(plan: MealPlan, day: Weekday) {
  return plan.days.find((item) => item.day === day)?.editable ?? false
}
