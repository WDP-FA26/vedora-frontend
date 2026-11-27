import { z } from "zod"

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum([
    "SUBSCRIPTION_GRANTED",
    "LIKE",
    "COMMENT",
    "COMMENT_REPLY",
    "COMMENT_REMOVED",
    "COMMENT_REMOVED_BY_POST_OWNER",
    "COMMENT_THREAD_REMOVED",
    "COMMENT_REPORT_RESOLVED",
    "COMMENT_REPORT_DISMISSED",
    "REPOST",
    "FOLLOW",
    "POST_PUBLISHED",
    "POST_PENDING_REVIEW",
    "POST_APPROVED",
    "POST_REJECTED",
    "POST_REMOVED",
    "POST_RESTORED",
    "REPORT_RESOLVED",
    "REPORT_DISMISSED",
    "REPORTED_POST_REMOVED",
    "SUPPORT_TICKET_REPLIED",
    "SUPPORT_TICKET_RESOLVED",
    "SUPPORT_TICKET_CLOSED",
    "SUPPORT_TICKET_EXPIRED",
    "SUPPORT_TICKET_REMINDER",
    "WORKSPACE_APPROVED",
    "WORKSPACE_REJECTED",
    "WORKSPACE_MANAGER_ADDED",
    "WORKSPACE_MANAGER_REMOVED",
  ]),
  actor: z
    .object({
      id: z.string(),
      username: z.string(),
      fullName: z.string(),
      avatarUrl: z.string().nullable().optional(),
      isProfessional: z.boolean().default(false),
    })
    .nullable(),
  postId: z.string().nullable(),
  postType: z.enum(["POST", "BLOG"]).nullable().optional(),
  reason: z.string().nullable().optional(),
  reasonText: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  commentId: z.string().nullable().optional(),
  ticketId: z.string().nullable().optional(),
  workspaceId: z.string().nullable().optional(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
})

export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
})

export const unreadCountSchema = z.object({ unreadCount: z.number() })

export type ApiNotification = z.infer<typeof notificationSchema>
export type NotificationPage = z.infer<typeof notificationPageSchema>
