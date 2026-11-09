import { z } from "zod"

export const planCodeSchema = z.enum(["PLUS", "PRO"])
export type PlanCode = z.infer<typeof planCodeSchema>
export const paymentSchema = z.object({
  id: z.uuid(),
  planCode: planCodeSchema,
  amount: z.string().regex(/^[1-9]\d*$/),
  currency: z.literal("VND"),
  durationDays: z.number().int().positive(),
  planVersion: z.union([z.literal(1), z.literal(2)]),
  purchasedPlanName: z.string(),
  textLimit: z.number().int().nonnegative(),
  imageLimit: z.number().int().nonnegative(),
  status: z.enum(["PENDING", "SUCCEEDED", "CANCELLED"]),
  invoiceNumber: z.string(),
  paymentCode: z.string(),
  createdAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  capturedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  qr: z
    .object({
      bankCode: z.string(),
      bankGateway: z.string(),
      accountNumber: z.string(),
      accountHolder: z.string(),
      storeName: z.string(),
      transferContent: z.string(),
      amount: z.string(),
      currency: z.literal("VND"),
      imageUrl: z.url().refine((value) => new URL(value).origin === "https://vietqr.app"),
      downloadUrl: z.url().refine((value) => new URL(value).origin === "https://vietqr.app"),
    })
    .nullable(),
})
export type Payment = z.infer<typeof paymentSchema>
export const catalogSchema = z.object({
  planVersion: z.literal(2),
  freeLimits: z.object({
    textLimit: z.number().int().nonnegative(),
    imageLimit: z.number().int().nonnegative(),
  }),
  paymentsEnabled: z.boolean(),
  plans: z.array(
    z.object({
      code: planCodeSchema,
      name: z.string(),
      priceVnd: z.string(),
      durationDays: z.number().int().positive(),
      textLimit: z.number().int().nonnegative(),
      imageLimit: z.number().int().nonnegative(),
    })
  ),
})
export const allowanceSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  resetsAt: z.iso.datetime(),
  period: z.enum(["DAY", "CYCLE"]),
})
export const overviewSchema = z.object({
  membership: z.object({
    planCode: z.enum(["FREE", "PLUS", "PRO"]),
    startsAt: z.iso.datetime().nullable(),
    expiresAt: z.iso.datetime().nullable(),
  }),
  usage: z.object({ text: allowanceSchema, images: allowanceSchema }),
  pendingPayment: paymentSchema.nullable(),
  recentPayments: z.array(paymentSchema),
})
export const planName = (code: string) =>
  ({ FREE: "Miễn phí", PLUS: "Plus", PRO: "Pro" })[code] ?? code
export const money = (amount: string) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(amount))
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
export const paymentStatus = {
  PENDING: "Chờ thanh toán",
  SUCCEEDED: "Đã thanh toán",
  CANCELLED: "Đã hủy",
} as const
