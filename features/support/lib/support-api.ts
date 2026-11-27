import {
  ADMIN_SUPPORT_TICKETS_KEY,
  SUPPORT_ATTACHMENTS_URL,
  SUPPORT_TICKETS_KEY,
  adminSupportTicketKey,
  supportTicketKey,
} from "@/features/support/support-cache"
import {
  adminSupportTicketDetailSchema,
  adminSupportTicketsPageSchema,
  myTicketsPageSchema,
  supportAttachmentUploadSchema,
  supportTicketDetailSchema,
  type AppealReasonCategory,
  type SupportTicketCategory,
} from "@/features/support/schemas"
import { sendJson } from "@/features/shared/lib/api-client"

export type CreateSupportTicketPayload =
  | {
      category: "CONTENT_APPEAL"
      postId: string
      reasonCategory: AppealReasonCategory
      message: string
      subject?: string
      attachmentIds?: string[]
    }
  | {
      category: Exclude<SupportTicketCategory, "CONTENT_APPEAL">
      subject: string
      message: string
      referenceCode?: string
      attachmentIds?: string[]
    }

export type SupportMessagePayload = { body?: string; attachmentIds?: string[] }

export function fetchMySupportTickets([url, token]: readonly [string, string]) {
  return sendJson(myTicketsPageSchema, url, token)
}

export function fetchMySupportTicket([url, token]: readonly [string, string]) {
  return sendJson(supportTicketDetailSchema, url, token)
}

export function createSupportTicket(token: string, payload: CreateSupportTicketPayload) {
  return sendJson(supportTicketDetailSchema, SUPPORT_TICKETS_KEY, token, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function requestSupportAttachmentUpload(token: string, file: File) {
  return sendJson(supportAttachmentUploadSchema, SUPPORT_ATTACHMENTS_URL, token, {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
  })
}

export function replyMySupportTicket(token: string, id: string, payload: SupportMessagePayload) {
  return sendJson(supportTicketDetailSchema, `${supportTicketKey(id)}/messages`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function withdrawMySupportTicket(token: string, id: string) {
  return sendJson(supportTicketDetailSchema, `${supportTicketKey(id)}/withdraw`, token, {
    method: "POST",
  })
}

export function fetchAdminSupportTickets([url, token]: readonly [string, string]) {
  return sendJson(adminSupportTicketsPageSchema, url, token)
}

export function fetchAdminSupportTicket([url, token]: readonly [string, string]) {
  return sendJson(adminSupportTicketDetailSchema, url, token)
}

export function replyAdminSupportTicket(
  token: string,
  id: string,
  payload: SupportMessagePayload & { isInternal?: boolean }
) {
  return sendJson(adminSupportTicketDetailSchema, `${adminSupportTicketKey(id)}/messages`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function claimAdminSupportTicket(token: string, id: string, force: boolean) {
  return sendJson(adminSupportTicketDetailSchema, `${adminSupportTicketKey(id)}/claim`, token, {
    method: "POST",
    body: JSON.stringify(force ? { force: true } : {}),
  })
}

export function releaseAdminSupportTicket(token: string, id: string) {
  return sendJson(adminSupportTicketDetailSchema, `${adminSupportTicketKey(id)}/release`, token, {
    method: "POST",
  })
}

export function resolveAdminSupportTicket(
  token: string,
  id: string,
  payload: { decision: "APPROVE" | "REJECT" | "RESOLVE" | "CLOSE"; note?: string }
) {
  const body = payload.note?.trim()
    ? { decision: payload.decision, note: payload.note.trim() }
    : { decision: payload.decision }
  return sendJson(adminSupportTicketDetailSchema, `${adminSupportTicketKey(id)}/resolve`, token, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function isAdminSupportCacheKey(key: unknown): boolean {
  return Array.isArray(key) && String(key[0]).startsWith(ADMIN_SUPPORT_TICKETS_KEY)
}

export function isMySupportCacheKey(key: unknown): boolean {
  return Array.isArray(key) && String(key[0]).startsWith(SUPPORT_TICKETS_KEY)
}
