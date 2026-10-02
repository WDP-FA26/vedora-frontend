"use client"

import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { APICallError, DefaultChatTransport, isToolUIPart, type UIMessage } from "ai"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { API_URL } from "@/features/auth/lib/api"

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
      text: "Chào bạn! Mình có thể gợi ý về dinh dưỡng khi ăn thực vật. Bạn muốn hỏi gì?",
    },
  ],
}

export function messageText(message: UIMessage) {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")
}

function errorMessage(error: Error) {
  if (APICallError.isInstance(error) && error.statusCode === 429) {
    return "Bạn gửi hơi nhanh. Đợi một chút rồi hỏi tiếp nhé."
  }
  if (APICallError.isInstance(error) && error.statusCode === 503) {
    return "Trợ lý dinh dưỡng đang tạm nghỉ. Bạn quay lại sau nhé."
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
 * The conversation with vedora-api's `POST /nutrition-chat`, which streams
 * the reply from OpenRouter. The greeting stays client-side.
 */
export function useNutritionChat() {
  const router = useRouter()
  const { accessToken } = useAuth()

  const { messages, status, error, sendMessage, setMessages, stop, clearError } = useChat<ChatMessage>({
    transport,
    messages: [WELCOME],
    onError: (error) => {
      // expired while the popover sat open: the proxy rotates the pair on refresh
      if (APICallError.isInstance(error) && error.statusCode === 401) router.refresh()
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
    error: error ? errorMessage(error) : null,
    send: (text: string) =>
      void sendMessage(
        { text },
        { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined }
      ),
    reset: () => {
      void stop()
      clearError()
      setMessages([WELCOME])
    },
  }
}
