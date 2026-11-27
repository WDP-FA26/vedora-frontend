import { ApiError } from "@/features/shared/lib/api-client"

export function formatFormalTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number) => String(value).padStart(2, "0")
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const day = pad(date.getDate())
  const month = pad(date.getMonth() + 1)
  const year = date.getFullYear()
  return `${hours}:${minutes} ${day}/${month}/${year}`
}

const SUPPORT_ERROR_MESSAGES: Record<string, string> = {
  APPEAL_IN_PROGRESS: "Nội dung đang có hồ sơ kháng cáo chưa đóng nên tạm khóa chỉnh sửa và xoá.",
  APPEAL_WINDOW_EXPIRED: "Đã quá thời hạn 14 ngày để gửi kháng cáo cho nội dung này.",
  ALREADY_APPEALED: "Nội dung này đã được giải quyết kháng cáo trước đó.",
  WITHDRAWAL_LIMIT_REACHED: "Bạn đã đạt giới hạn số lần rút và gửi lại kháng cáo.",
  POST_NOT_APPEALABLE: "Nội dung này hiện không thuộc diện kháng cáo.",
  TICKET_POST_REQUIRED: "Cần chọn nội dung muốn kháng cáo.",
  TICKET_SUBJECT_REQUIRED: "Vui lòng nhập tiêu đề cho yêu cầu hỗ trợ.",
  TICKET_LIMIT_REACHED:
    "Bạn đang có tối đa 5 hồ sơ hỗ trợ chưa đóng. Vui lòng chờ xử lý xong trước khi tạo thêm.",
  TICKET_ALREADY_CLOSED: "Hồ sơ này đã đóng và không thể cập nhật thêm.",
  TICKET_WAIT_FOR_ADMIN:
    "Bạn đã gửi 3 phản hồi liên tiếp. Vui lòng chờ quản trị viên trả lời trước khi gửi thêm.",
  TICKET_MESSAGE_LIMIT_REACHED: "Hồ sơ đã đạt giới hạn số lượt trao đổi.",
  TICKET_CODE_COLLISION: "Không tạo được mã hồ sơ. Vui lòng thử lại.",
  INVALID_TICKET_DECISION: "Hành động không hợp lệ với loại hồ sơ này.",
  RESOLUTION_NOTE_REQUIRED: "Cần ghi rõ lý do (tối thiểu 5 ký tự) cho quyết định này.",
  TICKET_MESSAGE_EMPTY: "Hãy nhập nội dung hoặc đính kèm ảnh.",
  TICKET_REOPEN_WINDOW_EXPIRED:
    "Hồ sơ đã đóng quá 30 ngày nên không mở lại được. Vui lòng tạo yêu cầu mới.",
  TICKET_CLAIMED_BY_OTHER:
    "Hồ sơ đang do quản trị viên khác phụ trách. Hãy tiếp quản trước khi phản hồi hoặc kết luận.",
  TICKET_NOT_CLAIMED: "Hồ sơ chưa có người phụ trách.",
  UNKNOWN_ATTACHMENT: "Ảnh đính kèm không hợp lệ hoặc đã được gửi. Vui lòng chọn lại ảnh.",
  ATTACHMENT_NOT_UPLOADED: "Ảnh chưa tải lên xong. Vui lòng thử gửi lại.",
  ATTACHMENT_LIMIT_REACHED: "Bạn đang có quá nhiều ảnh chưa gửi. Vui lòng thử lại sau.",
  FILE_TOO_LARGE: "Ảnh vượt quá dung lượng cho phép (10 MB).",
}

export function supportErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code && error.code in SUPPORT_ERROR_MESSAGES) {
      return SUPPORT_ERROR_MESSAGES[error.code]
    }
    if (error.message && error.message.trim().length > 0 && error.status < 500) {
      return error.message
    }
  }
  return fallback
}
