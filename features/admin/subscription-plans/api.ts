import { API_URL } from "@/features/auth/lib/api"
import { sendJson } from "@/features/shared/lib/api-client"
import { adminPlansSchema, type updatePayload } from "./schema"

export const ADMIN_PLANS_KEY = `${API_URL}/admin/subscription-plans`
export const fetchAdminPlans = ([url, token]: readonly [string, string]) =>
  sendJson(adminPlansSchema, url, token, { cache: "no-store" })

export const saveAdminPlans = (token: string, payload: ReturnType<typeof updatePayload>) =>
  sendJson(adminPlansSchema, ADMIN_PLANS_KEY, token, { method: "PUT", body: JSON.stringify(payload) })
