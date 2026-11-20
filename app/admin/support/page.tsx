import type { Metadata } from "next"

import { AdminSupportTable } from "@/features/admin/components/support/support-table"

export const metadata: Metadata = {
  title: "Hỗ trợ & Kháng cáo · Vedora Quản trị",
}

export default function AdminSupportPage() {
  return <AdminSupportTable />
}
