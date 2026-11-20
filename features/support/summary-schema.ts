import { z } from "zod"

export const SUPPORT_TICKET_CATEGORIES = [
  "CONTENT_APPEAL",
  "PAYMENT_ISSUE",
  "VERIFICATION",
  "GENERAL",
] as const

export const SUPPORT_TICKET_STATUSES = [
  "OPEN",
  "WAITING_USER",
  "RESOLVED",
  "CLOSED",
  "WITHDRAWN",
  "EXPIRED",
] as const

export const APPEAL_OUTCOMES = ["APPROVED", "REJECTED"] as const

export const APPEAL_REASON_CATEGORIES = [
  "FALSE_POSITIVE",
  "CONTEXT_MISUNDERSTOOD",
  "NO_MANIPULATION",
  "OTHER",
] as const

export const APPEAL_TRIGGER_STATUSES = ["REJECTED", "REMOVED"] as const

export const APPEAL_BLOCKED_REASONS = [
  "NOT_APPEALABLE",
  "APPEAL_IN_PROGRESS",
  "APPEAL_WINDOW_EXPIRED",
  "ALREADY_APPEALED",
  "WITHDRAWAL_LIMIT_REACHED",
] as const

export const SUPPORT_MESSAGE_KINDS = [
  "MESSAGE",
  "DECISION_APPROVED",
  "DECISION_REJECTED",
  "RESOLVED",
  "CLOSED",
  "WITHDRAWN",
  "EXPIRED",
  "REOPENED",
  "REMINDER",
] as const

export const postAppealTicketRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: z.enum(SUPPORT_TICKET_STATUSES),
  outcome: z.enum(APPEAL_OUTCOMES).nullable().optional().transform((v) => v ?? null),
  resolvedAt: z.string().nullable(),
})

export const postAppealSummarySchema = z.object({
  activeTicket: postAppealTicketRefSchema.nullable(),
  latestTicket: postAppealTicketRefSchema.nullable(),
  canAppeal: z.boolean(),
  deadlineAt: z.string().nullable(),
  blockedReason: z.enum(APPEAL_BLOCKED_REASONS).nullable(),
})

export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number]
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number]
export type AppealOutcome = (typeof APPEAL_OUTCOMES)[number]
export type AppealReasonCategory = (typeof APPEAL_REASON_CATEGORIES)[number]
export type AppealTriggerStatus = (typeof APPEAL_TRIGGER_STATUSES)[number]
export type AppealBlockedReason = (typeof APPEAL_BLOCKED_REASONS)[number]
export type SupportMessageKind = (typeof SUPPORT_MESSAGE_KINDS)[number]
export type PostAppealSummary = z.infer<typeof postAppealSummarySchema>

export function isTicketActiveStatus(status: SupportTicketStatus): boolean {
  return status === "OPEN" || status === "WAITING_USER"
}
