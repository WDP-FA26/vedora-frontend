import type { Metadata } from "next"

import { ModerationSettingsPage } from "@/features/admin/components/settings/moderation-settings-form"

export const metadata: Metadata = {
  title: "Cài đặt · Vedora Quản trị",
}

export default function AdminSettingsPage() {
  return <ModerationSettingsPage />
}
