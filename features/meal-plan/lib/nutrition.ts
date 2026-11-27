import {
  NUTRITION_PILLARS,
  type NutritionGoal,
  type NutritionPillar,
  type NutritionProfile,
} from "@/features/dietary/dietary"
import type {
  MealPlan,
  MealSection,
  PlannedDay,
  Weekday,
} from "@/features/meal-plan/schemas/meal-plan.schema"

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
