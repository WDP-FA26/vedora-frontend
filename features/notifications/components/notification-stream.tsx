"use client"

import { useNotificationStream } from "@/features/notifications/hooks/use-notification-stream"

export function NotificationStream() {
  useNotificationStream()
  return null
}
