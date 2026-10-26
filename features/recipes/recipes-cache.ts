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

/** Public, read-only catalog (`GET /recipes`), as opposed to the admin `RECIPES_KEY`. */
export const PUBLIC_RECIPES_KEY = `${API_URL}/recipes`

export function publicRecipeKey(id: string) {
  return `${PUBLIC_RECIPES_KEY}/${id}`
}

/** Count and mean of a recipe's ratings, readable signed out. */
export function ratingSummaryKey(id: string) {
  return `${publicRecipeKey(id)}/ratings/summary`
}

/** The summary plus the signed-in user's own score. */
export function myRatingKey(id: string) {
  return `${publicRecipeKey(id)}/rating`
}

/** The signed-in user's saved recipes; the page number is added by `favoritesKey`. */
export const FAVORITES_KEY = `${PUBLIC_RECIPES_KEY}/favorites`
export const FAVORITES_PAGE_LIMIT = 20

export function favoritesKey(page: number) {
  return `${FAVORITES_KEY}?page=${page}&limit=${FAVORITES_PAGE_LIMIT}`
}

export function favoriteKey(id: string) {
  return `${publicRecipeKey(id)}/favorite`
}

/**
 * Saved state the user set in this session, by recipe id, under
 * `[FAVORITE_OVERRIDES_KEY, userId]`. The feed pages live in `useSWRInfinite`,
 * which a global `mutate` cannot patch, so every card reads its state here first.
 */
export const FAVORITE_OVERRIDES_KEY = "recipe-favorite-overrides"

/** The "Công thức" tab of `/home/bookmarks`. */
export const SAVED_RECIPES_PATH = "/home/bookmarks?tab=recipes"
