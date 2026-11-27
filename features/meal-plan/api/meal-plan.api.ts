import { API_URL } from "@/features/auth/lib/api"
import {
  mealPlanSchema,
  recipeSearchSchema,
  type MealDayInput,
} from "@/features/meal-plan/schemas/meal-plan.schema"
import { sendJson } from "@/features/shared/lib/api-client"

export const MEAL_PLANNER_PATH = "/meal-planner"

export const MEAL_PLAN_URL = `${API_URL}/meal-plan`
export const SHOPPING_LIST_URL = `${API_URL}/meal-plan/shopping-list`

export function mealPlanKey(weekStart?: string) {
  return weekStart ? `${MEAL_PLAN_URL}?weekStart=${weekStart}` : MEAL_PLAN_URL
}

export function isMealPlanKey(key: unknown): boolean {
  if (!Array.isArray(key)) return false
  const url: unknown = key[0]
  if (typeof url !== "string") return false
  return url === MEAL_PLAN_URL || url.startsWith(`${MEAL_PLAN_URL}?`) || url.startsWith(SHOPPING_LIST_URL)
}

export function fetchMealPlan([url, token]: readonly [string, string]) {
  return sendJson(mealPlanSchema, url, token)
}

export function searchRecipeOptions(token: string, query: string) {
  const params = new URLSearchParams({ suitableForMe: "true", limit: "20" })
  const text = query.trim()
  if (text) params.set("q", text)
  return sendJson(recipeSearchSchema, `${API_URL}/recipes?${params.toString()}`, token)
}

export function saveMealDays(token: string, weekStart: string, days: MealDayInput[]) {
  return sendJson(mealPlanSchema, `${MEAL_PLAN_URL}/days`, token, {
    method: "PUT",
    body: JSON.stringify({ weekStart, days }),
  })
}
