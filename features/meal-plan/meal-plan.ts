import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import { sendJson } from "@/features/shared/lib/api-client"

// Mirrors vedora-api's `/meal-plan` routes: the signed-in user's weekly timetable.

export const MEAL_PLANNER_PATH = "/home/meal-planner"

/** The SWR key is `[url, accessToken]`. */
export const MEAL_PLAN_KEY = `${API_URL}/meal-plan`
export const MEAL_PLANNER_CHAT_URL = `${API_URL}/meal-plan/chat`

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

const problemSchema = z.object({
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

export type MealRecipe = z.infer<typeof mealRecipeSchema>
export type MealPlan = z.infer<typeof mealPlanSchema>
export type MealPlanProblem = z.infer<typeof problemSchema>
export type MealPlanProposal = z.infer<typeof proposalSchema>
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
