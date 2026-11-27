import { send, sendJson } from "@/features/shared/lib/api-client"
import { NOTIFICATIONS_KEY } from "@/features/notifications/notifications-cache"
import {
  notificationPageSchema,
  unreadCountSchema,
} from "@/features/notifications/schemas"

export function fetchNotificationPage([url, token]: readonly [string, string]) {
  return sendJson(notificationPageSchema, url, token)
}

export async function fetchUnreadCount([url, token]: readonly [string, string]) {
  return (await sendJson(unreadCountSchema, url, token)).unreadCount
}

export async function markNotificationRead(token: string, id: string) {
  await send(`${NOTIFICATIONS_KEY}/${id}/read`, token, { method: "POST" })
}

export async function markAllNotificationsRead(token: string) {
  await send(`${NOTIFICATIONS_KEY}/read`, token, { method: "POST" })
}
