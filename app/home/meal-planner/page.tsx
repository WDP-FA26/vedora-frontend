import type { Metadata } from "next"

import { MealPlannerView } from "@/features/meal-plan/components/meal-planner-view"

export const metadata: Metadata = {
  title: "Lên thực đơn · Vedora",
}

export default function MealPlannerPage() {
  return <MealPlannerView />
}
