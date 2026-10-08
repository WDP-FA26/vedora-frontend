import { notFound } from "next/navigation"

import { MealPlannerPreview } from "@/features/meal-plan/preview/meal-planner-preview"

export default function MealPlannerPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <MealPlannerPreview />
}
