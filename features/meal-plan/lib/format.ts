import type { MealLogEntry } from "@/features/meal-plan/schemas/meal-log.schema"

export function formatQuantity(quantity: string) {
  const [whole, fraction = ""] = quantity.split(".")
  const trimmed = fraction.replace(/0+$/, "")
  return trimmed ? `${whole},${trimmed}` : whole
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
