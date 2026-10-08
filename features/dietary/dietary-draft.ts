export type DietMode = "vegetarian" | "vegan" | null
export type AllergyStatus = "unset" | "none" | "some"
export type PreferenceKind = "likes" | "dislikes"
export type PantryUnit = "g" | "kg" | "ml" | "l"

export type PantryItem = {
  id: string
  name: string
  amount: string
  unit: PantryUnit
  imageUrl: string | null
}

export type FoodOption = {
  id: string
  name: string
  allergyGroup?: string
}

export type DietaryDraft = {
  dietMode: DietMode
  allergyStatus: AllergyStatus
  allergens: string[]
  customAllergens: FoodOption[]
  likes: string[]
  dislikes: string[]
  customPreferences: FoodOption[]
  pantry: PantryItem[]
}

// Shared UI catalog until the full dietary API contract is available.
export const FOOD_CATALOG: FoodOption[] = [
  { id: "peanut", name: "Đậu phộng" },
  { id: "tree-nuts", name: "Hạt cây" },
  { id: "milk", name: "Sữa" },
  { id: "egg", name: "Trứng" },
  { id: "soy", name: "Đậu nành" },
  { id: "wheat", name: "Lúa mì" },
  { id: "gluten", name: "Gluten" },
  { id: "fish", name: "Cá" },
  { id: "shellfish", name: "Hải sản có vỏ" },
  { id: "sesame", name: "Mè" },
  { id: "beef", name: "Thịt bò" },
  { id: "pork", name: "Thịt heo" },
  { id: "chicken", name: "Thịt gà" },
  { id: "honey", name: "Mật ong" },
  { id: "tofu", name: "Đậu hũ", allergyGroup: "soy" },
  { id: "mushroom", name: "Nấm" },
  { id: "lentil", name: "Đậu lăng" },
  { id: "chickpea", name: "Đậu gà" },
  { id: "spinach", name: "Rau bina" },
  { id: "tomato", name: "Cà chua" },
  { id: "rice", name: "Gạo" },
  { id: "avocado", name: "Bơ" },
  { id: "eggplant", name: "Cà tím" },
]

export const EMPTY_DRAFT: DietaryDraft = {
  dietMode: null,
  allergyStatus: "unset",
  allergens: [],
  customAllergens: [],
  likes: [],
  dislikes: [],
  customPreferences: [],
  pantry: [],
}

export function copyDraft(draft: DietaryDraft): DietaryDraft {
  return {
    ...draft,
    allergens: [...draft.allergens],
    customAllergens: draft.customAllergens.map((item) => ({ ...item })),
    likes: [...draft.likes],
    dislikes: [...draft.dislikes],
    customPreferences: draft.customPreferences.map((item) => ({ ...item })),
    pantry: draft.pantry.map((item) => ({ ...item })),
  }
}
