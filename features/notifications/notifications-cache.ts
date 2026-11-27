import { API_URL } from "@/features/auth/lib/api"

export const NOTIFICATIONS_KEY = `${API_URL}/notifications`

export const NOTIFICATION_STREAM_URL = `${NOTIFICATIONS_KEY}/sse`

export const UNREAD_COUNT_KEY = `${NOTIFICATIONS_KEY}/unread-count`

export const NOTIFICATIONS_PAGE_KEY = `${NOTIFICATIONS_KEY}?limit=30`
