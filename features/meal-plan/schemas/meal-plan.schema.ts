import { z } from "zod"

import { nutritionPillarSchema } from "@/features/dietary/dietary"
import { recipeTagSchema } from "@/features/recipes/tags"

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const
export const MEAL_SECTIONS = ["BREAKFAST", "LUNCH", "DINNER", "OTHER"] as const

export type Weekday = (typeof WEEKDAYS)[number]
export type MealSection = (typeof MEAL_SECTIONS)[number]

export const MAX_DISHES_PER_SECTION = 5
export const MAX_GENERATE_QUERY_LENGTH = 100

export const daySchema = z.enum(WEEKDAYS)
export const sectionSchema = z.enum(MEAL_SECTIONS)

export const mealRecipeSchema = z.object({
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

export const mealPlanSchema = z.object({
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

export const recipeRefSchema = z.object({
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

export const generatedSchema = proposalSchema
  .omit({ ok: true })
  .extend({ problems: z.array(problemSchema) })

export const recipeSearchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      totalMinutes: z.number().nullable(),
      servings: z.number(),
    })
  ),
})

export type MealRecipe = z.infer<typeof mealRecipeSchema>
export type MealPlan = z.infer<typeof mealPlanSchema>
export type MealPlanProblem = z.infer<typeof problemSchema>
export type MealPlanProposal = z.infer<typeof proposalSchema>
export type PlanChange = z.infer<typeof planChangeSchema>
export type PlannedDay = MealPlan["days"][number]
export type RecipeOption = z.infer<typeof recipeSearchSchema>["items"][number]

export type MealDayInput = {
  day: Weekday
  breakfast: string[]
  lunch: string[]
  dinner: string[]
  others: string[]
}

export type SlotRef = { day: Weekday; section: MealSection }
export type SlotChange = SlotRef & { recipeIds: string[] }

export type GenerateRequest = {
  weekStart: string
  days: Weekday[]
  sections: MealSection[]
  onlyEmpty: boolean
  maxMinutes?: number
  query?: string
}

export type GenerateInput = Omit<GenerateRequest, "weekStart">
