"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { APICallError, DefaultChatTransport, type UIMessage } from "ai"

import { API_URL } from "@/features/auth/lib/api"
import {
  clearGuestSession,
  useGuestToken,
} from "@/features/nutrition-chat/lib/guest-session"

const CONTEXT_MESSAGES = 5

type ChatMessage = UIMessage<{ refused?: boolean }>

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Chào bạn! Mình là Trợ lý Vedora, có thể gợi ý về dinh dưỡng khi ăn thực vật. Bạn muốn hỏi gì?",
    },
  ],
}

export function messageText(message: UIMessage) {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")
}

export type GuestLimit = "quota" | "closed"

function guestLimit(error: Error): GuestLimit | null {
  if (!APICallError.isInstance(error)) return null
  if (error.responseBody?.includes("GUEST_QUOTA_REACHED")) return "quota"
  if (error.responseBody?.includes("GUEST_CHAT_CLOSED")) return "closed"
  return null
}

function errorMessage(error: Error) {
  if (APICallError.isInstance(error) && error.statusCode === 401) {
    return "Phiên dùng thử đã hết hạn. Đợi xác minh lại rồi gửi lần nữa nhé."
  }
  if (APICallError.isInstance(error) && error.statusCode === 429) {
    return "Bạn gửi hơi nhanh. Đợi một chút rồi hỏi tiếp nhé."
  }
  if (APICallError.isInstance(error) && error.statusCode === 503) {
    return "Trợ lý Vedora đang tạm nghỉ. Bạn quay lại sau nhé."
  }
  if (error.message === "RATE_LIMITED") {
    return "Trợ lý đang quá tải. Bạn thử lại sau ít phút nhé."
  }
  return "Mình chưa trả lời được. Thử lại nhé."
}

function withoutRefusals(messages: ChatMessage[]) {
  return messages.filter(
    (message, index) => !message.metadata?.refused && !messages[index + 1]?.metadata?.refused
  )
}

const transport = new DefaultChatTransport<ChatMessage>({
  api: `${API_URL}/nutrition-chat`,
  prepareSendMessagesRequest: ({ messages, headers }) => ({
    headers,
    body: {
      messages: withoutRefusals(messages.filter((message) => message.id !== WELCOME.id))
        .slice(-CONTEXT_MESSAGES)
        .map((message) => ({ role: message.role, text: messageText(message) })),
    },
  }),
})

export function useNutritionChat() {
  const guestToken = useGuestToken()
  const [limit, setLimit] = useState<GuestLimit | null>(null)

  const { messages, status, error, sendMessage, setMessages, stop, clearError } = useChat<ChatMessage>({
    transport,
    messages: [WELCOME],
    onError: (error) => {
      if (APICallError.isInstance(error) && error.statusCode === 401) clearGuestSession()
      setLimit(guestLimit(error))
    },
  })

  const busy = status === "submitted" || status === "streaming"
  const last = messages.at(-1)
  const replying = busy && last?.role === "assistant" && messageText(last) !== ""

  return {
    messages,
    busy,
    thinking: busy && !replying,
    pendingId: busy && !replying && last?.role === "assistant" ? last.id : null,
    streamingId: replying ? last.id : null,
    limit,
    ready: guestToken !== null,
    error: error && !limit ? errorMessage(error) : null,
    send: (text: string) =>
      void sendMessage(
        { text },
        { headers: guestToken ? { Authorization: `Bearer ${guestToken}` } : undefined }
      ),
    reset: () => {
      void stop()
      clearError()
      setMessages([WELCOME])
    },
  }
}
