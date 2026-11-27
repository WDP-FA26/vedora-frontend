import { sendJson } from "@/features/shared/lib/api-client"
import { ADMIN_PLANS_KEY } from "./api"
import { grantUsersSchema, grantUserDetailSchema, subscriptionGrantSchema, grantInputSchema } from "./grant-schema"

export const grantUsersKey = (q: string, page: number) => `${ADMIN_PLANS_KEY}/users?${new URLSearchParams({ q, page: String(page), limit: "10" })}`
export const grantUserKey = (id: string) => `${ADMIN_PLANS_KEY}/users/${id}`
export const fetchGrantUsers = ([url, token]: readonly [string, string]) => sendJson(grantUsersSchema, url, token, { cache: "no-store" })
export const fetchGrantUser = ([url, token]: readonly [string, string]) => sendJson(grantUserDetailSchema, url, token, { cache: "no-store" })
export const createGrant = (token: string, input: Parameters<typeof grantInputSchema.parse>[0], key: string) =>
  sendJson(subscriptionGrantSchema, `${ADMIN_PLANS_KEY}/grants`, token, { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(grantInputSchema.parse(input)) })
