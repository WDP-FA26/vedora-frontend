import { API_URL } from "@/features/auth/lib/api"

// SWR keys are `[url, accessToken]`; the lists are fetched whole with `fetchAll*`.

export const INGREDIENTS_KEY = `${API_URL}/admin/ingredients`
export const INGREDIENT_GROUPS_KEY = `${API_URL}/admin/ingredient-groups`
export const INCOMPATIBILITY_RULES_KEY = `${API_URL}/admin/incompatibility-rules`
export const RECIPES_KEY = `${API_URL}/admin/recipes`

export function recipeKey(id: string) {
  return `${RECIPES_KEY}/${id}`
}

/** The forbidden pairs in a set of ingredients; the ids ride in the SWR key. */
export const RECIPE_CONFLICTS_KEY = `${RECIPES_KEY}/conflicts`

/** Every list and detail above: one catalog edit can change what the others show. */
export const RECIPE_CATALOG_KEYS = [
  INGREDIENTS_KEY,
  INGREDIENT_GROUPS_KEY,
  INCOMPATIBILITY_RULES_KEY,
  RECIPES_KEY,
]

export const RECIPES_PATH = "/admin/recipes"
export const NEW_RECIPE_PATH = `${RECIPES_PATH}/new`

export function recipeEditPath(id: string) {
  return `${RECIPES_PATH}/${id}`
}

/** Tabs of the `/admin/recipes` page, kept in `?tab=`. */
export const RECIPE_CATALOG_TABS = ["recipes", "ingredients", "rules"] as const
export type RecipeCatalogTab = (typeof RECIPE_CATALOG_TABS)[number]

export function isRecipeCatalogTab(value: unknown): value is RecipeCatalogTab {
  return RECIPE_CATALOG_TABS.some((tab) => tab === value)
}
