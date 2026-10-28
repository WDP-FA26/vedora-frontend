import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth } from "@/features/auth/server/session"
import { DashboardView } from "@/features/admin/dashboard/dashboard-view"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { defaultDashboardRange, validDashboardRange } from "@/features/admin/dashboard/dashboard-schema"

export const metadata: Metadata = { title: "Thống kê · Vedora Quản trị" }

export default async function AdminInsightsPage({ searchParams }: PageProps<"/admin/insights">) {
  const user = await requireAuth("/admin/insights")
  if (user.role !== "ADMIN") redirect("/home")
  const { from, to } = await searchParams
  if (from === undefined && to === undefined) {
    return <DashboardView initialRange={defaultDashboardRange()} />
  }
  const range = { from: typeof from === "string" ? from : "", to: typeof to === "string" ? to : "" }
  if (validDashboardRange(range)) return <DashboardView initialRange={range} />
  return (
    <>
      <Alert variant="destructive" className="mx-auto mt-4 max-w-3xl">
        <AlertDescription>
          Khoảng ngày trong liên kết không hợp lệ: cần đủ từ ngày và đến ngày (YYYY-MM-DD), theo thứ tự tăng dần, tối đa 90 ngày. Đang hiển thị 30 ngày gần nhất.
        </AlertDescription>
      </Alert>
      <DashboardView initialRange={defaultDashboardRange()} />
    </>
  )
}
