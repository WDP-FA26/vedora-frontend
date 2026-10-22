import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth } from "@/features/auth/server/session"
import { DashboardView } from "@/features/admin/dashboard/dashboard-view"
import { defaultDashboardRange } from "@/features/admin/dashboard/dashboard-schema"

export const metadata: Metadata = { title: "Thống kê · Vedora Quản trị" }

export default async function AdminInsightsPage() {
  const user = await requireAuth("/admin/insights")
  if (user.role !== "ADMIN") redirect("/home")
  return <DashboardView initialRange={defaultDashboardRange()} />
}
