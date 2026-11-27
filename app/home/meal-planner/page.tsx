import { redirect } from "next/navigation"

import { MEAL_PLANNER_PATH } from "@/features/meal-plan/api/meal-plan.api"

export default function LegacyMealPlannerPage() {
  redirect(MEAL_PLANNER_PATH)
}
