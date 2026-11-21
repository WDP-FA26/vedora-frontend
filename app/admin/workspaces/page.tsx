import type { Metadata } from "next"

import { AdminWorkspacesTable } from "@/features/workspaces/components/admin/workspaces-table"

export const metadata: Metadata = {
  title: "Trang nhà hàng · Vedora Quản trị",
}

export default function AdminWorkspacesPage() {
  return <AdminWorkspacesTable />
}
