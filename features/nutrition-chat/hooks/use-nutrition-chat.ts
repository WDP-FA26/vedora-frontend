"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { APICallError, DefaultChatTransport, isToolUIPart, type UIMessage } from "ai"

import { API_URL } from "@/features/auth/lib/api"
import {
  clearGuestSession,
  useGuestToken,
} from "@/features/nutrition-chat/lib/guest-session"

/** Mirrors `MAX_CHAT_MESSAGES` in vedora-api's NutritionChatDto. */
const CONTEXT_MESSAGES = 5

/** vedora-api marks its fixed refusals with `{ refused: true }`. */
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

/** Why a guest cannot ask more today: their own quota, or the budget for all guests. */
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
  // mid-stream failures arrive as the API's `ChatErrorCode`
  if (error.message === "RATE_LIMITED") {
    return "Trợ lý đang quá tải. Bạn thử lại sau ít phút nhé."
  }
  return "Mình chưa trả lời được. Thử lại nhé."
}

// a refused request must not ride along as context for the next message
function withoutRefusals(messages: ChatMessage[]) {
  return messages.filter(
    (message, index) => !message.metadata?.refused && !messages[index + 1]?.metadata?.refused
  )
}

// Sends plain { role, text } pairs, the shape NutritionChatDto accepts.
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

/**
 * The guest conversation with vedora-api's `POST /nutrition-chat`, which
 * streams the reply from OpenRouter. The greeting stays client-side.
 */
export function useNutritionChat() {
  const guestToken = useGuestToken()
  const [limit, setLimit] = useState<GuestLimit | null>(null)

  const { messages, status, error, sendMessage, setMessages, stop, clearError } = useChat<ChatMessage>({
    transport,
    messages: [WELCOME],
    onError: (error) => {
      // expired or rejected: the panel runs the Turnstile check again
      if (APICallError.isInstance(error) && error.statusCode === 401) clearGuestSession()
      setLimit(guestLimit(error))
    },
  })

  const busy = status === "submitted" || status === "streaming"
  const last = messages.at(-1)
  const replying = busy && last?.role === "assistant" && messageText(last) !== ""
  const searching =
    busy &&
    last?.role === "assistant" &&
    last.parts.some((part) => isToolUIPart(part) && part.state !== "output-available")

  return {
    messages,
    busy,
    /** Waiting for the reply's first text (reasoning models think first). */
    thinking: busy && !replying,
    /** The assistant is looking up the knowledge base before answering. */
    searching,
    /** The assistant message still streaming in, if any. */
    streamingId: replying ? last.id : null,
    /** Set once the guest has no messages left today; the panel offers sign-up instead. */
    limit,
    /** False until the Turnstile check has produced a guest session. */
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
