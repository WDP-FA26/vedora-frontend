import type { Metadata } from "next"
import { Suspense } from "react"

import { MealPlannerView } from "@/features/meal-plan/components/meal-planner-view"

export const metadata: Metadata = {
  title: "Lên thực đơn · Vedora",
}

export default function MealPlannerPage() {
  return (
    <Suspense fallback={null}>
      <MealPlannerView />
    </Suspense>
  )
}
