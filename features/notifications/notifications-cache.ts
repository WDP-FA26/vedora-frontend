import { API_URL } from "@/features/auth/lib/api"

/**
 * SWR keys for notifications. Keys are `[url, accessToken]` tuples fetched
 * with the fetchers in `notifications-api.ts`. The live stream edits both
 * caches in place, so these are the only places they are defined.
 */
export const NOTIFICATIONS_KEY = `${API_URL}/notifications`

/** SSE endpoint; read with `fetchEventSource` because it needs a bearer token. */
export const NOTIFICATION_STREAM_URL = `${NOTIFICATIONS_KEY}/sse`

export const UNREAD_COUNT_KEY = `${NOTIFICATIONS_KEY}/unread-count`

/** The newest notifications. */
export const NOTIFICATIONS_PAGE_KEY = `${NOTIFICATIONS_KEY}?limit=30`
