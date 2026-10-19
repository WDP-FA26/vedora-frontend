"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import { EventStreamContentType, fetchEventSource } from "@microsoft/fetch-event-source"

import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { NOTIFICATION_TEXT } from "@/features/notifications/lib/notification-text"
import {
  NOTIFICATION_STREAM_URL,
  NOTIFICATIONS_PAGE_KEY,
  UNREAD_COUNT_KEY,
} from "@/features/notifications/notifications-cache"
import {
  notificationSchema,
  type NotificationPage,
} from "@/features/notifications/schemas"

/** Thrown from `onopen`/`onerror` to stop `fetchEventSource` from retrying. */
class FatalStreamError extends Error {}

/**
 * Keeps one SSE connection to `/notifications/sse` open while the user is
 * signed in and puts each pushed notification into the SWR caches. The
 * connection follows the access token: a refreshed token reopens it. The
 * library pauses it while the tab is hidden and reconnects on return, so the
 * count is refetched on every open to cover what was missed.
 */
export function useNotificationStream() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()

  useEffect(() => {
    if (!accessToken) return
    const controller = new AbortController()
    const pageKey = [NOTIFICATIONS_PAGE_KEY, accessToken]
    const countKey = [UNREAD_COUNT_KEY, accessToken]

    fetchEventSource(NOTIFICATION_STREAM_URL, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${accessToken}` },
      async onopen(response) {
        if (response.ok && response.headers.get("content-type")?.startsWith(EventStreamContentType)) {
          void mutate(countKey)
          void mutate(pageKey)
          return
        }
        // Expired while the page sat open: re-render the layout so the proxy
        // rotates the pair; the new token reopens the stream.
        if (response.status === 401) router.refresh()
        throw new FatalStreamError(`GET /notifications/sse failed (${response.status})`)
      },
      onmessage(event) {
        if (event.event !== "notification") return
        const parsed = notificationSchema.safeParse(JSON.parse(event.data))
        if (!parsed.success) return
        const incoming = parsed.data
        // The list on /home/notifications already shows it arriving.
        if (window.location.pathname !== "/home/notifications") {
          toast.add({
            title: incoming.actor.fullName,
            description: NOTIFICATION_TEXT[incoming.type],
            timeout: 5000,
          })
        }
        void mutate(
          pageKey,
          (page?: NotificationPage) =>
            page && !page.items.some((item) => item.id === incoming.id)
              ? { ...page, items: [incoming, ...page.items] }
              : page,
          { revalidate: false }
        )
        void mutate(countKey, (count?: number) => (count ?? 0) + 1, { revalidate: false })
      },
      onerror(error) {
        // Fatal errors stop the stream; anything else retries with backoff.
        if (error instanceof FatalStreamError) throw error
      },
    }).catch(() => {})

    return () => controller.abort()
  }, [accessToken, mutate, router])
}
