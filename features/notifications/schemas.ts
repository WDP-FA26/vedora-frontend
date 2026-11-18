import { z } from "zod"

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum([
    "LIKE",
    "COMMENT",
    "REPOST",
    "FOLLOW",
    "POST_PENDING_REVIEW",
    "POST_APPROVED",
    "POST_REJECTED",
    "POST_REMOVED",
    "REPORT_RESOLVED",
    "REPORT_DISMISSED",
    "REPORTED_POST_REMOVED",
  ]),
  /** Null for notifications from Vedora itself, such as moderation. */
  actor: z
    .object({
      id: z.string(),
      username: z.string(),
      fullName: z.string(),
      avatarUrl: z.string().nullable().optional(),
    })
    .nullable(),
  /** Null for `FOLLOW`. */
  postId: z.string().nullable(),
  postType: z.enum(["POST", "BLOG"]).nullable().optional(),
  /**
   * Moderation: why the post was blocked, e.g. `violence`. Report outcomes and
   * `POST_REMOVED`: the report reason, e.g. `SPAM`.
   */
  reason: z.string().nullable().optional(),
  /** `reason` worded for the author, from the current policy. */
  reasonText: z.string().nullable().optional(),
  /**
   * Moderation: the admin's note. `POST_REMOVED` and `REPORTED_POST_REMOVED`:
   * the removed post's title or opening words, since the post is gone.
   */
  note: z.string().nullable().optional(),
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
