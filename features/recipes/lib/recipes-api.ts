import type { z } from "zod"

import {
  INCOMPATIBILITY_RULES_KEY,
  INGREDIENT_GROUPS_KEY,
  INGREDIENTS_KEY,
  RECIPES_KEY,
} from "@/features/recipes/recipes-cache"
import {
  incompatibilityRulePageSchema,
  incompatibilityRuleSchema,
  ingredientGroupPageSchema,
  ingredientGroupSchema,
  ingredientPageSchema,
  ingredientSchema,
  recipeConflictsSchema,
  recipeDetailSchema,
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
  servings: number
  prepMinutes?: number
  cookMinutes?: number
  ingredients: { ingredientId: string; quantity?: number; unit?: string; note?: string }[]
  steps: string[]
  postId?: string
}
export const saveRecipe = (token: string, id: string | undefined, body: RecipeInput) =>
  save(recipeDetailSchema, RECIPES_KEY, token, id, body)

export async function deleteRow(collection: string, token: string, id: string) {
  await send(`${collection}/${id}`, token, { method: "DELETE" })
}
