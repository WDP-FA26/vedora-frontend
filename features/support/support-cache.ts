import { API_URL } from "@/features/auth/lib/api"
import type {
  AppealTriggerStatus,
  SupportTicketCategory,
  SupportTicketStatus,
} from "@/features/support/schemas"

export const SUPPORT_PATH = "/home/support"
export const ADMIN_SUPPORT_PATH = "/admin/support"

export const SUPPORT_TICKETS_KEY = `${API_URL}/support/tickets`
export const ADMIN_SUPPORT_TICKETS_KEY = `${API_URL}/admin/support/tickets`
export const SUPPORT_ATTACHMENTS_URL = `${API_URL}/support/attachments`

export type AdminAssigneeFilter = "me" | "unassigned"

export function supportTicketPath(id: string) {
  return `${SUPPORT_PATH}/${id}`
}

export function adminSupportTicketPath(id: string) {
  return `${ADMIN_SUPPORT_PATH}/${id}`
}

export function mySupportTicketsKey(
  params: {
    status?: SupportTicketStatus
    category?: SupportTicketCategory
    page?: number
    limit?: number
  } = {}
) {
  const query = new URLSearchParams()
  if (params.status) query.set("status", params.status)
  if (params.category) query.set("category", params.category)
  if (params.page) query.set("page", String(params.page))
  if (params.limit) query.set("limit", String(params.limit))
  const qs = query.toString()
  return qs ? `${SUPPORT_TICKETS_KEY}?${qs}` : SUPPORT_TICKETS_KEY
}

export function supportTicketKey(id: string) {
  return `${SUPPORT_TICKETS_KEY}/${id}`
}

export function adminSupportTicketsKey(
  params: {
    status?: SupportTicketStatus
    category?: SupportTicketCategory
    triggerStatus?: AppealTriggerStatus
    assignee?: AdminAssigneeFilter
    q?: string
    page?: number
    limit?: number
  } = {}
) {
  const query = new URLSearchParams()
  if (params.status) query.set("status", params.status)
  if (params.category) query.set("category", params.category)
  if (params.triggerStatus) query.set("triggerStatus", params.triggerStatus)
  if (params.assignee) query.set("assignee", params.assignee)
  if (params.q?.trim()) query.set("q", params.q.trim())
  if (params.page) query.set("page", String(params.page))
  if (params.limit) query.set("limit", String(params.limit))
  const qs = query.toString()
  return qs ? `${ADMIN_SUPPORT_TICKETS_KEY}?${qs}` : ADMIN_SUPPORT_TICKETS_KEY
}

export function adminSupportTicketKey(id: string) {
  return `${ADMIN_SUPPORT_TICKETS_KEY}/${id}`
}
