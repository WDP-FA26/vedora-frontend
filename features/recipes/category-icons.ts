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

import type { RecipeCategoryIcon } from "@/features/recipes/schemas"

// Mirrors vedora-api's `RecipeCategoryIcon`.
export const RECIPE_CATEGORY_ICON_VIEWS: Record<
  RecipeCategoryIcon,
  { label: string; icon: LucideIcon }
> = {
  SOUP: { label: "Tô canh", icon: SoupIcon },
  SALAD: { label: "Salad", icon: SaladIcon },
  POT: { label: "Nồi cơm", icon: CookingPotIcon },
  WHEAT: { label: "Bông lúa", icon: WheatIcon },
  FLAME: { label: "Ngọn lửa", icon: FlameIcon },
  SANDWICH: { label: "Bánh mì", icon: SandwichIcon },
  CAKE: { label: "Bánh ngọt", icon: CakeSliceIcon },
  COFFEE: { label: "Cốc nước", icon: CoffeeIcon },
  COOKIE: { label: "Bánh quy", icon: CookieIcon },
  UTENSILS: { label: "Dao nĩa", icon: UtensilsIcon },
}
