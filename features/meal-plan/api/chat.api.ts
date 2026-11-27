import { API_URL } from "@/features/auth/lib/api"
import {
  chatRewindSchema,
  chatThreadDetailSchema,
  chatThreadListSchema,
  type SyncChatMessageInput,
} from "@/features/meal-plan/schemas/chat.schema"
import { send, sendJson } from "@/features/shared/lib/api-client"

export const MEAL_PLANNER_CHAT_URL = `${API_URL}/meal-plan/chat`
export const MEAL_PLANNER_CHAT_THREADS_KEY = `${API_URL}/meal-plan/chat/threads`

export function fetchChatThreads([url, token]: readonly [string, string]) {
  return sendJson(chatThreadListSchema, url, token)
}

export function fetchChatThread(token: string, threadId: string) {
  return sendJson(chatThreadDetailSchema, `${MEAL_PLANNER_CHAT_THREADS_KEY}/${threadId}`, token)
}

export function createChatThread(token: string, body: { id?: string; title?: string } = {}) {
  return sendJson(chatThreadDetailSchema, MEAL_PLANNER_CHAT_THREADS_KEY, token, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function updateChatThread(
  token: string,
  threadId: string,
  body: {
    title?: string
    messages?: SyncChatMessageInput[]
  }
) {
  return sendJson(chatThreadDetailSchema, `${MEAL_PLANNER_CHAT_THREADS_KEY}/${threadId}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export function rewindChatThread(token: string, threadId: string, messageId: string) {
  return sendJson(chatRewindSchema, `${MEAL_PLANNER_CHAT_THREADS_KEY}/${threadId}/rewind`, token, {
    method: "POST",
    body: JSON.stringify({ messageId }),
  })
}

export async function deleteChatThread(token: string, threadId: string) {
  await send(`${MEAL_PLANNER_CHAT_THREADS_KEY}/${threadId}`, token, {
    method: "DELETE",
  })
}
