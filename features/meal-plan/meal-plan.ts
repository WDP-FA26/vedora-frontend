import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import { sendJson } from "@/features/shared/lib/api-client"

// Mirrors vedora-api's `/meal-plan` routes: the signed-in user's weekly timetable.

export const MEAL_PLANNER_PATH = "/home/meal-planner"

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

const recipeRefSchema = z.object({ id: z.string(), title: z.string() })

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
    return `${ingredients.join(" và ")} không nên ăn cùng ngày${reason ? ` (${reason})` : ""}. Có trong: ${recipes.join(", ")}.`
  }
  return "Có món không còn tồn tại."
}

export function fetchMealPlan([url, token]: readonly [string, string]) {
  return sendJson(mealPlanSchema, url, token)
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
