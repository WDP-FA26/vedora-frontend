import { redirect } from "next/navigation"

import { ADMIN_HOME } from "@/features/admin/data/nav-items"

export default function AdminPage() {
  redirect(ADMIN_HOME)
}
