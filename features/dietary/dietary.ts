import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import { sendJson } from "@/features/shared/lib/api-client"

// Mirrors vedora-api's `/dietary` routes: what the signed-in user does not eat.

export const DIETARY_PATH = "/home/dietary"

/** SWR keys are `[url, accessToken]`. */
export const DIETARY_OPTIONS_KEY = `${API_URL}/dietary/options`
export const MY_DIETARY_KEY = `${API_URL}/dietary/me`

const namedRefSchema = z.object({ id: z.string(), name: z.string() })

const dietaryOptionsSchema = z.object({
  ingredients: z.array(namedRefSchema.extend({ aliases: z.array(z.string()) })),
  groups: z.array(namedRefSchema.extend({ ingredients: z.array(z.string()) })),
})

const dietaryRestrictionsSchema = z.object({
  ingredients: z.array(namedRefSchema),
  groups: z.array(namedRefSchema),
})

export type DietaryOptions = z.infer<typeof dietaryOptionsSchema>
export type DietaryRestrictions = z.infer<typeof dietaryRestrictionsSchema>

export const MAX_AVOIDED_INGREDIENTS = 200

/** Ids of everything the user avoids, as the API takes them. */
export const dietaryFormSchema = z.object({
  groupIds: z.array(z.string()),
  ingredientIds: z
    .array(z.string())
    .max(MAX_AVOIDED_INGREDIENTS, `Chọn tối đa ${MAX_AVOIDED_INGREDIENTS} nguyên liệu.`),
})
export type DietaryFormValues = z.infer<typeof dietaryFormSchema>

type Key = readonly [string, string]

export function fetchDietaryOptions([url, token]: Key) {
  return sendJson(dietaryOptionsSchema, url, token)
}

export function fetchMyDietary([url, token]: Key) {
  return sendJson(dietaryRestrictionsSchema, url, token)
}

export function saveMyDietary(token: string, body: DietaryFormValues) {
  return sendJson(dietaryRestrictionsSchema, MY_DIETARY_KEY, token, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}
