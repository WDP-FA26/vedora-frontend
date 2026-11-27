import type { MealPlanProblem, Weekday } from "@/features/meal-plan/schemas/meal-plan.schema"

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
