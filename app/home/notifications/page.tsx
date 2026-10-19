import type { Metadata } from "next"

import { NotificationsView } from "@/features/notifications/components/notifications-view"

export const metadata: Metadata = {
  title: "Thông báo · Vedora",
}

export default function NotificationsPage() {
  return <NotificationsView />
}
