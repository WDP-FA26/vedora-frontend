import { z } from "zod"

export const grantUserSchema = z.object({
  id: z.uuid(), username: z.string(), fullName: z.string(), email: z.string(),
  role: z.enum(["ADMIN", "USER"]), status: z.enum(["ACTIVE", "SUSPENDED", "PENDING_EMAIL"]),
})
export const grantUsersSchema = z.object({ items: z.array(grantUserSchema), total: z.number().int().nonnegative(), page: z.number().int().positive(), limit: z.number().int().positive() })
export const subscriptionGrantSchema = z.object({
  id: z.uuid(), userId: z.uuid(), actorId: z.uuid(), reason: z.string(), planCode: z.enum(["PLUS", "PRO"]),
  catalogVersion: z.number().int().nonnegative(), durationDays: z.number().int().positive(),
  textLimit: z.number().int().nonnegative(), imageLimit: z.number().int().nonnegative(),
  startsAt: z.iso.datetime(), expiresAt: z.iso.datetime(), createdAt: z.iso.datetime(),
})
export const grantUserDetailSchema = z.object({
  user: grantUserSchema,
  membership: z.object({ key: z.string(), planCode: z.enum(["FREE", "PLUS", "PRO"]), source: z.enum(["FREE", "PAYMENT", "ADMIN_GRANT"]), startsAt: z.iso.datetime(), expiresAt: z.iso.datetime(), textLimit: z.number().int().nonnegative(), imageLimit: z.number().int().nonnegative() }),
  pendingPayment: z.object({ id: z.uuid(), expiresAt: z.iso.datetime() }).nullable(),
  recentGrants: z.array(subscriptionGrantSchema),
})
export const grantInputSchema = z.object({
  userId: z.uuid(), planCode: z.enum(["PLUS", "PRO"]), catalogVersion: z.number().int().nonnegative(), expectedPeriodKey: z.string().min(1),
  reason: z.string().trim().min(3, "Lý do cần ít nhất 3 ký tự.").max(500, "Lý do tối đa 500 ký tự."),
})
export type GrantUserDetail = z.infer<typeof grantUserDetailSchema>
export type SubscriptionGrant = z.infer<typeof subscriptionGrantSchema>
