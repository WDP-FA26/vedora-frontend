import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import { sendJson } from "@/features/shared/lib/api-client"

// Mirrors vedora-api's public `GET /recipes` and `GET /recipes/:id`, which
// guests and users read; editing stays under `/admin/recipes`.

export const CATALOG_KEY = `${API_URL}/recipes`

export function catalogRecipeKey(id: string) {
  return `${CATALOG_KEY}/${id}`
}

/** Recipes whose title, description or ingredients contain `q`. */
export function catalogSearchKey(q: string) {
  const params = new URLSearchParams({ limit: "10" })
  if (q.trim()) params.set("q", q.trim().slice(0, 100))
  return `${CATALOG_KEY}?${params}`
}

const catalogItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  imageUrl: z.string().nullable(),
  servings: z.number(),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
  totalMinutes: z.number().nullable(),
})

const catalogPageSchema = z.object({
  items: z.array(catalogItemSchema),
  meta: z.object({ totalItems: z.number(), hasNextPage: z.boolean() }),
})

export const catalogRecipeSchema = catalogItemSchema.extend({
  description: z.string().nullable(),
  steps: z.array(z.string()),
  ingredients: z.array(
    z.object({
      ingredientId: z.string(),
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      note: z.string().nullable(),
    })
  ),
})

export type CatalogItem = z.infer<typeof catalogItemSchema>
export type CatalogRecipe = z.infer<typeof catalogRecipeSchema>

/** SWR fetcher for `[catalogSearchKey(q), accessToken]`. */
export function fetchCatalogPage([url, token]: readonly [string, string | undefined]) {
  return sendJson(catalogPageSchema, url, token)
}

/** SWR fetcher for `[catalogRecipeKey(id), accessToken]`. */
export function fetchCatalogRecipe([url, token]: readonly [string, string | undefined]) {
  return sendJson(catalogRecipeSchema, url, token)
}
