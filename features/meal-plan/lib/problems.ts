import type { MealPlanProblem, Weekday } from "@/features/meal-plan/schemas/meal-plan.schema"

export function allergyText({ ingredients, reason }: MealPlanProblem) {
  if (reason) return reason
  if (ingredients.length > 0) return `Có ${ingredients.join(", ")}, thứ bạn không ăn.`
  return "Không hợp hồ sơ dị ứng của bạn."
}

export function problemText(problem: MealPlanProblem) {
  const { code, recipes, ingredients, reason } = problem
  if (code === "AVOIDED_INGREDIENT") {
    return `${recipes.join(", ")}: ${allergyText(problem)}`
  }
  if (code === "DAY_CONFLICT") {
    return `${ingredients.join(" và ")} không nên ăn cùng bữa${reason ? ` (${reason})` : ""}. Có trong: ${recipes.join(", ")}.`
  }
  return "Có món không còn tồn tại."
}

export function dishKey(day: Weekday, recipeId: string) {
  return `${day}:${recipeId}`
}

function dishWarningText(problem: MealPlanProblem) {
  const { code, ingredients, reason } = problem
  if (code === "DAY_CONFLICT") {
    return `${ingredients.join(" và ")} không nên ăn cùng bữa${reason ? ` (${reason})` : ""}`
  }
  return allergyText(problem)
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
