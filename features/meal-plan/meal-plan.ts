import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import {
  NUTRITION_PILLARS,
  nutritionPillarSchema,
  type NutritionGoal,
  type NutritionPillar,
  type NutritionProfile,
} from "@/features/dietary/dietary"
import { recipeTagSchema } from "@/features/recipes/tags"
import { send, sendJson } from "@/features/shared/lib/api-client"

export const MEAL_PLANNER_PATH = "/meal-planner"

const MEAL_PLAN_URL = `${API_URL}/meal-plan`

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
  caloriesPerServing: z.number().nullable().optional(),
  nutritionPillars: z.array(nutritionPillarSchema).optional(),
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
  recipeIds: z.array(z.string()),
  ingredients: z.array(z.string()),
  reason: z.string().nullable(),
})

const mealPlanSchema = z.object({
  weekStart: z.string(),
  currentWeekStart: z.string(),
  today: z.string(),
  minWeekStart: z.string(),
  maxWeekStart: z.string(),
  editable: z.boolean(),
  days: z.array(
    z.object({
      day: daySchema,
      date: z.string(),
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
  caloriesPerServing: z.number().nullable().optional(),
  nutritionPillars: z.array(nutritionPillarSchema).optional(),
})

export const proposalSchema = z.object({
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

export const planChangeSchema = z.object({
  weekStart: z.string(),
  applied: z.boolean(),
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
  problems: z.array(problemSchema).default([]),
})

export const shoppingListSchema = z.object({
  weekStart: z.string(),
  days: z.array(daySchema),
  quantityBasis: z.literal("RECIPE_PER_OCCURRENCE"),
  items: z.array(
    z.object({
      ingredientId: z.string(),
      name: z.string(),
      unit: z.string().nullable(),
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
export type PlanChange = z.infer<typeof planChangeSchema>
export type PlannedDay = MealPlan["days"][number]
export type ShoppingList = z.infer<typeof shoppingListSchema>
export type ShoppingItem = ShoppingList["items"][number]
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

export function dishKey(day: Weekday, recipeId: string) {
  return `${day}:${recipeId}`
}

function dishWarningText({ code, ingredients, reason }: MealPlanProblem) {
  if (code === "DAY_CONFLICT") {
    return `${ingredients.join(" và ")} không nên ăn cùng bữa${reason ? ` (${reason})` : ""}`
  }
  return `Có ${ingredients.join(", ")}, thứ bạn không ăn`
}

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
export type SlotChange = SlotRef & { recipeIds: string[] }

export function recipesAt(plan: MealPlan, { day, section }: SlotRef): MealRecipe[] {
  const planned = plan.days.find((item) => item.day === day)
  return planned?.sections.find((item) => item.section === section)?.recipes ?? []
}

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

export function searchRecipeOptions(token: string, query: string) {
  const params = new URLSearchParams({ suitableForMe: "true", limit: "20" })
  const text = query.trim()
  if (text) params.set("q", text)
  return sendJson(recipeSearchSchema, `${API_URL}/recipes?${params.toString()}`, token)
}

export function fetchMealPlan([url, token]: readonly [string, string]) {
  return sendJson(mealPlanSchema, url, token)
}

export type GenerateRequest = {
  weekStart: string
  days: Weekday[]
  sections: MealSection[]
  onlyEmpty: boolean
  maxMinutes?: number
  query?: string
}

export type GenerateInput = Omit<GenerateRequest, "weekStart">

export const MAX_GENERATE_QUERY_LENGTH = 100

const generatedSchema = proposalSchema
  .omit({ ok: true })
  .extend({ problems: z.array(problemSchema) })

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

export function shoppingListKey(weekStart: string, days: readonly Weekday[]) {
  const picked = WEEKDAYS.filter((day) => days.includes(day))
  const params = new URLSearchParams({ weekStart })
  if (picked.length !== WEEKDAYS.length) params.set("days", picked.join(","))
  return `${SHOPPING_LIST_URL}?${params.toString()}`
}

export function fetchShoppingList([url, token]: readonly [string, string]) {
  return sendJson(shoppingListSchema, url, token)
}

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
    messages?: SyncChatMessageInput[]
  }
) {
  return sendJson(chatThreadDetailSchema, `${MEAL_PLANNER_CHAT_THREADS_KEY}/${threadId}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export const chatRewindSchema = z.object({
  text: z.string(),
  weeks: z.array(
    z.object({
      weekStart: z.string(),
      restored: z.array(daySchema),
      skipped: z.array(daySchema),
      droppedDishes: z.number().int().nonnegative(),
    })
  ),
})

export type ChatRewind = z.infer<typeof chatRewindSchema>

export function rewindChatThread(token: string, threadId: string, messageId: string) {
  return sendJson(chatRewindSchema, `${MEAL_PLANNER_CHAT_THREADS_KEY}/${threadId}/rewind`, token, {
    method: "POST",
    body: JSON.stringify({ messageId }),
  })
}

export function isMealPlanKey(key: unknown): boolean {
  if (!Array.isArray(key)) return false
  const url: unknown = key[0]
  if (typeof url !== "string") return false
  return url === MEAL_PLAN_URL || url.startsWith(`${MEAL_PLAN_URL}?`) || url.startsWith(SHOPPING_LIST_URL)
}

export async function deleteChatThread(token: string, threadId: string) {
  await send(`${MEAL_PLANNER_CHAT_THREADS_KEY}/${threadId}`, token, {
    method: "DELETE",
  })
}

export function formatDayMonth(date: string) {
  const [, month, day] = date.split("-")
  return `${Number(day)}/${Number(month)}`
}

export function dayOfMonth(date: string) {
  return Number(date.split("-")[2])
}

export function weekRangeLabel(plan: MealPlan) {
  const first = plan.days[0]
  const last = plan.days[plan.days.length - 1]
  if (!first || !last) return ""
  return `${formatDayMonth(first.date)} – ${formatDayMonth(last.date)}/${last.date.split("-")[0]}`
}

export function weekStartRangeLabel(weekStart: string) {
  return `${formatDayMonth(weekStart)} – ${formatDayMonth(shiftDays(weekStart, 6))}`
}

function shiftDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function shiftWeek(weekStart: string, weeks: number) {
  const [year, month, day] = weekStart.split("-").map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + weeks * 7))
  return shifted.toISOString().slice(0, 10)
}

export function todayOf(plan: MealPlan): Weekday | undefined {
  return plan.days.find(({ date }) => date === plan.today)?.day
}

export function editableDaysOf(plan: MealPlan): Weekday[] {
  return plan.days.filter(({ editable }) => editable).map(({ day }) => day)
}

export function isDayEditable(plan: MealPlan, day: Weekday) {
  return plan.days.find((item) => item.day === day)?.editable ?? false
}

export type DayCalorieStatus = "EMPTY" | "PARTIAL" | "ON_TARGET" | "LOW" | "HIGH"

export type DayNutritionSummary = {
  day: Weekday
  date: string
  calories: number
  hasRecipes: boolean
  filledMainMeals: number
  isFullMainDay: boolean
  pillars: NutritionPillar[]
  missingPlantProtein: boolean
  calorieStatus: DayCalorieStatus
  hints: string[]
}

const MAIN_SECTIONS: readonly MealSection[] = ["BREAKFAST", "LUNCH", "DINNER"]

export function computeDayNutrition(
  plannedDay: PlannedDay,
  dailyCalorieTarget: number | null | undefined,
  nutritionGoal?: NutritionGoal | null,
): DayNutritionSummary {
  let calories = 0
  let dishCount = 0
  let filledMainMeals = 0
  const pillarSet = new Set<NutritionPillar>()

  for (const section of plannedDay.sections) {
    if (MAIN_SECTIONS.includes(section.section) && section.recipes.length > 0) {
      filledMainMeals += 1
    }
    for (const recipe of section.recipes) {
      dishCount += 1
      if (typeof recipe.caloriesPerServing === "number") {
        calories += recipe.caloriesPerServing
      }
      for (const pillar of recipe.nutritionPillars ?? []) {
        pillarSet.add(pillar)
      }
    }
  }

  const pillars = NUTRITION_PILLARS.filter((pillar) => pillarSet.has(pillar))
  const isFullMainDay = filledMainMeals === MAIN_SECTIONS.length
  const hasRecipes = dishCount > 0
  const missingPlantProtein = isFullMainDay && !pillarSet.has("PLANT_PROTEIN")

  let calorieStatus: DayCalorieStatus = "EMPTY"
  if (!hasRecipes) {
    calorieStatus = "EMPTY"
  } else if (dailyCalorieTarget !== null && dailyCalorieTarget !== undefined && calories > dailyCalorieTarget * 1.25) {
    calorieStatus = "HIGH"
  } else if (!isFullMainDay) {
    calorieStatus = "PARTIAL"
  } else if (dailyCalorieTarget !== null && dailyCalorieTarget !== undefined && calories < dailyCalorieTarget * 0.75) {
    calorieStatus = "LOW"
  } else {
    calorieStatus = "ON_TARGET"
  }

  const hints: string[] = []
  if (missingPlantProtein) {
    hints.push("Cả ngày chưa có món giàu đạm thực vật (đậu hũ, các loại đậu, nấm…).")
  }
  if (calorieStatus === "LOW" && dailyCalorieTarget) {
    const extraHint =
      nutritionGoal === "GAIN_WEIGHT"
        ? " Bạn có thể thêm món phụ ở mục Khác."
        : ""
    hints.push(`Tổng ~${calories} kcal đang khá thấp so với mục tiêu ~${dailyCalorieTarget} kcal.${extraHint}`)
  }
  if (calorieStatus === "HIGH" && dailyCalorieTarget) {
    hints.push(`Tổng ~${calories} kcal đang cao hơn vùng mục tiêu (~${dailyCalorieTarget} kcal).`)
  }

  return {
    day: plannedDay.day,
    date: plannedDay.date,
    calories,
    hasRecipes,
    filledMainMeals,
    isFullMainDay,
    pillars,
    missingPlantProtein,
    calorieStatus,
    hints,
  }
}

export type WeekNutritionSummary = {
  days: DayNutritionSummary[]
  plannedDayCount: number
  fullDayCount: number
  averageFullDayCalories: number | null
  pillarCounts: Record<NutritionPillar, number>
  missingPillars: NutritionPillar[]
}

export function computeWeekNutrition(
  plan: MealPlan,
  nutrition: NutritionProfile | null | undefined,
): WeekNutritionSummary {
  const days = plan.days.map((day) =>
    computeDayNutrition(day, nutrition?.dailyCalorieTarget, nutrition?.effectiveGoal)
  )
  const plannedDays = days.filter((item) => item.hasRecipes)
  const fullDays = days.filter((item) => item.isFullMainDay)
  const averageFullDayCalories =
    fullDays.length > 0
      ? Math.round(fullDays.reduce((sum, item) => sum + item.calories, 0) / fullDays.length)
      : null

  const pillarCounts: Record<NutritionPillar, number> = {
    PLANT_PROTEIN: 0,
    FIBER_VEG: 0,
    HEALTHY_FAT: 0,
    IRON_RICH: 0,
    CALCIUM_RICH: 0,
  }
  for (const day of plannedDays) {
    for (const pillar of day.pillars) {
      pillarCounts[pillar] += 1
    }
  }
  const missingPillars =
    plannedDays.length > 0
      ? NUTRITION_PILLARS.filter((pillar) => pillarCounts[pillar] === 0)
      : []

  return {
    days,
    plannedDayCount: plannedDays.length,
    fullDayCount: fullDays.length,
    averageFullDayCalories,
    pillarCounts,
    missingPillars,
  }
}
