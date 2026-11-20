import { z } from "zod"

import { adminPostDetailSchema } from "@/features/admin/schemas"
import { presignedUploadSchema } from "@/features/shared/lib/storage-upload"
import {
  APPEAL_BLOCKED_REASONS,
  APPEAL_OUTCOMES,
  APPEAL_REASON_CATEGORIES,
  APPEAL_TRIGGER_STATUSES,
  SUPPORT_MESSAGE_KINDS,
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_STATUSES,
  isTicketActiveStatus,
  postAppealSummarySchema,
  postAppealTicketRefSchema,
  type AppealBlockedReason,
  type AppealOutcome,
  type AppealReasonCategory,
  type AppealTriggerStatus,
  type PostAppealSummary,
  type SupportMessageKind,
  type SupportTicketCategory,
  type SupportTicketStatus,
} from "@/features/support/summary-schema"

export {
  APPEAL_BLOCKED_REASONS,
  APPEAL_OUTCOMES,
  APPEAL_REASON_CATEGORIES,
  APPEAL_TRIGGER_STATUSES,
  SUPPORT_MESSAGE_KINDS,
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_STATUSES,
  isTicketActiveStatus,
  postAppealSummarySchema,
  postAppealTicketRefSchema,
  type AppealBlockedReason,
  type AppealOutcome,
  type AppealReasonCategory,
  type AppealTriggerStatus,
  type PostAppealSummary,
  type SupportMessageKind,
  type SupportTicketCategory,
  type SupportTicketStatus,
}

export const MAX_TICKET_SUBJECT_LENGTH = 150
export const MAX_TICKET_REFERENCE_LENGTH = 100
export const MAX_TICKET_MESSAGE_LENGTH = 2000
export const MAX_TICKET_RESOLUTION_NOTE_LENGTH = 1000
export const MIN_TICKET_REJECT_NOTE_LENGTH = 5

export const NON_APPEAL_CATEGORIES: readonly Exclude<SupportTicketCategory, "CONTENT_APPEAL">[] = [
  "PAYMENT_ISSUE",
  "VERIFICATION",
  "GENERAL",
]

export const SUPPORT_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  CONTENT_APPEAL: "Kháng cáo nội dung",
  PAYMENT_ISSUE: "Thanh toán & Gói cước",
  VERIFICATION: "Xác minh chuyên gia",
  GENERAL: "Hỗ trợ chung",
}

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: "Chờ xử lý",
  WAITING_USER: "Chờ phản hồi",
  RESOLVED: "Đã giải quyết",
  CLOSED: "Đã đóng",
  WITHDRAWN: "Đã rút",
  EXPIRED: "Hết hạn phản hồi",
}

export const APPEAL_OUTCOME_LABELS: Record<AppealOutcome, string> = {
  APPROVED: "Đã chấp thuận",
  REJECTED: "Đã từ chối",
}

export const APPEAL_REASON_LABELS: Record<AppealReasonCategory, string> = {
  FALSE_POSITIVE: "Hệ thống nhận diện nhầm",
  CONTEXT_MISUNDERSTOOD: "Ngữ cảnh trích dẫn / bị hiểu sai",
  NO_MANIPULATION: "Không có ý định chèo lái AI",
  OTHER: "Lý do khác",
}

export const APPEAL_BLOCKED_LABELS: Record<AppealBlockedReason, string> = {
  NOT_APPEALABLE: "Nội dung này không thuộc diện kháng cáo.",
  APPEAL_IN_PROGRESS: "Nội dung đang có hồ sơ kháng cáo chưa đóng.",
  APPEAL_WINDOW_EXPIRED: "Đã quá thời hạn 14 ngày để nộp kháng cáo.",
  ALREADY_APPEALED: "Kháng cáo cho lần xử lý này đã có kết quả cuối cùng.",
  WITHDRAWAL_LIMIT_REACHED: "Bạn đã đạt giới hạn số lần rút kháng cáo cho lần xử lý này.",
}

const ticketAuthorSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable().optional(),
  isProfessional: z.boolean().default(false),
})

export const appealPostSnapshotSchema = z.object({
  title: z.string().nullable(),
  excerpt: z.string().nullable(),
  verdict: z.string().nullable(),
  reason: z.string().nullable(),
  routeRule: z.string().nullable(),
  routeAppliedBy: z.enum(["SYSTEM_ONE", "SYSTEM_TWO"]).nullable(),
  routeCategory: z.string().nullable(),
  blockedAt: z.string(),
})

export const supportAppealDataSchema = z.object({
  postId: z.string(),
  postType: z.enum(["POST", "BLOG"]),
  triggerStatus: z.enum(APPEAL_TRIGGER_STATUSES),
  reasonCategory: z.enum(APPEAL_REASON_CATEGORIES),
  outcome: z.enum(APPEAL_OUTCOMES).nullable(),
  postSnapshot: appealPostSnapshotSchema,
})

export const SUPPORT_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const MAX_ATTACHMENTS_PER_MESSAGE = 4
export const MAX_ATTACHMENT_MB = 10

export const supportAttachmentSchema = z.object({
  id: z.string(),
  url: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
})

export const supportAttachmentUploadSchema = z.object({
  id: z.string(),
  upload: presignedUploadSchema,
})

export const supportMessageSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  sender: ticketAuthorSchema.nullable(),
  senderRole: z.enum(["USER", "ADMIN"]),
  kind: z.enum(SUPPORT_MESSAGE_KINDS),
  isInternal: z.boolean(),
  body: z.string(),
  attachments: z.array(supportAttachmentSchema),
  createdAt: z.string(),
})

export const supportTicketListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  category: z.enum(SUPPORT_TICKET_CATEGORIES),
  subject: z.string(),
  status: z.enum(SUPPORT_TICKET_STATUSES),
  appeal: supportAppealDataSchema.nullable(),
  referenceCode: z.string().nullable(),
  lastMessageAt: z.string(),
  lastMessageByRole: z.enum(["USER", "ADMIN"]),
  messageCount: z.number().int().nonnegative(),
  waitingUserSince: z.string().nullable(),
  /** When a WAITING_USER ticket expires if the author stays silent. */
  autoCloseAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
})

export const myTicketsPageSchema = z.object({
  items: z.array(supportTicketListItemSchema),
  meta: paginationMetaSchema,
})

const ticketPostPreviewSchema = z.object({
  id: z.string(),
  type: z.enum(["POST", "BLOG"]),
  status: z.enum([
    "DRAFT",
    "PROCESSING",
    "PENDING_REVIEW",
    "PUBLISHED",
    "FAILED",
    "REJECTED",
    "REMOVED",
  ]),
  moderationVerdict: z.string().nullable().optional(),
  moderationReason: z.string().nullable().optional(),
  removalReason: z.string().nullable().optional(),
  body: z.string().nullable(),
  blog: z
    .object({
      title: z.string(),
      coverImageUrl: z.string().nullable(),
      excerpt: z.string(),
    })
    .nullable()
    .optional(),
  createdAt: z.string(),
})

export const supportTicketDetailSchema = supportTicketListItemSchema.extend({
  messages: z.array(supportMessageSchema),
  post: ticketPostPreviewSchema.nullable(),
  /** A finished non-appeal ticket reopens when the author replies before this time. */
  reopenableUntil: z.string().nullable(),
})

export const adminSupportTicketListItemSchema = supportTicketListItemSchema.extend({
  author: ticketAuthorSchema,
  resolvedBy: ticketAuthorSchema.nullable(),
  assignee: ticketAuthorSchema.nullable(),
  assignedAt: z.string().nullable(),
})

export const adminSupportStatusCountsSchema = z.object({
  open: z.number().int().nonnegative(),
  waitingUser: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
  closed: z.number().int().nonnegative(),
  withdrawn: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
})

export const adminSupportCategoryCountsSchema = z.object({
  contentAppeal: z.number().int().nonnegative(),
  paymentIssue: z.number().int().nonnegative(),
  verification: z.number().int().nonnegative(),
  general: z.number().int().nonnegative(),
})

export const adminSupportTicketsPageSchema = z.object({
  items: z.array(adminSupportTicketListItemSchema),
  meta: paginationMetaSchema,
  counts: adminSupportStatusCountsSchema,
  categoryCounts: adminSupportCategoryCountsSchema,
})

export const adminSupportTicketDetailSchema = adminSupportTicketListItemSchema.extend({
  messages: z.array(supportMessageSchema),
  post: adminPostDetailSchema.nullable(),
})

export type SupportAppealData = z.infer<typeof supportAppealDataSchema>
export type SupportAttachment = z.infer<typeof supportAttachmentSchema>
export type SupportMessage = z.infer<typeof supportMessageSchema>
export type SupportTicketListItem = z.infer<typeof supportTicketListItemSchema>
export type SupportTicketDetail = z.infer<typeof supportTicketDetailSchema>
export type MyTicketsPage = z.infer<typeof myTicketsPageSchema>
export type AdminSupportTicketListItem = z.infer<typeof adminSupportTicketListItemSchema>
export type AdminSupportStatusCounts = z.infer<typeof adminSupportStatusCountsSchema>
export type AdminSupportCategoryCounts = z.infer<typeof adminSupportCategoryCountsSchema>
export type AdminSupportTicketsPage = z.infer<typeof adminSupportTicketsPageSchema>
export type AdminSupportTicketDetail = z.infer<typeof adminSupportTicketDetailSchema>
