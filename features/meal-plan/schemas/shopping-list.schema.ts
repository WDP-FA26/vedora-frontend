import { z } from "zod"

import { daySchema, sectionSchema } from "@/features/meal-plan/schemas/meal-plan.schema"

export const shoppingListSchema = z.object({
  weekStart: z.string(),
  days: z.array(daySchema),
  quantityBasis: z.literal("RECIPE_PER_OCCURRENCE"),
  items: z.array(
    z.object({
      ingredientId: z.string(),
      name: z.string(),
      unit: z.string().nullable(),
      knownQuantity: z.string().nullable(),
      hasUnknownQuantity: z.boolean(),
      contributions: z.array(
        z.object({
          recipeId: z.string(),
          recipeTitle: z.string(),
          day: daySchema,
          section: sectionSchema,
          servings: z.number(),
          quantity: z.string().nullable(),
          note: z.string().nullable(),
        })
      ),
    })
  ),
})

export type ShoppingList = z.infer<typeof shoppingListSchema>
export type ShoppingItem = ShoppingList["items"][number]
