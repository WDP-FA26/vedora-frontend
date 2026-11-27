import { z } from "zod"
import { catalogSchema } from "@/features/billing/schema"

export const adminPlansSchema = catalogSchema.extend({
  id: z.uuid(),
  version: z.number().int().nonnegative(),
  source: z.enum(["ENV", "DATABASE"]),
  updatedAt: z.iso.datetime().nullable(),
  updatedById: z.string().nullable(),
})
export type AdminPlans = z.infer<typeof adminPlansSchema>
export type ManagedPlanCode = "FREE" | "PLUS" | "PRO"
export type ManagedPlan = {
  code: ManagedPlanCode
  name: string
  priceVnd: string
  durationDays: number | null
  textLimit: number
  imageLimit: number
}

export function planRows(catalog: AdminPlans): ManagedPlan[] {
  return [
    { code: "FREE", name: "Free", priceVnd: "0", durationDays: null, ...catalog.freeLimits },
    ...catalog.plans,
  ]
}

export type PlanDraft = { priceVnd: string; textLimit: string; imageLimit: string }

function integerInput(label: string, min: number, max: number) {
  return z.string().regex(/^\d+$/, `${label} phải là số nguyên.`)
    .transform(Number)
    .pipe(z.number().int().min(min, `${label} tối thiểu ${min}.`).max(max, `${label} tối đa ${max.toLocaleString("vi-VN")}.`))
}

export const paidDraftSchema = z.object({
  priceVnd: integerInput("Giá", 1, 1_000_000_000),
  textLimit: integerInput("Hạn mức AI chữ", 0, 1_000_000),
  imageLimit: integerInput("Hạn mức tạo ảnh", 0, 1_000_000),
})
export const freeDraftSchema = paidDraftSchema.omit({ priceVnd: true })

export function updatePayload(catalog: AdminPlans, code: ManagedPlanCode, draft: PlanDraft) {
  const limits = freeDraftSchema.parse(draft)
  const paid = code === "FREE" ? null : paidDraftSchema.parse(draft)
  return {
    version: catalog.version,
    freeLimits: code === "FREE" ? limits : catalog.freeLimits,
    plans: catalog.plans.map((plan) => ({
      code: plan.code,
      priceVnd: code === plan.code && paid ? paid.priceVnd : Number(plan.priceVnd),
      textLimit: code === plan.code ? limits.textLimit : plan.textLimit,
      imageLimit: code === plan.code ? limits.imageLimit : plan.imageLimit,
    })),
  }
}
