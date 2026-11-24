import type { ApiNotification } from "@/features/notifications/schemas"
import {
  PENDING_REVIEW_MESSAGE,
  rejectionMessage,
} from "@/features/posts/lib/moderation-labels"
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from "@/features/posts/schemas"

/** What a member did, worded for "<name> <text>". */
const MEMBER_TEXT = {
  LIKE: "đã thích bài viết của bạn",
  COMMENT_REPLY: "đã trả lời bình luận của bạn",
  COMMENT: "đã bình luận bài viết của bạn",
  REPOST: "đã đăng lại bài viết của bạn",
  FOLLOW: "đã bắt đầu theo dõi bạn",
} as const

type MemberType = keyof typeof MEMBER_TEXT

function subjectOf(notification: ApiNotification) {
  return notification.postType === "BLOG" ? "Blog" : "Bài viết"
}

function reportReasonLabel(reason: string | null | undefined) {
  return REPORT_REASONS.includes(reason as ReportReason)
    ? REPORT_REASON_LABELS[reason as ReportReason].toLowerCase()
    : null
}

/** The removed post's title or opening words, quoted after "Bài viết". */
function quoted(note: string | null | undefined) {
  return note ? ` “${note}”` : ""
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
    case "POST_PUBLISHED":
      return { from: "Vedora", text: `${subject} của bạn đã qua kiểm duyệt và được đăng.` }
    case "POST_APPROVED":
      return { from: "Vedora", text: `${subject} của bạn đã được duyệt và hiển thị công khai.` }
    case "POST_REMOVED": {
      const reason = reportReasonLabel(notification.reason)
      return {
        from: "Vedora",
        text: `${subject}${quoted(notification.note)} của bạn đã bị quản trị viên gỡ bỏ${reason ? ` (${reason})` : notification.reason ? ` (${notification.reason})` : ""}. Bạn có thể gửi kháng cáo trong 14 ngày.`,
      }
    }
    case "POST_RESTORED":
      return {
        from: "Vedora",
        text: `${subject} của bạn đã được quản trị viên khôi phục.`,
      }
    case "SUPPORT_TICKET_REPLIED":
      return {
        from: "Vedora",
        text: `Quản trị viên đã phản hồi hồ sơ hỗ trợ của bạn. Hãy kiểm tra và trả lời trong vòng 7 ngày.`,
      }
    case "SUPPORT_TICKET_RESOLVED": {
      if (notification.reason === "APPEAL_APPROVED") {
        return {
          from: "Vedora",
          text: `Kháng cáo của bạn đã được chấp thuận. ${subject} đã được khôi phục và hiển thị trở lại.`,
        }
      }
      if (notification.reason === "APPEAL_REJECTED") {
        return {
          from: "Vedora",
          text: `Kháng cáo của bạn không được chấp thuận. Quyết định xử lý ${subject.toLowerCase()} được giữ nguyên.`,
        }
      }
      return {
        from: "Vedora",
        text: `Hồ sơ hỗ trợ của bạn đã được quản trị viên giải quyết.`,
      }
    }
    case "SUPPORT_TICKET_CLOSED":
      return {
        from: "Vedora",
        text: `Hồ sơ hỗ trợ của bạn đã được đóng.`,
      }
    case "SUPPORT_TICKET_EXPIRED":
      return {
        from: "Vedora",
        text: `Hồ sơ hỗ trợ của bạn đã tự động đóng do quá hạn phản hồi.`,
      }
    case "SUPPORT_TICKET_REMINDER":
      return {
        from: "Vedora",
        text: `Hồ sơ hỗ trợ của bạn đang chờ bạn trả lời.`,
      }
    case "REPORT_RESOLVED":
      return {
        from: "Vedora",
        text: `Cảm ơn bạn đã báo cáo. Chúng tôi đã xem xét và xử lý ${subject.toLowerCase()} bạn báo cáo.`,
      }
    case "REPORT_DISMISSED":
      return {
        from: "Vedora",
        text: `Chúng tôi đã xem xét báo cáo của bạn và không thấy ${subject.toLowerCase()} này vi phạm tiêu chuẩn cộng đồng.`,
      }
    case "REPORTED_POST_REMOVED":
      return {
        from: "Vedora",
        text: `Bài viết${quoted(notification.note)} mà bạn báo cáo đã bị gỡ khỏi Vedora. Cảm ơn bạn đã báo cáo.`,
      }
    default:
      return { from: actor?.fullName ?? "Vedora", text: "" }
  }
}
