import type { Metadata } from "next"

import { ModerationTable } from "@/features/admin/components/moderation/moderation-table"

export const metadata: Metadata = {
  title: "Kiểm duyệt · Vedora Quản trị",
}

export default function AdminReportsPage() {
  return <ModerationTable />
}
