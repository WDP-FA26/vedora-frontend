import type { Metadata } from "next"

import { ReportsView } from "@/features/admin/components/moderation/reports-view"

export const metadata: Metadata = {
  title: "Kiểm duyệt · Vedora Quản trị",
}

export default function AdminReportsPage() {
  return <ReportsView />
}
