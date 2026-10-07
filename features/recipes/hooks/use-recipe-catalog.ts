"use client"

import useSWR, { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  fetchAllIngredientGroups,
  fetchAllIngredients,
  fetchAllRecipes,
  fetchAllRules,
  fetchConflicts,
  fetchRecipe,
} from "@/features/recipes/lib/recipes-api"
import {
  INCOMPATIBILITY_RULES_KEY,
  INGREDIENT_GROUPS_KEY,
  INGREDIENTS_KEY,
  RECIPE_CATALOG_KEYS,
  RECIPE_CONFLICTS_KEY,
  RECIPES_KEY,
  recipeKey,
} from "@/features/recipes/recipes-cache"
import type {
  IncompatibilityRule,
  Ingredient,
  IngredientGroup,
  Recipe,
  RecipeConflict,
} from "@/features/recipes/schemas"

// TanStack Table rebuilds its row models whenever `data` changes identity.
const NO_INGREDIENTS: Ingredient[] = []
const NO_GROUPS: IngredientGroup[] = []
const NO_RULES: IncompatibilityRule[] = []
const NO_RECIPES: Recipe[] = []
const NO_CONFLICTS: RecipeConflict[] = []

function useKey(url: string | null) {
  const { accessToken } = useAuth()
  return url && accessToken ? ([url, accessToken] as const) : null
}

export function useIngredients() {
  const { data, error, isLoading } = useSWR(useKey(INGREDIENTS_KEY), fetchAllIngredients)
  return { ingredients: data ?? NO_INGREDIENTS, error, isLoading }
}

export function useIngredientGroups() {
  const { data, error, isLoading } = useSWR(
    useKey(INGREDIENT_GROUPS_KEY),
    fetchAllIngredientGroups
  )
  return { groups: data ?? NO_GROUPS, error, isLoading }
}

export function useIncompatibilityRules() {
  const { data, error, isLoading } = useSWR(
    useKey(INCOMPATIBILITY_RULES_KEY),
    fetchAllRules
  )
  return { rules: data ?? NO_RULES, error, isLoading }
}

export function useRecipes() {
  const { data, error, isLoading } = useSWR(useKey(RECIPES_KEY), fetchAllRecipes)
  return { recipes: data ?? NO_RECIPES, error, isLoading }
}

export function useRecipe(id: string | null) {
  const { data, error } = useSWR(useKey(id && recipeKey(id)), fetchRecipe)
  return { recipe: data ?? null, error }
}

/** The pairs among these ingredients that a rule forbids, kept while the set changes. */
export function useConflicts(ingredientIds: string[]) {
  const { accessToken } = useAuth()
  const ids = [...new Set(ingredientIds.filter(Boolean))].sort()
  const { data } = useSWR(
    accessToken && ids.length > 1
      ? ([RECIPE_CONFLICTS_KEY, accessToken, ids.join(",")] as const)
      : null,
    fetchConflicts,
    { keepPreviousData: true }
  )
  return ids.length > 1 ? (data ?? NO_CONFLICTS) : NO_CONFLICTS
}

/**
 * Refetches every recipe catalog list and detail. An edit to one shows up in
 * the others (a renamed ingredient in rules, a new rule as recipe conflicts).
 */
export function useRefreshRecipeCatalog() {
  const { mutate } = useSWRConfig()
  return () =>
    mutate(
      (key) =>
        Array.isArray(key) &&
        RECIPE_CATALOG_KEYS.some((prefix) => String(key[0]).startsWith(prefix))
    )
}
