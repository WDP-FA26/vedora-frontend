import type { ApiNotification } from "@/features/notifications/schemas"

/** What the actor did, worded for "<name> <text>". */
export const NOTIFICATION_TEXT: Record<ApiNotification["type"], string> = {
  LIKE: "đã thích bài viết của bạn",
  COMMENT: "đã bình luận bài viết của bạn",
  REPOST: "đã đăng lại bài viết của bạn",
  FOLLOW: "đã bắt đầu theo dõi bạn",
}
