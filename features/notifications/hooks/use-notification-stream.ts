"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import { EventStreamContentType, fetchEventSource } from "@microsoft/fetch-event-source"

import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { describeNotification } from "@/features/notifications/lib/notification-text"
import {
  NOTIFICATION_STREAM_URL,
  NOTIFICATIONS_PAGE_KEY,
  UNREAD_COUNT_KEY,
} from "@/features/notifications/notifications-cache"
import {
  notificationSchema,
  type NotificationPage,
} from "@/features/notifications/schemas"

const handledIds = new Set<string>()
const MAX_HANDLED_IDS = 200

function firstDelivery(id: string): boolean {
  if (handledIds.has(id)) return false
  handledIds.add(id)
  if (handledIds.size > MAX_HANDLED_IDS) {
    const [oldest] = handledIds
    handledIds.delete(oldest)
  }
  return true
}

class FatalStreamError extends Error {}

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
        if (response.status === 401) router.refresh()
        if (response.status >= 500) throw new Error(`GET /notifications/sse failed (${response.status})`)
        throw new FatalStreamError(`GET /notifications/sse failed (${response.status})`)
      },
      onmessage(event) {
        if (event.event !== "notification") return
        const parsed = notificationSchema.safeParse(JSON.parse(event.data))
        if (!parsed.success) return
        const incoming = parsed.data
        if (!firstDelivery(incoming.id)) return
        if (window.location.pathname !== "/home/notifications") {
          const { from, text } = describeNotification(incoming)
          toast.add({
            title: from,
            description: text,
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
        if (error instanceof FatalStreamError) throw error
      },
    }).catch(() => {})

    return () => controller.abort()
  }, [accessToken, mutate, router])
}
