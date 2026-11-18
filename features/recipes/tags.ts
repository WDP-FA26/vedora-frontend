import {
  CakeSliceIcon,
  CoffeeIcon,
  CookieIcon,
  CookingPotIcon,
  FlameIcon,
  SaladIcon,
  SandwichIcon,
  SoupIcon,
  UtensilsIcon,
  WheatIcon,
  type LucideIcon,
} from "lucide-react"
import { z } from "zod"

// Mirrors vedora-api's `RecipeTag`. A recipe without a tag shows `DEFAULT_TAG_VIEW`.

export const RECIPE_TAGS = [
  "SOUP",
  "SALAD",
  "RICE",
  "NOODLES",
  "STIR_FRY",
  "BREAD",
  "DESSERT",
  "DRINK",
  "SNACK",
] as const

export const recipeTagSchema = z.enum(RECIPE_TAGS)
export type RecipeTag = z.infer<typeof recipeTagSchema>

export type TagView = { label: string; icon: LucideIcon }

export const RECIPE_TAG_VIEWS: Record<RecipeTag, TagView> = {
  SOUP: { label: "Món canh, súp", icon: SoupIcon },
  SALAD: { label: "Salad, món gỏi", icon: SaladIcon },
  RICE: { label: "Món cơm", icon: CookingPotIcon },
  NOODLES: { label: "Món bún, mì, phở", icon: WheatIcon },
  STIR_FRY: { label: "Món xào, chiên, kho", icon: FlameIcon },
  BREAD: { label: "Bánh mì, bánh mặn", icon: SandwichIcon },
  DESSERT: { label: "Tráng miệng", icon: CakeSliceIcon },
  DRINK: { label: "Đồ uống", icon: CoffeeIcon },
  SNACK: { label: "Ăn vặt", icon: CookieIcon },
}

export const DEFAULT_TAG_VIEW: TagView = { label: "Món ăn", icon: UtensilsIcon }

export function tagView(tag: RecipeTag | null | undefined): TagView {
  if (!tag) return DEFAULT_TAG_VIEW
  return RECIPE_TAG_VIEWS[tag]
}
