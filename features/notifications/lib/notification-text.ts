import type { ApiNotification } from "@/features/notifications/schemas"
import {
  PENDING_REVIEW_MESSAGE,
  rejectionMessage,
} from "@/features/posts/lib/moderation-labels"

/** What a member did, worded for "<name> <text>". */
const MEMBER_TEXT = {
  LIKE: "đã thích bài viết của bạn",
  COMMENT: "đã bình luận bài viết của bạn",
  REPOST: "đã đăng lại bài viết của bạn",
  FOLLOW: "đã bắt đầu theo dõi bạn",
} as const

type MemberType = keyof typeof MEMBER_TEXT

function subjectOf(notification: ApiNotification) {
  return notification.postType === "BLOG" ? "Blog" : "Bài viết"
}

/** Who a notification is from, and what it says. */
export function describeNotification(notification: ApiNotification) {
  const { type, actor } = notification
  if (actor && type in MEMBER_TEXT) {
    return { from: actor.fullName, text: MEMBER_TEXT[type as MemberType] }
  }
  const subject = subjectOf(notification)
  switch (type) {
    case "POST_REJECTED":
      return { from: "Vedora", text: rejectionMessage(notification.reason, subject, notification.reasonText) }
    case "POST_PENDING_REVIEW":
      return {
        from: "Vedora",
        text: `${subject} của bạn ${PENDING_REVIEW_MESSAGE} và chưa hiển thị công khai. Bạn sẽ nhận thông báo khi có kết quả.`,
      }
    case "POST_APPROVED":
      return { from: "Vedora", text: `${subject} của bạn đã được duyệt và hiển thị công khai.` }
    default:
      return { from: actor?.fullName ?? "Vedora", text: "" }
  }
}
