import { sendJson, ApiError } from "@/features/shared/lib/api-client"
import { MESSAGING_KEY, contactKey, conversationKey } from "../messaging-cache"
import {
  contactSchema,
  conversationPageSchema,
  conversationSchema,
  deletedRequestSchema,
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
export function sharePostInMessage(token: string, target: { conversationId: string } | { userId: string }, postId: string, clientMessageId: string) {
  const url = "conversationId" in target ? conversationKey(target.conversationId) : contactKey(target.userId)
  return sendJson(sendMessageResponseSchema, `${url}/shared-posts`, token, {
    method: "POST",
    body: JSON.stringify({ postId, clientMessageId }),
  })
}
export function acceptMessageRequest(token: string, id: string) {
  return sendJson(conversationSchema, `${conversationKey(id)}/accept`, token, {
    method: "POST",
  })
}
export function deleteMessageRequest(
  token: string,
  id: string,
  throughMessageId: string,
) {
  return sendJson(
    deletedRequestSchema,
    `${conversationKey(id)}/request`,
    token,
    {
      method: "DELETE",
      body: JSON.stringify({ throughMessageId }),
    },
  )
}
export function messagingError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "SHARED_POST_UNAVAILABLE")
      return "Bài viết không còn khả dụng để chia sẻ."
    if (error.code === "MESSAGE_REQUEST_RECEIVER_REQUIRED")
      return "Chỉ người nhận mới có thể xử lý lời mời nhắn tin này."
    if (error.code === "MESSAGE_REQUEST_NOT_PENDING")
      return "Cuộc trò chuyện đã chuyển sang bạn bè. Hãy tải lại hộp thư."
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
