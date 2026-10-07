import type { Metadata } from "next"

import { ReportsTable } from "@/features/admin/components/reports/reports-table"

export const metadata: Metadata = {
  title: "Kiểm duyệt · Vedora Quản trị",
}

export default function AdminReportsPage() {
  return <ReportsTable />
}
