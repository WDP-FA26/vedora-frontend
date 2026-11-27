import type { ScopedMutator } from "swr"
import { z } from "zod"

import {
  MY_DIETARY_KEY,
  MY_NUTRITION_KEY,
  nutritionProfileSchema,
} from "@/features/dietary/dietary"
import { isMealLogKey } from "@/features/meal-plan/meal-log"
import { isMealPlanKey } from "@/features/meal-plan/meal-plan"

/**
 * Unified server-driven state synchronization protocol shared by both Text Chat
 * (`POST /meal-plan/chat`) and Voice (`POST /meal-plan/voice/turns`).
 *
 * The API emits transient `data-state` chunks whenever a mutating tool finishes,
 * either pushing a fresh `patch` straight into SWR (0ms instant update) or
 * listing domains to invalidate — so the frontend never mirrors backend tool names.
 */
export const plannerStateDomainSchema = z.enum([
  "plan",
  "shoppingList",
  "mealLog",
  "nutrition",
  "dietary",
])

export const plannerStateEventSchema = z.object({
  invalidate: z.array(plannerStateDomainSchema).optional(),
  patch: z
    .object({
      nutrition: nutritionProfileSchema.optional(),
    })
    .optional(),
})

export type PlannerStateEvent = z.infer<typeof plannerStateEventSchema>

export function applyPlannerState(mutate: ScopedMutator, event: PlannerStateEvent) {
  let nutritionPatched = false
  if (event.patch?.nutrition) {
    nutritionPatched = true
    void mutate(
      (key) => Array.isArray(key) && key[0] === MY_NUTRITION_KEY,
      event.patch.nutrition,
      { revalidate: false }
    )
  }

  const domains = event.invalidate ?? []
  let planMutated = false
  for (const domain of domains) {
    if (domain === "plan" || domain === "shoppingList") {
      if (!planMutated) {
        planMutated = true
        void mutate(isMealPlanKey)
      }
      continue
    }
    if (domain === "mealLog") {
      void mutate(isMealLogKey)
      continue
    }
    if (domain === "nutrition" && !nutritionPatched) {
      void mutate((key) => Array.isArray(key) && key[0] === MY_NUTRITION_KEY)
      continue
    }
    if (domain === "dietary") {
      void mutate((key) => Array.isArray(key) && key[0] === MY_DIETARY_KEY)
    }
  }
}
