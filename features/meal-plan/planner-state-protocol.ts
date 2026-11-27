import type { ScopedMutator } from "swr"
import { z } from "zod"

import {
  MY_DIETARY_KEY,
  MY_NUTRITION_KEY,
  nutritionProfileSchema,
  type DietaryMemory,
  type NutritionProfile,
} from "@/features/dietary/dietary"
import { isMealLogKey } from "@/features/meal-plan/meal-log"
import { isMealPlanKey } from "@/features/meal-plan/meal-plan"

export const plannerStateDomainSchema = z.enum([
  "plan",
  "shoppingList",
  "mealLog",
  "nutrition",
  "dietary",
])

export type PlannerStateDomain = z.infer<typeof plannerStateDomainSchema>

const dietaryPatchSchema = z.object({
  section: z.enum(["allergies", "preferences"]),
  lines: z.array(z.string()),
})

export const plannerStateEventSchema = z.object({
  seq: z.number().int().positive().optional(),
  invalidate: z.array(plannerStateDomainSchema).optional(),
  patch: z
    .object({
      nutrition: nutritionProfileSchema.optional(),
      dietary: dietaryPatchSchema.optional(),
    })
    .optional(),
})

export type PlannerStateEvent = z.infer<typeof plannerStateEventSchema>

const INVALIDATE_COALESCE_MS = 100
const ALL_DOMAINS: readonly PlannerStateDomain[] = [
  "plan",
  "shoppingList",
  "mealLog",
  "nutrition",
  "dietary",
]

const pendingInvalidations = new Set<PlannerStateDomain>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let activeMutator: ScopedMutator | null = null

function latestUpdatedAt(profile: NutritionProfile): string {
  let latest = ""
  for (const entry of profile.history) {
    if (entry.updatedAt > latest) latest = entry.updatedAt
  }
  return latest
}

function flushInvalidations() {
  flushTimer = null
  const mutate = activeMutator
  if (!mutate || pendingInvalidations.size === 0) {
    pendingInvalidations.clear()
    return
  }
  const domains = [...pendingInvalidations]
  pendingInvalidations.clear()

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
    if (domain === "nutrition") {
      void mutate((key) => Array.isArray(key) && key[0] === MY_NUTRITION_KEY)
      continue
    }
    if (domain === "dietary") {
      void mutate((key) => Array.isArray(key) && key[0] === MY_DIETARY_KEY)
    }
  }
}

function scheduleInvalidation(mutate: ScopedMutator, domains: readonly PlannerStateDomain[]) {
  if (domains.length === 0) return
  activeMutator = mutate
  for (const domain of domains) pendingInvalidations.add(domain)
  if (flushTimer !== null) return
  flushTimer = setTimeout(flushInvalidations, INVALIDATE_COALESCE_MS)
}

export function applyPlannerState(mutate: ScopedMutator, event: PlannerStateEvent) {
  let nutritionPatched = false
  const nextNutrition = event.patch?.nutrition
  if (nextNutrition) {
    nutritionPatched = true
    pendingInvalidations.delete("nutrition")
    void mutate(
      (key) => Array.isArray(key) && key[0] === MY_NUTRITION_KEY,
      (current: NutritionProfile | undefined) => {
        if (!current) return nextNutrition
        const currentStamp = latestUpdatedAt(current)
        const nextStamp = latestUpdatedAt(nextNutrition)
        if (currentStamp && nextStamp && nextStamp < currentStamp) return current
        return nextNutrition
      },
      { revalidate: false }
    )
  }

  let dietaryPatched = false
  const nextDietary = event.patch?.dietary
  if (nextDietary) {
    dietaryPatched = true
    pendingInvalidations.delete("dietary")
    void mutate(
      (key) => Array.isArray(key) && key[0] === MY_DIETARY_KEY,
      (current: DietaryMemory | undefined) => {
        if (!current) return undefined
        return { ...current, [nextDietary.section]: nextDietary.lines }
      },
      { revalidate: false }
    )
  }

  const domainsToInvalidate = (event.invalidate ?? []).filter((domain) => {
    if (domain === "nutrition" && nutritionPatched) return false
    if (domain === "dietary" && dietaryPatched) return false
    return true
  })
  scheduleInvalidation(mutate, domainsToInvalidate)
}

export function invalidateAllPlannerState(mutate: ScopedMutator) {
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  pendingInvalidations.clear()
  activeMutator = mutate
  for (const domain of ALL_DOMAINS) pendingInvalidations.add(domain)
  flushInvalidations()
}
