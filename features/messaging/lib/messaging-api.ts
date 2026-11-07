import { sendJson, ApiError } from "@/features/shared/lib/api-client"
import { MESSAGING_KEY, contactKey, conversationKey } from "../messaging-cache"
import {
  contactSchema,
  conversationPageSchema,
  conversationSchema,
  messagePageSchema,
  readReceiptSchema,
  sendMessageResponseSchema,
} from "../schemas"

export const fetchConversations = ([url, token]: readonly [string, string]) =>
  sendJson(conversationPageSchema, url, token)
export const fetchConversation = ([url, token]: readonly [string, string]) =>
  sendJson(conversationSchema, url, token)
export const fetchMessagingContact = ([url, token]: readonly [
  string,
  string,
]) => sendJson(contactSchema, url, token)
export const fetchMessages = ([url, token]: readonly [string, string]) =>
  sendJson(messagePageSchema, url, token)
export function sendDirectMessage(
  token: string,
  target: { conversationId: string } | { userId: string },
  body: string,
  clientMessageId: string,
) {
  const url =
    "conversationId" in target
      ? conversationKey(target.conversationId)
      : contactKey(target.userId)
  return sendJson(sendMessageResponseSchema, `${url}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ body, clientMessageId }),
  })
}
export function markConversationRead(
  token: string,
  id: string,
  messageId: string,
) {
  return sendJson(readReceiptSchema, `${conversationKey(id)}/read`, token, {
    method: "PUT",
    body: JSON.stringify({ messageId }),
  })
}
export const MESSAGING_STREAM_URL = `${MESSAGING_KEY}/events`
export function messagingError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "MESSAGE_FOLLOW_REQUIRED")
      return "Bạn cần theo dõi người này trước khi gửi tin nhắn."
    if (error.status === 401)
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    if (error.status === 404)
      return "Người dùng hoặc cuộc trò chuyện không còn khả dụng."
    if (error.status === 400)
      return "Không tải được trang này. Hãy tải lại hộp thư."
  }
  return "Không kết nối được. Vui lòng thử lại."
}
