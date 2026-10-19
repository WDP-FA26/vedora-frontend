"use client"

import { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import {
  fetchNotificationPage,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/lib/notifications-api"
import {
  NOTIFICATIONS_PAGE_KEY,
  UNREAD_COUNT_KEY,
} from "@/features/notifications/notifications-cache"

/** Unread badge count; the live stream keeps it current. */
export function useUnreadCount() {
  const { data } = useAuthedSWR(UNREAD_COUNT_KEY, fetchUnreadCount)
  return data ?? 0
}

export function useNotifications() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const { data, error, isLoading } = useAuthedSWR(NOTIFICATIONS_PAGE_KEY, fetchNotificationPage)

  /** Marks `id` (or everything) read, then refetches the list and the badge. */
  async function markRead(id?: string) {
    if (!accessToken) return
    await (id ? markNotificationRead(accessToken, id) : markAllNotificationsRead(accessToken))
    await Promise.all([
      mutate([NOTIFICATIONS_PAGE_KEY, accessToken]),
      mutate([UNREAD_COUNT_KEY, accessToken]),
    ])
  }

  return {
    notifications: data?.items ?? [],
    hasMore: !!data?.nextCursor,
    error,
    isLoading,
    markRead,
  }
}
