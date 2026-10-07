import type { Metadata } from "next"

import { UsersTable } from "@/features/admin/components/users/users-table"

export const metadata: Metadata = {
  title: "Người dùng · Vedora Quản trị",
}

export default function AdminUsersPage() {
  return <UsersTable />
}
