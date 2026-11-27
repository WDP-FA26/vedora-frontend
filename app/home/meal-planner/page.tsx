import { redirect } from "next/navigation"

import { MEAL_PLANNER_PATH } from "@/features/meal-plan/meal-plan"

export default function LegacyMealPlannerPage() {
  redirect(MEAL_PLANNER_PATH)
}
