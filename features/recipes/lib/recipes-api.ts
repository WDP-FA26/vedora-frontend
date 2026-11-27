import type { RecipeTag } from "@/features/recipes/tags"
import type { z } from "zod"

import {
  INCOMPATIBILITY_RULES_KEY,
  INGREDIENT_GROUPS_KEY,
  favoriteKey,
  INGREDIENTS_KEY,
  myRatingKey,
  RECIPE_CATEGORIES_KEY,
  RECIPES_KEY,
} from "@/features/recipes/recipes-cache"
import {
  favoriteRecipePageSchema,
  favoriteStateSchema,
  incompatibilityRulePageSchema,
  incompatibilityRuleSchema,
  ingredientGroupPageSchema,
  ingredientGroupSchema,
  recipeCategoryPageSchema,
  recipeCategorySchema,
  type RecipeCategory,
  type RecipeCategoryIcon,
  ingredientPageSchema,
  ingredientSchema,
  myRatingSchema,
  publicRecipeDetailSchema,
  publicRecipePageSchema,
  ratingSummarySchema,
  recipeConflictsSchema,
  recipeDetailSchema,
  recipeDraftSchema,
  recipeImageUploadSchema,
  recipePageSchema,
  type RuleSide,
} from "@/features/recipes/schemas"
import { send, sendJson } from "@/features/shared/lib/api-client"

/** The API's `MAX_PAGE_LIMIT`. */
const PAGE_LIMIT = 50

type Key = readonly [string, string]
type PageSchema<T> = z.ZodType<{ items: T[]; meta: { hasNextPage: boolean } }>

/** The admin tables sort, filter and page in the browser, so they need every row. */
async function fetchAll<T>(schema: PageSchema<T>, [url, token]: Key) {
  const rows: T[] = []
  for (let page = 1; ; page++) {
    const { items, meta } = await sendJson(
      schema,
      `${url}?page=${page}&limit=${PAGE_LIMIT}`,
      token
    )
    rows.push(...items)
    if (!meta.hasNextPage) return rows
  }
}

export const fetchAllIngredients = (key: Key) => fetchAll(ingredientPageSchema, key)
export const fetchAllIngredientGroups = (key: Key) =>
  fetchAll(ingredientGroupPageSchema, key)
export const fetchAllRecipeCategories = (key: Key) =>
  fetchAll(recipeCategoryPageSchema, key)
export const fetchAllRules = (key: Key) => fetchAll(incompatibilityRulePageSchema, key)
export const fetchAllRecipes = (key: Key) => fetchAll(recipePageSchema, key)

export function fetchRecipe([url, token]: Key) {
  return sendJson(recipeDetailSchema, url, token)
}

export function fetchConflicts([url, token, ids]: readonly [string, string, string]) {
  return sendJson(recipeConflictsSchema, url, token, {
    method: "POST",
    body: JSON.stringify({ ingredientIds: ids.split(",") }),
  })
}

/** `POST` to the collection, or `PUT` to the row when `id` is given. */
function save<S extends z.ZodType>(
  schema: S,
  collection: string,
  token: string,
  id: string | undefined,
  body: unknown
) {
  return sendJson(schema, id ? `${collection}/${id}` : collection, token, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(body),
  })
}

export type IngredientInput = { name: string; aliases: string[]; groupIds: string[] }
export const saveIngredient = (token: string, id: string | undefined, body: IngredientInput) =>
  save(ingredientSchema, INGREDIENTS_KEY, token, id, body)

export type IngredientGroupInput = {
  name: string
  description?: string
  dietary: boolean
  ingredientIds: string[]
}
export const saveIngredientGroup = (
  token: string,
  id: string | undefined,
  body: IngredientGroupInput
) => save(ingredientGroupSchema, INGREDIENT_GROUPS_KEY, token, id, body)

export type RecipeCategoryInput = {
  name: string
  description?: string
  baseTag: RecipeTag
  icon: RecipeCategoryIcon
  hidden: boolean
}
export const saveRecipeCategory = (
  token: string,
  id: string | undefined,
  body: RecipeCategoryInput
) => save(recipeCategorySchema, RECIPE_CATEGORIES_KEY, token, id, body)

/** `ids` is every category, first to last; the API renumbers them. */
export async function reorderRecipeCategories(token: string, ids: string[]) {
  await send(`${RECIPE_CATEGORIES_KEY}/order`, token, {
    method: "PUT",
    body: JSON.stringify({ ids }),
  })
}

type RuleSideInput = Pick<RuleSide, "kind" | "id">
export type RuleInput = {
  a: RuleSideInput
  b: RuleSideInput
  reason: string
  source?: string
}
export const saveRule = (token: string, id: string | undefined, body: RuleInput) =>
  save(incompatibilityRuleSchema, INCOMPATIBILITY_RULES_KEY, token, id, body)

export type RecipeInput = {
  title: string
  description?: string
  imageUrl?: string
  /** `null` clears the tag; the API replaces the whole recipe. */
  tag: RecipeTag | null
  servings: number
  prepMinutes?: number
  cookMinutes?: number
  caloriesPerServing?: number | null
  ingredients: { ingredientId: string; quantity?: number; unit?: string; note?: string }[]
  steps: string[]
  postId?: string
}
export const saveRecipe = (token: string, id: string | undefined, body: RecipeInput) =>
  save(recipeDetailSchema, RECIPES_KEY, token, id, body)

/**
 * What AI reads a recipe draft from: a post's caption and transcripts (only
 * `mediaId`'s transcript when given), pasted text, or the recipe on the form.
 * `instruction` is the admin's own request and the only part AI follows as
 * instructions, so never fold it into `text` or `currentRecipe`.
 */
export type RecipeDraftSource = (
  | { postId: string; mediaId?: string }
  | { text: string }
  | { currentRecipe: string }
) & { instruction?: string }

/** Asks AI to read `source` into a recipe draft; nothing is saved. */
export function requestRecipeDraft(token: string, source: RecipeDraftSource) {
  return sendJson(recipeDraftSchema, `${RECIPES_KEY}/drafts`, token, {
    method: "POST",
    body: JSON.stringify(source),
  })
}

export async function deleteRow(collection: string, token: string, id: string) {
  await send(`${collection}/${id}`, token, { method: "DELETE" })
}

const FEED_PAGE_LIMIT = 12

/**
 * The public list is readable signed out; the token is sent only when there is one.
 * `tag` keeps only recipes of that dish type (a category's `baseTag`).
 */
export function fetchPublicRecipePage([url, page, tag, token]: readonly [
  string,
  number,
  RecipeTag | null,
  string | undefined,
]) {
  const params = new URLSearchParams({ page: String(page), limit: String(FEED_PAGE_LIMIT) })
  if (tag) params.set("tag", tag)
  return sendJson(publicRecipePageSchema, `${url}?${params}`, token)
}

/** Every category that is not hidden, in the admin's order; readable signed out. */
export async function fetchPublicRecipeCategories([url]: readonly [string]) {
  const rows: RecipeCategory[] = []
  for (let page = 1; ; page++) {
    const { items, meta } = await sendJson(
      recipeCategoryPageSchema,
      `${url}?page=${page}&limit=${PAGE_LIMIT}`,
      undefined
    )
    rows.push(...items)
    if (!meta.hasNextPage) return rows
  }
}

/** One page of catalog recipes whose title, description or ingredients contain `q`. */
export function fetchRecipeSearchPage([url, q, page, limit, token]: readonly [
  string,
  string,
  number,
  number,
  string | undefined,
]) {
  const params = new URLSearchParams({ q, page: String(page), limit: String(limit) })
  return sendJson(publicRecipePageSchema, `${url}?${params}`, token)
}

export function fetchPublicRecipe([url, token]: readonly [string, string | undefined]) {
  return sendJson(publicRecipeDetailSchema, url, token)
}

export function fetchRatingSummary([url]: readonly [string, undefined]) {
  return sendJson(ratingSummarySchema, url, undefined)
}

/** The user id rides in the key only so each account gets its own cache entry. */
export function fetchMyRating([url, token]: readonly [string, string, string]) {
  return sendJson(myRatingSchema, url, token)
}

/** Sets the caller's score (1–5), or removes it when `value` is null. */
export function setRecipeRating(token: string, recipeId: string, value: number | null) {
  return sendJson(myRatingSchema, myRatingKey(recipeId), token, {
    method: value === null ? "DELETE" : "PUT",
    body: value === null ? undefined : JSON.stringify({ value }),
  })
}

export function fetchFavoritePage([url, token]: readonly [string, string]) {
  return sendJson(favoriteRecipePageSchema, url, token)
}

/** Saves the recipe (`PUT`) or removes it (`DELETE`); both are idempotent. */
export function setRecipeFavorite(token: string, recipeId: string, saved: boolean) {
  return sendJson(favoriteStateSchema, favoriteKey(recipeId), token, {
    method: saved ? "PUT" : "DELETE",
  })
}

export function requestRecipeImageUpload(token: string) {
  return sendJson(recipeImageUploadSchema, `${RECIPES_KEY}/image-uploads`, token, { method: "POST" })
}
