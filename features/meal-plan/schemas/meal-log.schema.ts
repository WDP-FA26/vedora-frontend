import { z } from "zod"

import { MEAL_SECTIONS, WEEKDAYS } from "@/features/meal-plan/schemas/meal-plan.schema"

export const MEAL_LOG_MAX_NAME_LENGTH = 120
export const MEAL_LOG_MAX_DETAILS_LENGTH = 300
export const MEAL_LOG_MIN_SERVINGS = 0.25
export const MEAL_LOG_MAX_SERVINGS = 20
export const MEAL_LOG_MAX_CALORIES = 5000

export const calorieReferenceSchema = z.object({ title: z.string(), url: z.string() })

export const calorieSourceSchema = z.enum(["RECIPE", "USER", "WEB_ESTIMATE"])

export const mealLogEntrySchema = z.object({
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
  calorieReferences: z.array(calorieReferenceSchema),
  createdAt: z.string(),
})

export const mealLogWeekSchema = z.object({
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
      entries: z.array(mealLogEntrySchema),
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

export const calorieEstimateSchema = z.object({
  caloriesPerServing: z.number().nullable(),
  note: z.string().nullable(),
  references: z.array(calorieReferenceSchema),
})

export type MealLogEntry = z.infer<typeof mealLogEntrySchema>
export type MealLogWeek = z.infer<typeof mealLogWeekSchema>
export type MealLogDay = MealLogWeek["days"][number]
export type CalorieReference = z.infer<typeof calorieReferenceSchema>
export type CalorieEstimate = z.infer<typeof calorieEstimateSchema>

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
