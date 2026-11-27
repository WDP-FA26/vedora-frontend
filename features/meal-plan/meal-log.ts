import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import { MEAL_SECTIONS, WEEKDAYS } from "@/features/meal-plan/meal-plan"
import { send, sendJson } from "@/features/shared/lib/api-client"

const MEAL_LOG_URL = `${API_URL}/meal-plan/log`

export const MEAL_LOG_MAX_NAME_LENGTH = 120
export const MEAL_LOG_MAX_DETAILS_LENGTH = 300
export const MEAL_LOG_MIN_SERVINGS = 0.25
export const MEAL_LOG_MAX_SERVINGS = 20
export const MEAL_LOG_MAX_CALORIES = 5000

export function mealLogKey(weekStart: string) {
  return `${MEAL_LOG_URL}?weekStart=${weekStart}`
}

export function isMealLogKey(key: unknown) {
  return Array.isArray(key) && typeof key[0] === "string" && key[0].startsWith(`${MEAL_LOG_URL}?`)
}

const referenceSchema = z.object({ title: z.string(), url: z.string() })

export const calorieSourceSchema = z.enum(["RECIPE", "USER", "WEB_ESTIMATE"])

const entrySchema = z.object({
  id: z.string(),
  date: z.string(),
  section: z.enum(MEAL_SECTIONS),
  source: z.enum(["PLAN", "RECIPE", "CUSTOM"]),
  recipeId: z.string().nullable(),
  name: z.string(),
  servings: z.number(),
  caloriesPerServing: z.number().nullable(),
  calories: z.number().nullable(),
  calorieSource: calorieSourceSchema.nullable(),
  calorieNote: z.string().nullable(),
  calorieReferences: z.array(referenceSchema),
  createdAt: z.string(),
})

const weekSchema = z.object({
  weekStart: z.string(),
  today: z.string(),
  dailyCalorieTarget: z.number().nullable(),
  dailyCalorieMin: z.number().nullable(),
  dailyCalorieMax: z.number().nullable(),
  days: z.array(
    z.object({
      day: z.enum(WEEKDAYS),
      date: z.string(),
      loggable: z.boolean(),
      entries: z.array(entrySchema),
      loggedCalories: z.number(),
      unknownCalorieEntries: z.number(),
      plannedCalories: z.number().nullable(),
    })
  ),
  summary: z.object({
    loggedDays: z.number(),
    completeDays: z.number(),
    averageCalories: z.number().nullable(),
    remainingDays: z.number(),
  }),
})

const estimateSchema = z.object({
  caloriesPerServing: z.number().nullable(),
  note: z.string().nullable(),
  references: z.array(referenceSchema),
})

export type MealLogEntry = z.infer<typeof entrySchema>
export type MealLogWeek = z.infer<typeof weekSchema>
export type MealLogDay = MealLogWeek["days"][number]
export type CalorieReference = z.infer<typeof referenceSchema>
export type CalorieEstimate = z.infer<typeof estimateSchema>

export type CalorieInput = {
  caloriesPerServing: number
  calorieSource: "USER" | "WEB_ESTIMATE"
  calorieNote?: string
  calorieReferences?: CalorieReference[]
}

export type NewMealLogEntry = {
  date: string
  section: (typeof MEAL_SECTIONS)[number]
  servings?: number
} & ({ recipeId: string } | ({ name: string } & Partial<CalorieInput>))

export type MealLogChange = {
  section?: (typeof MEAL_SECTIONS)[number]
  servings?: number
  name?: string
  caloriesPerServing?: number | null
  calorieSource?: "USER" | "WEB_ESTIMATE"
  calorieNote?: string
  calorieReferences?: CalorieReference[]
}

export function fetchMealLog([url, token]: readonly [string, string]) {
  return sendJson(weekSchema, url, token, { cache: "no-store" })
}

export function createMealLogEntry(token: string, entry: NewMealLogEntry) {
  return sendJson(entrySchema, MEAL_LOG_URL, token, {
    method: "POST",
    body: JSON.stringify(entry),
  })
}

export function updateMealLogEntry(token: string, id: string, change: MealLogChange) {
  return sendJson(entrySchema, `${MEAL_LOG_URL}/${id}`, token, {
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
  return sendJson(estimateSchema, `${MEAL_LOG_URL}/calorie-estimate`, token, {
    method: "POST",
    body: JSON.stringify(question),
    signal,
  })
}

export function caloriesLabel(entry: Pick<MealLogEntry, "calories" | "calorieSource">) {
  if (entry.calories === null) return "Chưa có kcal"
  const amount = entry.calories.toLocaleString("vi-VN")
  if (entry.calorieSource === "WEB_ESTIMATE") return `~${amount} kcal`
  return `${amount} kcal`
}

export function servingsLabel(servings: number) {
  return servings.toLocaleString("vi-VN", { maximumFractionDigits: 2 })
}
