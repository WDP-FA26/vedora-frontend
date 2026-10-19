"use client"

import { useNotificationStream } from "@/features/notifications/hooks/use-notification-stream"

/** Mount once under `AuthProvider`; renders nothing. */
export function NotificationStream() {
  useNotificationStream()
  return null
}
