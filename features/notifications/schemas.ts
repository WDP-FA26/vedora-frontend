import { z } from "zod"

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(["LIKE", "COMMENT", "REPOST", "FOLLOW"]),
  actor: z.object({
    id: z.string(),
    username: z.string(),
    fullName: z.string(),
    avatarUrl: z.string().nullable().optional(),
  }),
  /** Null for `FOLLOW`. */
  postId: z.string().nullable(),
  commentId: z.string().nullable().optional(),
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
