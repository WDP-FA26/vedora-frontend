import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import { recipeTagSchema } from "@/features/recipes/tags"
import { sendJson } from "@/features/shared/lib/api-client"

// Mirrors vedora-api's `/meal-plan` routes: the signed-in user's weekly timetable.

export const MEAL_PLANNER_PATH = "/meal-planner"

/** The SWR key is `[url, accessToken]`. */
export const MEAL_PLAN_KEY = `${API_URL}/meal-plan`
export const MEAL_PLANNER_CHAT_URL = `${API_URL}/meal-plan/chat`
export const SHOPPING_LIST_KEY = `${API_URL}/meal-plan/shopping-list`

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
  days: z.array(
    z.object({
      day: daySchema,
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

export const MAX_DISHES_PER_SECTION = 6

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

  const days = WEEKDAYS.map((day) => {
    const sections = MEAL_SECTIONS.map((section) => ({
      section,
      recipes: recipesAt(plan, { day, section }),
    }))
    return { day, sections }
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
  return { days, problems: plan.problems }
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
  days: Weekday[]
  sections: MealSection[]
  /** Keep every slot that already has a dish. */
  onlyEmpty: boolean
  maxMinutes?: number
  /** A dish or ingredient to prefer; never a hard filter. */
  query?: string
}

export const MAX_GENERATE_QUERY_LENGTH = 100

const generatedSchema = proposalSchema
  .omit({ ok: true })
  .extend({ problems: z.array(problemSchema) })

/** `POST /meal-plan/generate`: a checked preview, nothing saved. `days` is empty when no dish fits. */
export async function generateMealDays(token: string, request: GenerateRequest) {
  const preview = await sendJson(generatedSchema, `${MEAL_PLAN_KEY}/generate`, token, {
    method: "POST",
    body: JSON.stringify(request),
  })
  return { days: preview.days, ok: preview.problems.length === 0 }
}

export function saveMealDays(token: string, days: MealDayInput[]) {
  return sendJson(mealPlanSchema, `${MEAL_PLAN_KEY}/days`, token, {
    method: "PUT",
    body: JSON.stringify({ days }),
  })
}

/** The list for `days`, in week order; all seven is the API default, so no query. */
export function shoppingListKey(days: readonly Weekday[]) {
  const picked = WEEKDAYS.filter((day) => days.includes(day))
  return picked.length === WEEKDAYS.length
    ? SHOPPING_LIST_KEY
    : `${SHOPPING_LIST_KEY}?days=${picked.join(",")}`
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
