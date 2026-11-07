import { API_URL } from "@/features/auth/lib/api"
import type { Inbox } from "./schemas"

export const MESSAGING_KEY = `${API_URL}/messaging`
export const MESSAGING_PATH = "/home/messages"
export const INBOX_REVISION_KEY = "messaging.inbox.revision"
export const MESSAGING_CONNECTION_KEY = "messaging.connection"
export const conversationKey = (id: string) =>
  `${MESSAGING_KEY}/conversations/${encodeURIComponent(id)}`
export const contactKey = (id: string) =>
  `${MESSAGING_KEY}/users/${encodeURIComponent(id)}`
export function inboxPageKey(box: Inbox, cursor?: string) {
  const query = new URLSearchParams({ box, limit: "20" })
  if (cursor) query.set("cursor", cursor)
  return `${MESSAGING_KEY}/conversations?${query}`
}
export function messagePageKey(id: string, cursor?: string) {
  const query = new URLSearchParams({ limit: "30" })
  if (cursor) query.set("cursor", cursor)
  return `${conversationKey(id)}/messages?${query}`
}
export function messagingPath(
  options: { box?: Inbox; conversation?: string; to?: string } = {},
) {
  const query = new URLSearchParams()
  if (options.box) query.set("box", options.box)
  if (options.conversation) query.set("conversation", options.conversation)
  if (options.to) query.set("to", options.to)
  return `${MESSAGING_PATH}${query.size ? `?${query}` : ""}`
}
