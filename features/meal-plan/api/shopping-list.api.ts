import { SHOPPING_LIST_URL } from "@/features/meal-plan/api/meal-plan.api"
import { WEEKDAYS, type Weekday } from "@/features/meal-plan/schemas/meal-plan.schema"
import { shoppingListSchema } from "@/features/meal-plan/schemas/shopping-list.schema"
import { sendJson } from "@/features/shared/lib/api-client"

export function shoppingListKey(weekStart: string, days: readonly Weekday[]) {
  const picked = WEEKDAYS.filter((day) => days.includes(day))
  const params = new URLSearchParams({ weekStart })
  if (picked.length !== WEEKDAYS.length) params.set("days", picked.join(","))
  return `${SHOPPING_LIST_URL}?${params.toString()}`
}

export function fetchShoppingList([url, token]: readonly [string, string]) {
  return sendJson(shoppingListSchema, url, token)
}
