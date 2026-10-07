import { z } from "zod"

// Mirrors vedora-api's `/admin/ingredients`, `/admin/ingredient-groups`,
// `/admin/incompatibility-rules` and `/admin/recipes` (admin only).

const namedRefSchema = z.object({ id: z.string(), name: z.string() })

const page = <S extends z.ZodType>(item: S) =>
  z.object({ items: z.array(item), meta: z.object({ hasNextPage: z.boolean() }) })

export const ingredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  groups: z.array(namedRefSchema),
  recipeCount: z.number(),
  createdAt: z.string(),
})
export const ingredientPageSchema = page(ingredientSchema)

export const ingredientGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  /** Offered to users as a food category they can avoid. */
  dietary: z.boolean(),
  ingredients: z.array(namedRefSchema),
  createdAt: z.string(),
})
export const ingredientGroupPageSchema = page(ingredientGroupSchema)

export const RULE_SIDE_KINDS = ["INGREDIENT", "GROUP"] as const

const ruleSideSchema = namedRefSchema.extend({ kind: z.enum(RULE_SIDE_KINDS) })

export const incompatibilityRuleSchema = z.object({
  id: z.string(),
  a: ruleSideSchema,
  b: ruleSideSchema,
  reason: z.string(),
  source: z.string().nullable(),
  createdAt: z.string(),
})
export const incompatibilityRulePageSchema = page(incompatibilityRuleSchema)

const recipeConflictSchema = z.object({
  ruleId: z.string(),
  a: namedRefSchema,
  b: namedRefSchema,
  reason: z.string(),
  source: z.string().nullable(),
})
export const recipeConflictsSchema = z.array(recipeConflictSchema)

export const recipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  servings: z.number(),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
  ingredientCount: z.number(),
  conflicts: recipeConflictsSchema,
  post: z
    .object({
      id: z.string(),
      author: z.object({ username: z.string(), fullName: z.string() }),
    })
    .nullable(),
  updatedAt: z.string(),
})
export const recipePageSchema = page(recipeSchema)

export const recipeDetailSchema = recipeSchema.extend({
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

export type NamedRef = z.infer<typeof namedRefSchema>
export type Ingredient = z.infer<typeof ingredientSchema>
export type IngredientGroup = z.infer<typeof ingredientGroupSchema>
export type IncompatibilityRule = z.infer<typeof incompatibilityRuleSchema>
export type RuleSide = z.infer<typeof ruleSideSchema>
export type RecipeConflict = z.infer<typeof recipeConflictSchema>
export type Recipe = z.infer<typeof recipeSchema>
export type RecipeDetail = z.infer<typeof recipeDetailSchema>

// Forms. Limits match the API DTOs.

const MAX_NAME = 100
const MAX_TEXT = 500
export const MAX_ALIASES = 20

const name = z
  .string()
  .trim()
  .min(1, "Nhập tên.")
  .max(MAX_NAME, `Tên dài tối đa ${MAX_NAME} ký tự.`)

/** "đậu phụ, tofu" → ["đậu phụ", "tofu"], without blanks or repeats. */
export function parseAliases(text: string) {
  return [...new Set(text.split(",").map((alias) => alias.trim()).filter(Boolean))]
}

export const ingredientFormSchema = z.object({
  name,
  aliases: z
    .string()
    .refine((text) => parseAliases(text).length <= MAX_ALIASES, {
      message: `Tối đa ${MAX_ALIASES} tên gọi khác.`,
    })
    .refine((text) => parseAliases(text).every((alias) => alias.length <= MAX_NAME), {
      message: `Mỗi tên dài tối đa ${MAX_NAME} ký tự.`,
    }),
  groupIds: z.array(z.string()),
})
export type IngredientFormValues = z.infer<typeof ingredientFormSchema>

export const ingredientGroupFormSchema = z.object({
  name,
  description: z.string().trim().max(MAX_TEXT, `Mô tả dài tối đa ${MAX_TEXT} ký tự.`),
  dietary: z.boolean(),
  ingredientIds: z.array(z.string()),
})
export type IngredientGroupFormValues = z.infer<typeof ingredientGroupFormSchema>

/** A rule side in a form: `INGREDIENT:<id>` or `GROUP:<id>`. */
export function ruleSideKey(side: Pick<RuleSide, "kind" | "id">) {
  return `${side.kind}:${side.id}`
}

export function parseRuleSideKey(key: string) {
  const [kind, id] = key.split(":")
  return { kind: kind as RuleSide["kind"], id }
}

export const ruleFormSchema = z
  .object({
    a: z.string().min(1, "Chọn nguyên liệu hoặc nhóm."),
    b: z.string().min(1, "Chọn nguyên liệu hoặc nhóm."),
    reason: z
      .string()
      .trim()
      .min(1, "Nhập lý do.")
      .max(MAX_TEXT, `Lý do dài tối đa ${MAX_TEXT} ký tự.`),
    source: z.string().trim().max(MAX_TEXT, `Nguồn dài tối đa ${MAX_TEXT} ký tự.`),
  })
  .refine(({ a, b }) => !a.startsWith("INGREDIENT:") || a !== b, {
    path: ["b"],
    message: "Chọn một nguyên liệu khác với vế bên kia.",
  })
export type RuleFormValues = z.infer<typeof ruleFormSchema>

export const MAX_RECIPE_INGREDIENTS = 50
export const MAX_RECIPE_STEPS = 50

const wholeNumber = (max: number, message: string) =>
  z.string().refine((text) => /^\d+$/.test(text) && Number(text) <= max, { message })

const optionalMinutes = z
  .string()
  .refine((text) => text === "" || (/^\d+$/.test(text) && Number(text) <= 1440), {
    message: "Nhập số phút, tối đa 1440.",
  })

export const recipeFormSchema = z.object({
  title: z.string().trim().min(1, "Nhập tên món.").max(150, "Tên món dài tối đa 150 ký tự."),
  description: z.string().trim().max(1000, "Mô tả dài tối đa 1000 ký tự."),
  servings: wholeNumber(100, "Nhập số khẩu phần từ 1 đến 100.").refine(
    (text) => Number(text) >= 1,
    { message: "Nhập số khẩu phần từ 1 đến 100." }
  ),
  prepMinutes: optionalMinutes,
  cookMinutes: optionalMinutes,
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string().min(1, "Chọn nguyên liệu."),
        quantity: z
          .string()
          .refine(
            (text) =>
              text === "" ||
              (/^\d+([.,]\d{1,2})?$/.test(text) && Number(text.replace(",", ".")) > 0),
            { message: "Nhập số lớn hơn 0, tối đa 2 chữ số thập phân." }
          ),
        unit: z.string().trim().max(30, "Tối đa 30 ký tự."),
        note: z.string().trim().max(200, "Tối đa 200 ký tự."),
      })
    )
    .min(1, "Thêm ít nhất một nguyên liệu.")
    .max(MAX_RECIPE_INGREDIENTS)
    .superRefine((rows, context) => {
      const seen = new Set<string>()
      rows.forEach(({ ingredientId }, index) => {
        if (ingredientId && seen.has(ingredientId)) {
          context.addIssue({
            code: "custom",
            path: [index, "ingredientId"],
            message: "Nguyên liệu này đã có ở trên.",
          })
        }
        seen.add(ingredientId)
      })
    }),
  steps: z
    .array(
      z.object({
        text: z.string().trim().min(1, "Nhập nội dung bước.").max(1000, "Tối đa 1000 ký tự."),
      })
    )
    .min(1, "Thêm ít nhất một bước.")
    .max(MAX_RECIPE_STEPS),
})
export type RecipeFormValues = z.infer<typeof recipeFormSchema>
