import { redirect } from "next/navigation"

import { MEAL_PLANNER_PATH } from "@/features/meal-plan/meal-plan"

/** The planner moved to its own full-screen page; old links keep working. */
export default function LegacyMealPlannerPage() {
  redirect(MEAL_PLANNER_PATH)
}
