import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import { sendJson } from "@/features/shared/lib/api-client"

export const DIETARY_PATH = "/home/dietary"

export const MY_DIETARY_KEY = `${API_URL}/dietary/me`
export const MY_NUTRITION_KEY = `${API_URL}/dietary/nutrition`

export const BIOLOGICAL_SEXES = ["FEMALE", "MALE", "OTHER"] as const
export const ACTIVITY_LEVELS = ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE"] as const
export const NUTRITION_GOALS = ["LOSE_WEIGHT", "MAINTAIN", "GAIN_WEIGHT"] as const
export const BMI_CATEGORIES = ["UNDERWEIGHT", "NORMAL", "OVERWEIGHT", "OBESE"] as const
export const BODY_FEELINGS = ["ENERGETIC", "NORMAL", "TIRED", "BLOATED"] as const
export const NUTRITION_PILLARS = [
  "PLANT_PROTEIN",
  "FIBER_VEG",
  "HEALTHY_FAT",
  "IRON_RICH",
  "CALCIUM_RICH",
] as const

export const biologicalSexSchema = z.enum(BIOLOGICAL_SEXES)
export const activityLevelSchema = z.enum(ACTIVITY_LEVELS)
export const nutritionGoalSchema = z.enum(NUTRITION_GOALS)
export const bmiCategorySchema = z.enum(BMI_CATEGORIES)
export const bodyFeelingSchema = z.enum(BODY_FEELINGS)
export const nutritionPillarSchema = z.enum(NUTRITION_PILLARS)

export type BiologicalSex = z.infer<typeof biologicalSexSchema>
export type ActivityLevel = z.infer<typeof activityLevelSchema>
export type NutritionGoal = z.infer<typeof nutritionGoalSchema>
export type BmiCategory = z.infer<typeof bmiCategorySchema>
export type BodyFeeling = z.infer<typeof bodyFeelingSchema>
export type NutritionPillar = z.infer<typeof nutritionPillarSchema>

export const BIOLOGICAL_SEX_LABELS: Record<BiologicalSex, string> = {
  FEMALE: "Nữ",
  MALE: "Nam",
  OTHER: "Khác",
}

export const ACTIVITY_LEVEL_LABELS: Record<
  ActivityLevel,
  { label: string; hint: string }
> = {
  SEDENTARY: { label: "Ít vận động", hint: "Làm việc văn phòng, ít đi lại" },
  LIGHT: { label: "Vận động nhẹ", hint: "Đi bộ, việc nhà, tập 1–2 buổi/tuần" },
  MODERATE: { label: "Vận động vừa", hint: "Tập thể thao 3–5 buổi/tuần" },
  ACTIVE: { label: "Năng động", hint: "Vận động nặng hoặc tập hằng ngày" },
}

export const NUTRITION_GOAL_LABELS: Record<
  NutritionGoal,
  { label: string; shortLabel: string; hint: string }
> = {
  LOSE_WEIGHT: {
    label: "Giảm cân nhẹ nhàng",
    shortLabel: "Kiểm soát cân",
    hint: "Thâm hụt vừa phải (~350 kcal/ngày), ưu tiên bữa tối thanh nhẹ",
  },
  MAINTAIN: {
    label: "Giữ dáng & cân bằng",
    shortLabel: "Giữ dáng",
    hint: "Duy trì mức năng lượng cân bằng và đủ 5 nhóm chất chay",
  },
  GAIN_WEIGHT: {
    label: "Tăng cân lành mạnh",
    shortLabel: "Bồi bổ",
    hint: "Thêm bữa phụ hoặc ghép món giàu đạm & béo tốt để không đầy bụng",
  },
}

export const BMI_CATEGORY_META: Record<
  BmiCategory,
  { label: string; description: string; toneClass: string }
> = {
  UNDERWEIGHT: {
    label: "Cần bồi bổ",
    description: "Cơ thể đang cần thêm năng lượng dự trữ (< 18,5)",
    toneClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  NORMAL: {
    label: "Cân đối",
    description: "Vùng BMI hài hòa theo chuẩn Châu Á (18,5 – 22,9)",
    toneClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  OVERWEIGHT: {
    label: "Hơi dư năng lượng",
    description: "Trên mốc cân đối nhẹ theo chuẩn Châu Á (23,0 – 24,9)",
    toneClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  OBESE: {
    label: "Ưu tiên nhẹ bụng",
    description: "Nên ưu tiên thực đơn thanh đạm, giàu xơ & đạm thực vật (>= 25,0)",
    toneClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
}

export const BODY_FEELING_LABELS: Record<BodyFeeling, string> = {
  ENERGETIC: "Đủ sức",
  NORMAL: "Bình thường",
  TIRED: "Hơi mệt",
  BLOATED: "Đầy bụng",
}

export const NUTRITION_PILLAR_META: Record<
  NutritionPillar,
  { label: string; shortLabel: string; tip: string }
> = {
  PLANT_PROTEIN: {
    label: "Đạm thực vật",
    shortLabel: "Đạm",
    tip: "Đậu hũ, tempeh, các loại đậu, nấm giúp giữ cơ và no lâu",
  },
  FIBER_VEG: {
    label: "Chất xơ & rau củ",
    shortLabel: "Xơ",
    tip: "Rau lá, củ quả, nấm hỗ trợ tiêu hóa và ổn định đường huyết",
  },
  HEALTHY_FAT: {
    label: "Chất béo tốt",
    shortLabel: "Béo tốt",
    tip: "Hạt mè, hạt điều, đậu phộng, quả bơ giúp hấp thu vitamin tan trong dầu",
  },
  IRON_RICH: {
    label: "Giàu sắt",
    shortLabel: "Sắt",
    tip: "Nên ăn cùng cà chua/chanh (Vitamin C) và tránh trà, cà phê ngay sau bữa",
  },
  CALCIUM_RICH: {
    label: "Giàu canxi",
    shortLabel: "Canxi",
    tip: "Đậu hũ, cải xanh, mè đen, sữa hạt bổ sung canxi bảo vệ xương",
  },
}

const dietaryMemorySchema = z.object({
  allergies: z.array(z.string()),
  preferences: z.array(z.string()),
})

export const bodyMetricLogSchema = z.object({
  id: z.string(),
  date: z.string(),
  weightKg: z.number(),
  heightCm: z.number(),
  bmi: z.number(),
  feeling: bodyFeelingSchema.nullable(),
  note: z.string().nullable(),
  updatedAt: z.string(),
})

export const nutritionProfileSchema = z.object({
  heightCm: z.number().nullable(),
  weightKg: z.number().nullable(),
  targetWeightKg: z.number().nullable(),
  birthYear: z.number().nullable(),
  biologicalSex: biologicalSexSchema.nullable(),
  activityLevel: activityLevelSchema.nullable(),
  nutritionGoal: nutritionGoalSchema.nullable(),
  bmi: z.number().nullable(),
  bmiCategory: bmiCategorySchema.nullable(),
  suggestedGoal: nutritionGoalSchema.nullable(),
  effectiveGoal: nutritionGoalSchema.nullable(),
  idealWeightMinKg: z.number().nullable(),
  idealWeightMaxKg: z.number().nullable(),
  bmr: z.number().nullable(),
  tdee: z.number().nullable(),
  dailyCalorieTarget: z.number().nullable(),
  dailyCalorieMin: z.number().nullable(),
  dailyCalorieMax: z.number().nullable(),
  safetyNote: z.string().nullable(),
  history: z.array(bodyMetricLogSchema),
})

export type DietaryMemory = z.infer<typeof dietaryMemorySchema>
export type BodyMetricLog = z.infer<typeof bodyMetricLogSchema>
export type NutritionProfile = z.infer<typeof nutritionProfileSchema>

export const MAX_MEMORY_ITEMS = 30
export const MAX_MEMORY_ITEM_LENGTH = 200

export function memoryLines(text: string): string[] {
  const lines: string[] = []
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (line !== "" && !lines.includes(line)) lines.push(line)
  }
  return lines
}

const memoryText = z
  .string()
  .refine((text) => memoryLines(text).length <= MAX_MEMORY_ITEMS, `Tối đa ${MAX_MEMORY_ITEMS} dòng.`)
  .refine(
    (text) => memoryLines(text).every((line) => line.length <= MAX_MEMORY_ITEM_LENGTH),
    `Mỗi dòng tối đa ${MAX_MEMORY_ITEM_LENGTH} ký tự.`
  )

export const dietaryFormSchema = z.object({ allergies: memoryText, preferences: memoryText })
export type DietaryFormValues = z.infer<typeof dietaryFormSchema>

export type SaveDietaryInput = { allergies?: string[]; preferences?: string[] }

export type SaveNutritionInput = {
  heightCm?: number | null
  weightKg?: number | null
  targetWeightKg?: number | null
  birthYear?: number | null
  biologicalSex?: BiologicalSex | null
  activityLevel?: ActivityLevel | null
  nutritionGoal?: NutritionGoal | null
  feeling?: BodyFeeling | null
  note?: string | null
}

export type WeightCheckInInput = {
  weightKg: number
  heightCm?: number
  date?: string
  feeling?: BodyFeeling | null
  note?: string | null
}

type Key = readonly [string, string]

export function fetchMyDietary([url, token]: Key) {
  return sendJson(dietaryMemorySchema, url, token)
}

export function saveMyDietary(token: string, body: SaveDietaryInput) {
  return sendJson(dietaryMemorySchema, MY_DIETARY_KEY, token, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export function fetchMyNutrition([url, token]: Key) {
  return sendJson(nutritionProfileSchema, url, token)
}

export function saveMyNutrition(token: string, body: SaveNutritionInput) {
  return sendJson(nutritionProfileSchema, MY_NUTRITION_KEY, token, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export function checkInWeight(token: string, body: WeightCheckInInput) {
  return sendJson(nutritionProfileSchema, `${MY_NUTRITION_KEY}/check-in`, token, {
    method: "POST",
    body: JSON.stringify(body),
  })
}
