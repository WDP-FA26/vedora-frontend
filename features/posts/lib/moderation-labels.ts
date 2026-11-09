/** Why the content check blocked a post, worded for the author. */
const REASON_LABELS: Record<string, string> = {
  sexual: "nội dung nhạy cảm",
  violence: "bạo lực hoặc đe dọa",
  hate: "ngôn từ thù ghét",
  harassment: "quấy rối hoặc công kích cá nhân",
  self_harm: "nội dung liên quan đến tự hại",
  illegal: "nội dung bất hợp pháp hoặc lừa đảo",
  spam: "spam hoặc quảng cáo",
}

/**
 * The sentence that tells an author a post was blocked and why. `reasonText`
 * is the wording the API resolved from the current policy; the built-in
 * wording covers categories it no longer knows.
 */
export function rejectionMessage(
  reason: string | null | undefined,
  subject = "Bài viết",
  reasonText?: string | null
) {
  const label = reasonText ?? (reason ? REASON_LABELS[reason] : undefined)
  return label
    ? `${subject} của bạn không được đăng vì vi phạm tiêu chuẩn cộng đồng: ${label}.`
    : `${subject} của bạn không được đăng vì vi phạm tiêu chuẩn cộng đồng.`
}

export const REVIEWING_MESSAGE = "đang được kiểm duyệt"
export const PENDING_REVIEW_MESSAGE = "đang chờ quản trị viên xem xét"
