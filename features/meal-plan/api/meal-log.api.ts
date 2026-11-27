import { API_URL } from "@/features/auth/lib/api"
import {
  calorieEstimateSchema,
  mealLogEntrySchema,
  mealLogWeekSchema,
  type MealLogChange,
  type NewMealLogEntry,
} from "@/features/meal-plan/schemas/meal-log.schema"
import { send, sendJson } from "@/features/shared/lib/api-client"

const MEAL_LOG_URL = `${API_URL}/meal-plan/log`

export function mealLogKey(weekStart: string) {
  return `${MEAL_LOG_URL}?weekStart=${weekStart}`
}

export function isMealLogKey(key: unknown) {
  return Array.isArray(key) && typeof key[0] === "string" && key[0].startsWith(`${MEAL_LOG_URL}?`)
}

export function fetchMealLog([url, token]: readonly [string, string]) {
  return sendJson(mealLogWeekSchema, url, token, { cache: "no-store" })
}

export function createMealLogEntry(token: string, entry: NewMealLogEntry) {
  return sendJson(mealLogEntrySchema, MEAL_LOG_URL, token, {
    method: "POST",
    body: JSON.stringify(entry),
  })
}

export function updateMealLogEntry(token: string, id: string, change: MealLogChange) {
  return sendJson(mealLogEntrySchema, `${MEAL_LOG_URL}/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(change),
  })
}

export async function deleteMealLogEntry(token: string, id: string) {
  await send(`${MEAL_LOG_URL}/${id}`, token, { method: "DELETE" })
}

export function estimateCalories(
  token: string,
  question: { name: string; details?: string },
  signal?: AbortSignal
) {
  return sendJson(calorieEstimateSchema, `${MEAL_LOG_URL}/calorie-estimate`, token, {
    method: "POST",
    body: JSON.stringify(question),
    signal,
  })
}
